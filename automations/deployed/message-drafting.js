// ═══════════════════════════════════════════════════════════════
//  ניסוח הודעה — Message Drafting · DRAFT_VERSION
//
//  טריגר:  When record matches conditions · לידים ·
//          פעולה הבאה is any of: לשלוח הודעה · להשיב ללקוח
//  קלט:    leadId  (Airtable record ID)
//
//  שלושה תהליכים: הודעת פתיחה (סבב 0) · הודעת סבב (סבב N) · תשובה
//  (הלקוח פנה). המערכת מזהה, מנסחת ומכינה. אדם מאשר. אף פעם לא שולחת.
//
//  פתיחה וסבב: המבנה מהתבנית, ה-AI ממלא משתנה אחד (התעניינות).
//  תשובה: טקסט חופשי (הלקוח פנה, בתוך 24 שעות) — ה-AI רשאי לכתוב את
//  כל התשובה מתוך ההיסטוריה, תחת אותם כללי בטיחות; בלי AI — תבנית.
//
//  לא יוצר טיוטה כאשר: הפעולה אינה אחת מהשתיים · אין ״סוג לקוח״ (legacy)
//  · אין ליצור קשר · טיפול אישי · כבר קיימת הודעה פתוחה או שנשלחה לאותו
//  מפתח (פתיחה/סבב N, או תשובה מאז ההודעה האחרונה של הלקוח) · נדחתה.
// ═══════════════════════════════════════════════════════════════

const DRAFT_VERSION = '1.4.0';   // 2026-09-07 · 1.2: תשובה ללקוח, בלי ציטוט · 1.3: משתנה {מועד שיחה} מהתזמון · 1.4: אין טיוטה בלי טלפון תקין

// ── הגדרות — בלוק משותף, זהה בכל הסקריפטים (SETTINGS_BLOCK 1.0) ──
async function loadSettings() {
    const t = base.getTable('הגדרות');
    const q = await t.selectRecordsAsync({ fields: ['מפתח', 'ערך'] });
    const raw = {};
    for (const r of q.records) {
        const k = (r.getCellValueAsString('מפתח') || '').trim();
        if (k) raw[k] = (r.getCellValueAsString('ערך') || '').trim();
    }
    const has  = k => k in raw && raw[k] !== '';
    const req  = k => { if (!has(k)) throw new Error(`⛔ הגדרה נדרשת חסרה או ריקה: "${k}"`); return raw[k]; };
    const opt  = k => has(k) ? raw[k] : null;
    const int  = (k, v) => { const n = Number(v); if (!Number.isInteger(n) || n < 0) throw new Error(`⛔ הגדרה "${k}" אינה מספר שלם: "${v}"`); return n; };
    const bool = v => v === 'true';                       // רק true מדויק פותח. fail closed.
    const S = {
        env:       req('סביבה'),
        baseId:    req('בסיס'),
        outbound:  bool(req('שליחה_מופעלת')),
        external:  bool(req('פעולות_חיצוניות_מופעלות')),
        maxRounds: int('סבבים_מרביים', req('סבבים_מרביים')),
        gaps:      [],                                     // gaps[i] = ימים אחרי סבב i+1
        routing:   {}, idle: {},
        cutoff:    opt('דוח_תקועים_מתאריך'),
        capacity:  has('קיבולת_שיחות_יומית') ? int('קיבולת_שיחות_יומית', raw['קיבולת_שיחות_יומית']) : null,
        windows:   { 'א-ה': opt('חלון.א-ה'), 'ו': opt('חלון.ו'), 'מוצש': opt('חלון.מוצש'), 'חגים': opt('חלון.חגים') },
    };
    for (let i = 1; i < S.maxRounds; i++) S.gaps.push(int(`מרווח.סבב${i}`, req(`מרווח.סבב${i}`)));
    const P_ROUTE = 'ניתוב.', P_IDLE = 'סף_ללא_פעילות.';
    for (const k of Object.keys(raw)) {
        if (k.startsWith(P_ROUTE)) S.routing[k.slice(P_ROUTE.length)] = raw[k] || null;
        if (k.startsWith(P_IDLE))  S.idle[k.slice(P_IDLE.length)]    = has(k) ? int(k, raw[k]) : null;
    }
    if (base.id !== S.baseId)
        throw new Error(`⛔ הבסיס ${base.id} (${base.name}) אינו הבסיס שבהגדרות (${S.baseId}). לא רץ.`);
    return S;
}
//  השער היחיד לכל שליחה יוצאת. שני המתגים חייבים להיות true יחד,
//  ובנוסף לא DNC ולא טיפול אישי. כל ספק = לא שולחים.
function canSendOutbound(S, lead, L) {
    if (S.outbound !== true)           return { ok:false, why:'שליחה_מופעלת ≠ true' };
    if (S.external !== true)           return { ok:false, why:'פעולות_חיצוניות_מופעלות ≠ true' };
    if (lead.getCellValue(L.dnc))      return { ok:false, why:'אין ליצור קשר' };
    if (lead.getCellValue(L.personal)) return { ok:false, why:'טיפול אישי' };
    return { ok:true, why:'' };
}
// ── סוף הבלוק המשותף ──────────────────────────────────────────
// ── הגדרות הודעות — בלוק משותף לשלושת סקריפטי ההודעות (MESSAGING_BLOCK 1.0) ──
//  קורא את המפתחות של שכבת ההודעות. נפרד מהבלוק הראשי כדי שהוא יישאר זהה
//  בכל ששת הסקריפטים ושהליבה לא תיגע.
async function loadMessagingSettings() {
    const t = base.getTable('הגדרות');
    const q = await t.selectRecordsAsync({ fields: ['מפתח', 'ערך'] });
    const raw = {};
    for (const r of q.records) {
        const k = (r.getCellValueAsString('מפתח') || '').trim();
        if (k) raw[k] = (r.getCellValueAsString('ערך') || '').trim();
    }
    const has = k => k in raw && raw[k] !== '';
    const req = k => { if (!has(k)) throw new Error(`⛔ הגדרה נדרשת חסרה או ריקה: "${k}"`); return raw[k]; };
    const int = (k, v) => { const n = Number(v); if (!Number.isInteger(n) || n < 0) throw new Error(`⛔ הגדרה "${k}" אינה מספר שלם: "${v}"`); return n; };
    const MS = {
        aiEnabled:    raw['AI_מופעל'] === 'true',            // רק true מדויק
        aiProvider:   has('AI_ספק') ? raw['AI_ספק'] : null,   // ריק · mock · mock-fail · claude
        msgProvider:  has('ספק_הודעות') ? raw['ספק_הודעות'] : null,   // ריק · mock · mock-transient · mock-ambiguous · whatsapp
        maxAttempts:  int('ניסיונות_שליחה_מרביים', req('ניסיונות_שליחה_מרביים')),
        retryMinutes: int('מרווח_ניסיון_שליחה_דקות', req('מרווח_ניסיון_שליחה_דקות')),
        sendFrom:     has('שליחה_מתאריך') ? raw['שליחה_מתאריך'] : null,   // YYYY-MM-DD
        approval:     {},                                    // קו מוצר → מאשר
    };
    const P = 'אישור.';
    for (const k of Object.keys(raw)) if (k.startsWith(P)) MS.approval[k.slice(P.length)] = raw[k] || null;
    return MS;
}
// ── סוף בלוק ההודעות ──────────────────────────────────────────
// ── תזמון שיחה — פונקציה טהורה (SCHEDULER_CORE 1.0) ─────────────
//  proposeSlot(nowISO, takenISO[], cfg) → ISO של מועד השיחה המוצע, או null.
//  הכלל של בר: פנייה לפני שעת החיתוך → בעוד X שעות; אחרי → מחר בשעת הבוקר.
//  תמיד בתוך חלון שליחה (א-ה · ו · מוצש; ריק = אין), עד הקיבולת היומית,
//  מעוגל למעלה. אין הנחות על legacy, אין קריאה ל-Airtable — נבדק ב-node.
const TZ_IL = 'Asia/Jerusalem';
function ilParts(d) {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ_IL, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', weekday:'short', hour12:false }).formatToParts(d);
    const g = t => (p.find(x => x.type === t) || {}).value;
    return { y:+g('year'), m:+g('month'), d:+g('day'), h:+g('hour') % 24, mi:+g('minute'), wd:g('weekday') };
}
//  זמן מקומי בישראל → UTC. מנסה את שני ההיסטים האפשריים ובוחר את זה שמתאים.
function ilToUtc(y, m, d, h, mi) {
    for (const off of [180, 120]) {
        const guess = new Date(Date.UTC(y, m - 1, d, h, mi) - off * 60000);
        const p = ilParts(guess);
        if (p.y === y && p.m === m && p.d === d && p.h === h && p.mi === mi) return guess;
    }
    return new Date(Date.UTC(y, m - 1, d, h, mi) - 180 * 60000);
}
const hm = s => { const m = String(s || '').match(/^(\d{2}):(\d{2})$/); return m ? [+m[1], +m[2]] : null; };
const windowKey = wd => wd === 'Fri' ? 'ו' : wd === 'Sat' ? 'מוצש' : 'א-ה';
function proposeSlot(nowISO, takenISO, cfg) {
    const now = new Date(nowISO);
    const n = ilParts(now);
    const cut = hm(cfg.cutoff), morning = hm(cfg.morning);
    if (!cut || !morning) throw new Error('⛔ תזמון: שעת_חיתוך או שעת_בוקר אינן בפורמט HH:MM');
    const round = Math.max(1, cfg.roundMin || 30);
    const perDay = {};
    for (const t of takenISO || []) { if (!t) continue; const p = ilParts(new Date(t)); const k = `${p.y}-${p.m}-${p.d}`; perDay[k] = (perDay[k] || 0) + 1; }

    let cand;
    if (n.h * 60 + n.mi < cut[0] * 60 + cut[1]) {
        cand = new Date(now.getTime() + (cfg.hoursAfter || 0) * 3600000);
        const c = ilParts(cand); const total = Math.ceil((c.h * 60 + c.mi) / round) * round;
        cand = ilToUtc(c.y, c.m, c.d, Math.floor(total / 60) % 24, total % 60);
        if (Math.floor(total / 60) >= 24) { const nx = new Date(cand.getTime() + 86400000); const q = ilParts(nx); cand = ilToUtc(q.y, q.m, q.d, morning[0], morning[1]); }
    } else {
        const nx = new Date(now.getTime() + 86400000); const q = ilParts(nx);
        cand = ilToUtc(q.y, q.m, q.d, morning[0], morning[1]);
    }
    for (let i = 0; i < 14; i++) {
        const c = ilParts(cand);
        const w = cfg.windows[windowKey(c.wd)];
        const m = w ? String(w).match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/) : null;
        const nextMorning = () => { const nx = new Date(ilToUtc(c.y, c.m, c.d, 12, 0).getTime() + 86400000); const q = ilParts(nx); return ilToUtc(q.y, q.m, q.d, morning[0], morning[1]); };
        if (!m) { cand = nextMorning(); continue; }                              // אין חלון ביום הזה
        const start = +m[1] * 60 + +m[2], end = +m[3] * 60 + +m[4], t = c.h * 60 + c.mi;
        if (t < start) { cand = ilToUtc(c.y, c.m, c.d, +m[1], +m[2]); continue; } // לפני פתיחה → בפתיחה
        if (t > end)   { cand = nextMorning(); continue; }                        // אחרי סגירה → מחר
        if (cfg.capacity !== null && cfg.capacity !== undefined && (perDay[`${c.y}-${c.m}-${c.d}`] || 0) >= cfg.capacity) { cand = nextMorning(); continue; }
        return cand.toISOString();
    }
    return null;
}
//  ניסוח למשתנה {מועד שיחה}: "היום בסביבות 14:30" · "מחר בסביבות 10:00" · "ביום ראשון בסביבות 10:00"
function slotPhrase(slotISO, nowISO) {
    if (!slotISO) return 'בהקדם';
    const s = ilParts(new Date(slotISO)), n = ilParts(new Date(nowISO));
    const time = `${String(s.h).padStart(2, '0')}:${String(s.mi).padStart(2, '0')}`;
    const dayIdx = d => Math.round(ilToUtc(d.y, d.m, d.d, 12, 0).getTime() / 86400000);
    const diff = dayIdx(s) - dayIdx(n);
    const names = { Sun:'ראשון', Mon:'שני', Tue:'שלישי', Wed:'רביעי', Thu:'חמישי', Fri:'שישי', Sat:'שבת' };
    if (diff === 0) return `היום בסביבות ${time}`;
    if (diff === 1) return `מחר בסביבות ${time}`;
    return `ביום ${names[s.wd] || s.wd} בסביבות ${time}`;
}
// ── סוף תזמון שיחה ─────────────────────────────────────────────


const S  = await loadSettings();
const MS = await loadMessagingSettings();
console.log(`⚙ draft ${DRAFT_VERSION} · ${S.env} · AI ${MS.aiEnabled ? (MS.aiProvider || 'ללא ספק') : 'כבוי'}`);

const LEADS   = base.getTable('לידים');
const MSGS    = base.getTable('הודעות');
const TPL     = base.getTable('תבניות הודעה');
const JOURNAL = base.getTable('יומן מגעים');

const L = { name:'שם ליד', first:'שם לפנייה', line:'קו מוצר', owner:'אחראי', ctype:'סוג לקוח', phone:'טלפון מתוקן',
            bizRaw:'עסקי או פרטי?', qty:'כמות', qtyN:'כמות מתוקנת', city:'עיר', product:'פירוט המוצר',
            notes:'הערות פנימיות', source:'מקור', sale:'סטטוס מכירה', proc:'מצב טיפול',
            round:'סבב נוכחי', act:'פעולה הבאה', dnc:'אין ליצור קשר', personal:'טיפול אישי', log:'יומן מגעים', slot:'מועד שיחה מוצע' };
const M = { title:'תיאור', lead:'ליד', proc:'תהליך', round:'סבב', text:'טיוטה', state:'מצב',
            approver:'מאשר', tpl:'תבנית', origin:'מקור ניסוח', created:'מועד יצירה' };
const T = { key:'מפתח', text:'טקסט', active:'פעיל' };
const J = { type:'סוג מגע', dir:'כיוון', res:'תוצאה', when:'מועד מגע', detail:'פירוט' };

for (const n of Object.values(L)) if (!LEADS.fields.some(f => f.name === n))   throw new Error(`⛔ השדה "${n}" חסר בטבלת לידים.`);
for (const n of Object.values(M)) if (!MSGS.fields.some(f => f.name === n))    throw new Error(`⛔ השדה "${n}" חסר בטבלת הודעות.`);
for (const n of Object.values(T)) if (!TPL.fields.some(f => f.name === n))     throw new Error(`⛔ השדה "${n}" חסר בטבלת תבניות הודעה.`);
for (const n of Object.values(J)) if (!JOURNAL.fields.some(f => f.name === n)) throw new Error(`⛔ השדה "${n}" חסר ביומן המגעים.`);

const ACTIONS = { 'לשלוח הודעה': 'outbound', 'להשיב ללקוח': 'reply' };
const IN = 'נכנס — הלקוח פנה';
const OPEN = ['טיוטה', 'ממתין לאישור', 'מאושר', 'ממתין לשליחה', 'שולח', 'דורש בירור', 'נשלח'];
const APPROVERS = ['בר', 'עומר'];
const MAX_VAR = 120, MAX_REPLY = 600;
//  מילים שאסור שיופיעו במה שה-AI מחזיר — הבטחות, מחיר, מלאי, מועדים
const FORBIDDEN = /[₪%$]|הנחה|מבצע|הטבה|מלאי|אספקה|במחיר|חינם|מתנה|נתקשר ב|בשעה/;

// ── generateDraft — הספק ניתן להחלפה, הכללים לא ─────────────────
//  כל ספרה בפלט חייבת להופיע בעובדות או במה שהלקוח כתב.
function digitsOk(s, allowed) {
    const ok = new Set(JSON.stringify(allowed).match(/\d/g) || []);
    for (const d of (s.match(/\d/g) || [])) if (!ok.has(d)) return false;
    return true;
}
function validVar(v, ctx) {
    if (typeof v !== 'string') return false;
    const s = v.trim();
    return !!s && s.length <= MAX_VAR && !/\n/.test(s) && !FORBIDDEN.test(s) && digitsOk(s, ctx.facts);
}
function validReply(v, ctx) {
    if (typeof v !== 'string') return false;
    const s = v.trim();
    return !!s && s.length <= MAX_REPLY && !FORBIDDEN.test(s) && digitsOk(s, [ctx.facts, ctx.הודעה_אחרונה_מהלקוח]);
}
//  כללים דטרמיניסטיים מהעובדות בלבד (mock). בלי רשת.
function rulesInterest(f) {
    const noun = f['קו מוצר'] === 'מזרנים' ? 'מזרנים' : f['קו מוצר'] === 'ציוד' ? 'ציוד' : `רפורמרים ${f['קו מוצר'] || ''}`.trim();
    const qty  = f['כמות מתוקנת'];
    const biz  = f['סוג לקוח'] === 'עסקי' || /סטודיו/.test(`${f['פירוט המוצר'] || ''} ${f['הערות פנימיות'] || ''}`);
    let s = qty && qty > 1 ? `${qty} ${noun}` : (f['קו מוצר'] || '');
    if (biz && qty && qty > 1) s += ' לסטודיו שלך';
    if (f['עיר']) s += ` ב${f['עיר']}`;
    return s;
}
//  הכללים לא מבינים שפה, ולכן לא מסכמים ולא מצטטים — רק מאשרים קבלה.
//  סיכום חכם של מה שהלקוח כתב שייך למודל (callClaude), לא לכאן.
function rulesReply(ctx) {
    const name = ctx.facts['שם לפנייה'] ? `היי ${ctx.facts['שם לפנייה']}` : 'היי';
    return `${name}, תודה שחזרת אלינו :)\nקיבלנו את ההודעה שלך ונחזור אליך בהקדם עם כל הפרטים.\nאם נוח לך, אפשר לכתוב לנו כאן מתי מתאים לשיחה.`;
}
async function callClaude(ctx, reply) {
    if (S.external !== true) return { error: 'פעולות_חיצוניות_מופעלות ≠ true' };
    let key = null;
    try { key = input.secret('ANTHROPIC_API_KEY'); } catch (e) { return { error: 'אין secret בשם ANTHROPIC_API_KEY' }; }
    const rules = 'השתמש/י אך ורק בעובדות שבקלט ובמה שהלקוח כתב. אסור להמציא: מחיר, הנחה, הטבה, מלאי, זמן אספקה, מועד שיחה, מידע על המוצר. ' +
                  'ויואלדי וסימפוני הם דגמי רפורמר. עברית טבעית, לא פורמלית מדי. ';
    const system = reply
        ? 'את/ה מנסח/ת תשובה ללקוח שכתב ל-Elements (רפורמרים ומזרני פילאטיס) ב-WhatsApp. החזר/י JSON בלבד: {"תשובה": "..."}. ' +
          'התשובה מודה, משקפת בקצרה ובמילים שלך את מה שהלקוח אמר (סיכום טבעי במשפט אחד, לעולם לא ציטוט), ומקדמת לשיחה או לפגישה בלי להבטיח דבר. עד 600 תווים. ' + rules
        : 'את/ה מנסח/ת ערך למשתנה יחיד בהודעת WhatsApp של Elements. החזר/י JSON בלבד: {"התעניינות": "..."}. ' +
          'הערך משלים את המשפט "ראינו שהתעניינת ב___". עד 120 תווים, שורה אחת. אם אין מספיק מידע — קו המוצר בלבד. ' + rules;
    const body = { model: 'claude-haiku-4-5-20251001', max_tokens: reply ? 500 : 200, system, messages: [{ role: 'user', content: JSON.stringify(ctx) }] };
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000));
    try {
        const res = await Promise.race([fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify(body) }), timeout]);
        if (!res.ok) return { error: `API ${res.status}` };
        const data = await res.json();
        const text = (data.content || []).map(c => c.text || '').join('');
        const m = text.match(/\{[\s\S]*\}/);
        if (!m) return { error: 'אין JSON בפלט' };
        return { vars: JSON.parse(m[0]) };
    } catch (e) { return { error: String(e.message || e) }; }
}
//  מחזיר { vars, source, note }. source ∈ AI · כללים · תבנית.
//  פתיחה/סבב: vars.התעניינות. תשובה: vars.תשובה = הטקסט המלא, או ריק = תבנית.
async function generateDraft(ctx) {
    const reply = ctx.תהליך === 'תשובה';
    const defaults = reply ? { 'תשובה': '' } : { 'התעניינות': ctx.facts['קו מוצר'] || '' };
    if (!MS.aiEnabled || !MS.aiProvider) return { vars: defaults, source: 'תבנית', note: 'AI כבוי' };
    let out = null, source = 'תבנית', note = '';
    if (MS.aiProvider === 'mock')            { out = reply ? { 'תשובה': rulesReply(ctx) } : { 'התעניינות': rulesInterest(ctx.facts) }; source = 'כללים'; }
    else if (MS.aiProvider === 'mock-fail')  { out = reply ? { 'תשובה': 'מבצע 50% הנחה ₪' } : { 'התעניינות': 'מבצע 50% הנחה ₪' }; source = 'כללים'; }
    else if (MS.aiProvider === 'claude')     { const r = await callClaude(ctx, reply); if (r.error) note = r.error; else { out = r.vars; source = 'AI'; } }
    else                                     { note = `AI_ספק לא מוכר: ${MS.aiProvider}`; }
    if (reply) {
        const v = out && out['תשובה'];
        if (!validReply(v, ctx)) return { vars: defaults, source: 'תבנית', note: note || `פלט לא תקין: ${JSON.stringify(v).slice(0, 80)}` };
        return { vars: { 'תשובה': v.trim() }, source, note };
    }
    const v = out && out['התעניינות'];
    if (!validVar(v, ctx)) return { vars: defaults, source: 'תבנית', note: note || `פלט לא תקין: ${JSON.stringify(v)}` };
    if (v.trim() === defaults['התעניינות']) return { vars: defaults, source: 'תבנית', note: 'ללא העשרה' };
    return { vars: { 'התעניינות': v.trim() }, source, note };
}
//  הרכבה: המבנה מהתבנית, הערכים מ-vars. "ב{התעניינות}" עם ערך שמתחיל בספרה → "ב-".
function assemble(tpl, vars) {
    let t = tpl;
    for (const [k, v] of Object.entries(vars)) {
        const val = (v || '').trim();
        t = t.replace(new RegExp(`ב\\{${k}\\}`, 'g'), /^[0-9A-Za-z]/.test(val) ? `ב-${val}` : `ב${val}`);
        t = t.replace(new RegExp(`\\{${k}\\}`, 'g'), val);
    }
    return t.replace(/ {2,}/g, ' ').replace(/ ,/g, ',').trim();
}

// ── טעינה ושערים ─────────────────────────────────────────────────
const leadId = input.config().leadId;
const lq = await LEADS.selectRecordsAsync({ fields: Object.values(L) });
const lead = lq.getRecord(leadId);
const val = n => lead.getCellValueAsString(n);
function skip(why) { console.log(`· ${lead.name} — אין טיוטה: ${why}`); }
const kind = ACTIONS[val(L.act)] || null;

if (!kind)                             { skip(`הפעולה ״${val(L.act)}״ אינה מייצרת הודעה`); }
else if (!lead.getCellValue(L.ctype))  { skip('אין סוג לקוח — ליד שלא עבר בקליטה החדשה'); }
else if (lead.getCellValue(L.dnc))     { skip('אין ליצור קשר'); }
else if (lead.getCellValue(L.personal)){ skip('טיפול אישי'); }
//  אין טלפון תקין → אין לאן לשלוח. טיוטה כזו הייתה יושבת בתור האישורים
//  בלי יכולת לצאת ומבזבזת החלטה אנושית. הקליטה כבר פתחה שורת ״לבדיקה״
//  על הטלפון, ושם מקומו של הטיפול (שחר, 30.9.2026).
else if (!/^\+9725\d{8}$/.test(lead.getCellValueAsString(L.phone) || '')) { skip(`טלפון פסול: "${lead.getCellValueAsString(L.phone) || '(ריק)'}"`); }
else {

// ── היומן: מגעים אחרונים וההודעה האחרונה מהלקוח ─────────────────
const jq = await JOURNAL.selectRecordsAsync({ fields: Object.values(J) });
const dated = (lead.getCellValue(L.log) || []).map(x => jq.records.find(r => r.id === x.id)).filter(r => r && r.getCellValue(J.when))
    .sort((a, b) => new Date(b.getCellValue(J.when)) - new Date(a.getCellValue(J.when)));
const lastIn = dated.find(r => r.getCellValueAsString(J.dir) === IN) || null;
const lastInTs = lastIn ? new Date(lastIn.getCellValue(J.when)).getTime() : 0;

// ── מה ההודעה ───────────────────────────────────────────────────
const round = lead.getCellValue(L.round) || 0;
const proc  = kind === 'reply' ? 'תשובה' : (round === 0 ? 'הודעת פתיחה' : 'הודעת סבב');
const key   = kind === 'reply' ? 'תשובה' : (round === 0 ? 'הודעת פתיחה' : `הודעת סבב ${round}`);

// ── כפילות ──────────────────────────────────────────────────────
//  פתיחה/סבב: לפי ליד + תהליך + סבב. תשובה: לפי ליד + תהליך, ורק
//  הודעות שנוצרו אחרי ההודעה האחרונה של הלקוח — לקוח שכתב שוב מקבל טיוטה חדשה.
const mq   = await MSGS.selectRecordsAsync({ fields: [M.lead, M.proc, M.round, M.state, M.created] });
const same = mq.records.filter(m => (m.getCellValue(M.lead) || []).some(x => x.id === leadId)
    && m.getCellValueAsString(M.proc) === proc
    && (kind === 'reply' ? new Date(m.getCellValue(M.created)).getTime() >= lastInTs : (m.getCellValue(M.round) || 0) === round));
const open     = same.find(m => OPEN.includes(m.getCellValueAsString(M.state)));
const rejected = same.find(m => m.getCellValueAsString(M.state) === 'נדחה');

if (kind === 'reply' && !lastIn) { skip('״להשיב ללקוח״ בלי הודעה נכנסת מתוארכת ביומן'); }
else if (open)                   { skip(`כבר קיימת הודעה ״${open.getCellValueAsString(M.state)}״ ל${key}`); }
else if (rejected)               { skip(`הודעה ל${key} נדחתה על ידי אדם — לא יוצרים שוב`); }
else {

// ── תבנית ומאשר ─────────────────────────────────────────────────
const tq  = await TPL.selectRecordsAsync({ fields: Object.values(T) });
const tpl = tq.records.find(t => t.getCellValueAsString(T.key) === key && t.getCellValue(T.active));
const line = val(L.line);
let approver = MS.approval[line] || null;
if (approver && !APPROVERS.includes(approver)) { console.log(`⚠ אישור.${line} = "${approver}" אינו מאשר מוכר`); approver = null; }

// ── הקשר ל-AI: עובדות בלבד, רק מה שמלא, 5 מגעים אחרונים, ההודעה האחרונה מהלקוח ──
const facts = {};
for (const [k, n] of Object.entries({ 'שם לפנייה':L.first, 'קו מוצר':L.line, 'סוג לקוח':L.ctype, 'עסקי או פרטי?':L.bizRaw,
        'כמות':L.qty, 'עיר':L.city, 'פירוט המוצר':L.product, 'מקור':L.source, 'סטטוס מכירה':L.sale, 'מצב טיפול':L.proc })) {
    const v = val(n); if (v) facts[k] = v;
}
if (lead.getCellValue(L.qtyN) !== null) facts['כמות מתוקנת'] = lead.getCellValue(L.qtyN);
const notes = val(L.notes); if (notes) facts['הערות פנימיות'] = notes.slice(0, 600);
const recent = dated.slice(0, 5).map(r => ({ סוג: r.getCellValueAsString(J.type), כיוון: r.getCellValueAsString(J.dir), תוצאה: r.getCellValueAsString(J.res),
    תאריך: String(r.getCellValue(J.when)).slice(0, 10), פירוט: (r.getCellValueAsString(J.detail) || '').slice(0, 200) }));
const ctx = { תהליך: proc, סבב: kind === 'reply' ? null : round, תבנית: tpl ? tpl.getCellValueAsString(T.text) : '', facts, מגעים_אחרונים: recent,
              הודעה_אחרונה_מהלקוח: lastIn ? (lastIn.getCellValueAsString(J.detail) || '').slice(0, 500) : '',
              כללים: 'עובדות מהקלט בלבד. בלי מחיר, הנחה, הטבה, מלאי, אספקה, מועד שיחה. לא להבטיח דבר.' };

const gen = await generateDraft(ctx);
let text;
if (kind === 'reply') text = gen.vars['תשובה'] || (tpl ? assemble(tpl.getCellValueAsString(T.text), { 'שם לפנייה': val(L.first) }) : '');
else text = tpl ? assemble(tpl.getCellValueAsString(T.text), Object.assign({ 'שם לפנייה': val(L.first), 'מועד שיחה': slotPhrase(lead.getCellValue(L.slot), new Date().toISOString()) }, gen.vars)) : '';
const hasText = !!text.trim();

const id = await MSGS.createRecordAsync({
    [M.title]:    `${key} · ${lead.name}`,
    [M.lead]:     [{ id: leadId }],
    [M.proc]:     { name: proc },
    [M.round]:    kind === 'reply' || round === 0 ? null : round,
    [M.text]:     text,
    [M.state]:    { name: hasText ? 'ממתין לאישור' : 'טיוטה' },
    [M.approver]: approver ? { name: approver } : null,
    [M.tpl]:      tpl ? key : `${key} (אין תבנית פעילה)`,
    [M.origin]:   { name: gen.source },
});
console.log(`✉ ${lead.name} · ${key} · מאשר ${approver || '(אין)'} · מקור ${gen.source}${gen.note ? ' (' + gen.note + ')' : ''} · ${hasText ? 'ממתין לאישור' : '⚠ אין תבנית פעילה — טיוטה ריקה'} · ${id}`);
if (!approver) console.log(`⚠ אין מאשר — אין כלל אישור.${line || '(ריק)'} בהגדרות`);
}}
