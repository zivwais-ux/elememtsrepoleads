// ═══════════════════════════════════════════════════════════════
//  קליטת ליד חדש — Lead Intake · INTAKE_VERSION
//
//  טריגר:  When record created · טבלת לידים
//  קלט:    leadId  (Airtable record ID)
//
//  מה שקורה כשליד *נולד*, לפני שמישהו נגע בו. כותב עובדות קלט בלבד;
//  כתיבת "סטטוס מכירה" מעירה את Lead Inputs Changed והמנוע גוזר את
//  השאר. דלת אחת לגזירה — גם לליד חדש.
//
//  כותב (רק כשריק):
//    טלפון מתוקן · שם לפנייה · סטטוס מכירה=חדש · מספר פניות=0
//    תאריך כניסה=היום · אחראי לפי קו מוצר · סוג לקוח · כמות מתוקנת
//    דורש בדיקה + שורת "לבדיקה" כשיש בעיה
//  לא כותב: מצב טיפול · פעולה הבאה · תאריך הטיפול הבא · פעילות אחרונה
//
//  רץ בבסיס נקי: אין תלות בטבלאות מקור או בשדות מיגרציה.
//  ממלא רק שדות ריקים — בטוח להרצה חוזרת על ליד קיים.
// ═══════════════════════════════════════════════════════════════

const INTAKE_VERSION = '2.1.0';   // 2026-09-07 · 2.0: הגדרות · ניתוב · סוג לקוח · כמות · 2.1: מועד שיחה מוצע

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


const S = await loadSettings();
//  הגדרות תזמון — קורא רק מה שהתזמון צריך. ריק בשעת_חיתוך/שעת_בוקר = התזמון כבוי.
async function loadSchedulingSettings() {
    const q = await base.getTable('הגדרות').selectRecordsAsync({ fields: ['מפתח', 'ערך'] });
    const raw = {}; for (const r of q.records) { const k = (r.getCellValueAsString('מפתח') || '').trim(); if (k) raw[k] = (r.getCellValueAsString('ערך') || '').trim(); }
    const has = k => k in raw && raw[k] !== '';
    const num = (k, d) => has(k) ? Number(raw[k]) : d;
    return { enabled: has('תזמון.שעת_חיתוך') && has('תזמון.שעת_בוקר'), privateAllowed: raw['תזמון_פרטיים'] === 'true',
             hoursAfter: num('תזמון.שעות_מהפנייה', 2), cutoff: raw['תזמון.שעת_חיתוך'] || null, morning: raw['תזמון.שעת_בוקר'] || null,
             roundMin: num('תזמון.עיגול_דקות', 30) };
}
const SC = await loadSchedulingSettings();
console.log(`⚙ intake ${INTAKE_VERSION} · ${S.env} · ${base.name} · תזמון ${SC.enabled ? 'פעיל' : 'כבוי'}`);

const LEADS  = base.getTable('לידים');
const REVIEW = base.getTable('לבדיקה');

const L = { name:'שם ליד', phone:'טלפון', phoneN:'טלפון מתוקן', first:'שם לפנייה',
            sale:'סטטוס מכירה', cnt:'מספר פניות', flag:'דורש בדיקה',
            line:'קו מוצר', created:'תאריך כניסה', qty:'כמות', qtyN:'כמות מתוקנת',
            owner:'אחראי', ctype:'סוג לקוח', bizRaw:'עסקי או פרטי?',
            dnc:'אין ליצור קשר', personal:'טיפול אישי', review:'לבדיקה', slot:'מועד שיחה מוצע' };
const R = { title:'הבעיה', type:'סוג הבעיה', sev:'חומרה', detail:'פרטים',
            state:'מצב', found:'נמצא בתאריך', lead:'לידים' };

for (const n of Object.values(L))
    if (!LEADS.fields.some(f => f.name === n)) throw new Error(`⛔ השדה "${n}" חסר בטבלת לידים. הקליטה לא תרוץ.`);
for (const n of Object.values(R))
    if (!REVIEW.fields.some(f => f.name === n)) throw new Error(`⛔ השדה "${n}" חסר בטבלת לבדיקה. הקליטה לא תרוץ.`);

// ── נרמול — מועתק מ-normalize-run-once.js, אין לשנות בנפרד ─────
const BIDI   = /[‎‏‪-‮⁦-⁩؜]/g;
const DASHES = /[‐-―−﹘﹣－]/g;
const EMOJI  = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;
const BIZ    = /סטודיו|studio|כושר|יוגה|פילאטיס|pilates|אימונים|מאמנת|תזונה|שיקום|מרכז/i;

function normPhone(raw) {
    if (!raw) return { ok:false, why:'טלפון חסר' };
    let s = String(raw).replace(BIDI,'').replace(DASHES,'-').replace(/[\s()\-.]/g,'');
    if (s.startsWith('+972')) s = '0' + s.slice(4);
    else if (s.startsWith('972')) s = '0' + s.slice(3);
    if (/^0[2-489]\d{7}$/.test(s)) return { ok:false, why:'לא מספר נייד' };
    if (/^\+?\d{7,15}$/.test(s) && !s.startsWith('0')) return { ok:false, why:'מספר לא ישראלי' };
    if (!/^05\d{8}$/.test(s)) return { ok:false, why:'טלפון לא תקין' };
    return { ok:true, e164:'+972' + s.slice(1) };
}
function normName(raw) {
    if (!raw) return null;
    let s = String(raw).normalize('NFKC').replace(BIDI,'').replace(EMOJI,'');
    s = s.replace(/^\s*\d+[.)]\s*/, '');
    s = s.split(/[|•·,\/]| - /)[0].replace(/\s+/g,' ').trim();
    if (!s || BIZ.test(s)) return null;
    const w = s.split(' ');
    return w.length > 3 ? null : w[0];
}
//  כמות: המספר הראשון בטקסט. "5+" → 5, "." → ריק. מועתק מ-fill-all.js.
const num = v => { const m = String(v ?? '').match(/\d+/); return m ? parseInt(m[0], 10) : null; };
//  סוג לקוח: מהתשובה החופשית בטופס. אין תשובה או תשובה לא מוכרת → "לא ידוע".
//  כמות לבדה לעולם אינה ראיה. הערך תמיד נכתב — הוא גם הסימן שהליד עבר בקליטה החדשה.
function customerType(raw) {
    const s = String(raw ?? '').normalize('NFKC').replace(BIDI,'').trim();
    if (!s) return 'לא ידוע';
    if (/עסק|סטודיו|studio|business|b2b/i.test(s)) return 'עסקי';
    if (/בית|פרט|private|b2c/i.test(s))            return 'פרטי';
    return 'לא ידוע';
}
const iso = d => d ? new Date(d).toLocaleDateString('en-CA', { timeZone:'Asia/Jerusalem' }) : null;
const today = iso(Date.now());
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

// ── טעינה ───────────────────────────────────────────────────────
const leadId = input.config().leadId;
const q = await LEADS.selectRecordsAsync({ fields: Object.values(L) });
const lead = q.getRecord(leadId);

const f = {};                                   // מה שייכתב לליד
const reviews = [];                             // שורות "לבדיקה" ליצירה

// ── 1 · טלפון ───────────────────────────────────────────────────
let phoneN = lead.getCellValue(L.phoneN);
if (!phoneN) {
    const r = normPhone(lead.getCellValue(L.phone));
    if (r.ok) { phoneN = r.e164; f[L.phoneN] = phoneN; }
    else reviews.push({
        [R.title]:  `${r.why} — ${lead.name}`,
        [R.type]:   { name: r.why },
        [R.sev]:    { name: 'חוסם שליחה לגמרי' },
        [R.detail]: `הטלפון שהגיע: "${lead.getCellValue(L.phone) || '(ריק)'}". אי אפשר לשלוח לליד הזה עד שיתוקן ידנית.`,
    });
}

// ── 2 · שם לפנייה ───────────────────────────────────────────────
if (!lead.getCellValue(L.first)) {
    const n = normName(lead.getCellValue(L.name));
    if (n) f[L.first] = n;                      // אין שם סביר → נשאר ריק, לא בעיה
}

// ── 3 · מצב פתיחה — קלט בלבד, המנוע גוזר את השאר ────────────────
if (!lead.getCellValueAsString(L.sale)) f[L.sale] = { name: 'חדש' };
if (lead.getCellValue(L.cnt) === null)  f[L.cnt]  = 0;     // ליד חדש: ידוע שאפס
if (!lead.getCellValue(L.created))      f[L.created] = today;

// ── 4 · ניתוב — אחראי לפי קו מוצר, רק אם ריק ─────────────────────
//  הכלל בהגדרות (ניתוב.<קו מוצר>). קו מוצר בלי כלל → נשאר ריק, ודוח
//  התקועים מראה "ללא אחראי". לא ממציאים אחראי.
if (!lead.getCellValue(L.owner)) {
    const line  = lead.getCellValueAsString(L.line);
    const owner = S.routing[line] || null;
    if (owner) f[L.owner] = { name: owner };
    else console.log(`ℹ אין כלל ניתוב לקו "${line || '(ריק)'}" — אחראי נשאר ריק`);
}

// ── 5 · סוג לקוח וכמות ──────────────────────────────────────────
if (!lead.getCellValue(L.ctype)) f[L.ctype] = { name: customerType(lead.getCellValue(L.bizRaw)) };
if (lead.getCellValue(L.qtyN) === null) {
    const n = num(lead.getCellValueAsString(L.qty));
    if (n !== null && n > 0) f[L.qtyN] = n;
}

// ── 6 · מועד שיחה מוצע — הצעה לצוות, לפי הכלל של בר ──────────────
//  רק אם ריק. לקוח פרטי מקבל רק אם תזמון_פרטיים = true. הקיבולת נספרת
//  על כל המועדים שכבר נקבעו לאותו יום, מכל הלידים.
if (SC.enabled && lead.getCellValue(L.slot) === null) {
    const ctype = f[L.ctype] ? f[L.ctype].name : lead.getCellValueAsString(L.ctype);
    if (ctype === 'פרטי' && !SC.privateAllowed) console.log('ℹ לקוח פרטי — אין מועד שיחה מוצע (תזמון_פרטיים = false)');
    else {
        const taken = q.records.filter(r => r.id !== leadId).map(r => r.getCellValue(L.slot)).filter(Boolean);
        const slot = proposeSlot(new Date().toISOString(), taken, { windows: S.windows, capacity: S.capacity, hoursAfter: SC.hoursAfter, cutoff: SC.cutoff, morning: SC.morning, roundMin: SC.roundMin });
        if (slot) { f[L.slot] = slot; console.log(`🗓 מועד שיחה מוצע: ${slotPhrase(slot, new Date().toISOString())}`); }
        else console.log('⚠ לא נמצא מועד שיחה ב-14 הימים הקרובים');
    }
}

// ── 7 · אותו טלפון בלידים אחרים ─────────────────────────────────
//  אותו טלפון לבדו אינו כפילות. אותו קו מוצר = *מועמד*, ואדם מכריע.
//  קו מוצר שונה = מכירה צולבת, לא בעיה, ואינו יוצר שורת בדיקה.
if (phoneN) {
    const myLine = lead.getCellValueAsString(L.line);
    const same = q.records.filter(r => r.id !== leadId && r.getCellValue(L.phoneN) === phoneN);
    const sameLine = same.filter(r => r.getCellValueAsString(L.line) === myLine);

    if (sameLine.length) {
        const lines = sameLine.map(r => {
            const c = r.getCellValue(L.created);
            const gap = c ? daysBetween(c, today) : null;
            return `• ${r.name} — ${r.getCellValueAsString(L.line)} · נכנס ${iso(c) || '?'}${gap !== null ? ` (לפני ${gap} ימים)` : ''} · כמות ${r.getCellValueAsString(L.qty) || '?'} · סטטוס ${r.getCellValueAsString(L.sale) || '?'}`;
        });
        reviews.push({
            [R.title]:  `אותו טלפון באותו קו מוצר — ${lead.name}`,
            [R.type]:   { name: 'כפילות אפשרית' },
            [R.sev]:    { name: 'לטיפול בהמשך' },
            [R.detail]: `ליד חדש בקו ${myLine}, כמות ${lead.getCellValueAsString(L.qty) || '?'}.\n` +
                        `קיימים באותו טלפון ובאותו קו:\n${lines.join('\n')}\n\n` +
                        `פנייה חוזרת אחרי זמן עם כמות שונה = לקוח שעדיין מחפש, לא כפילות. ` +
                        `הכרעה אנושית. אין למזג אוטומטית.`,
            _links: sameLine.map(r => ({ id: r.id })),
        });
    }
    if (same.length > sameLine.length)
        console.log(`ℹ מכירה צולבת אפשרית — אותו טלפון ב-${same.length - sameLine.length} ליד/ים בקו מוצר אחר. לא נפתחה בדיקה.`);
}

// ── 8 · דגל ───────────────────────────────────────────────────
if (reviews.length && !lead.getCellValue(L.flag)) f[L.flag] = true;

// ── כתיבה ───────────────────────────────────────────────────────
if (Object.keys(f).length) {
    await LEADS.updateRecordAsync(leadId, f);
    console.log(`✅ ${lead.name}`, f);
} else {
    console.log(`· ${lead.name} — כל שדות הקליטה כבר מלאים`);
}

for (const rv of reviews) {
    const links = [{ id: leadId }].concat(rv._links || []);
    delete rv._links;
    await REVIEW.createRecordAsync(Object.assign(rv, {
        [R.state]: { name: 'פתוח' },
        [R.found]: today,
        [R.lead]:  links,
    }));
    console.log(`🔎 נפתחה בדיקה: ${rv[R.title]}`);
}
