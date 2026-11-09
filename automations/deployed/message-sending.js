// ═══════════════════════════════════════════════════════════════
//  שליחת הודעה — Message Sending · SEND_VERSION
//
//  טריגר:  When record matches conditions · הודעות · מצב = מאושר
//  קלט:    messageId  (Airtable record ID)
//
//  הדלת היחידה החוצה. שני סוגי כישלון:
//    קבוע  → ״נחסם״ + סיבת חסימה: לפני תאריך ההפעלה · טיוטה ריקה · אין ליד ·
//            טלפון פסול · אין ליצור קשר · טיפול אישי · תקלת ספק סופית · עברו N ניסיונות
//    זמני  → ״ממתין לשליחה״ + ניסיון שליחה הבא + שגיאה אחרונה: מתג סגור ·
//            מחוץ לחלון · אין ספק · תקלת ספק חולפת. רק תקלת ספק נספרת כניסיון.
//  לפני הקריאה לספק: ״שולח״. תשובה לא ברורה (timeout אחרי הבקשה, חריגה) →
//  ״דורש בירור״, בלי retry אוטומטי. מזהה חיצוני מלא = לעולם לא שולחים שוב.
//  הצלחה: ״נשלח״ + מועד + מזהה, ואז שורת יומן עם ״תהליך״ — שמעירה את המנוע.
// כן ═══════════════════════════════════════════════════════════════

const SEND_VERSION = '1.3.0';   // 2026-09-08 · 1.1: קבוע/זמני · שולח · דורש בירור · retry · שליחה_מתאריך · 1.2: שער התיישנות לפני שליחה · 1.3: שער טרי רגע לפני הקריאה לספק

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


const S  = await loadSettings();
const MS = await loadMessagingSettings();
console.log(`⚙ send ${SEND_VERSION} · ${S.env} · ספק ${MS.msgProvider || 'אין'} · מתגים ${S.outbound && S.external ? 'פתוחים' : 'סגורים'}`);

const MSGS    = base.getTable('הודעות');
const LEADS   = base.getTable('לידים');
const JOURNAL = base.getTable('יומן מגעים');

const M = { title:'תיאור', lead:'ליד', proc:'תהליך', round:'סבב', text:'טיוטה', state:'מצב', sentAt:'מועד שליחה',
            why:'סיבת חסימה', ext:'מזהה חיצוני', next:'ניסיון שליחה הבא', attempts:'מספר ניסיונות שליחה', lastErr:'שגיאה אחרונה',
            created:'מועד יצירה' };
const L = { name:'שם ליד', phone:'טלפון מתוקן', dnc:'אין ליצור קשר', personal:'טיפול אישי',
            sale:'סטטוס מכירה', log:'יומן מגעים' };
const J = { title:'תיאור', lead:'לידים', type:'סוג מגע', dir:'כיוון', res:'תוצאה', when:'מועד מגע',
            proc:'תהליך', who:'מי ביצע', src:'מקור הרשומה', detail:'פירוט', commit:'מועד שנקבע' };
for (const n of Object.values(M)) if (!MSGS.fields.some(f => f.name === n))    throw new Error(`⛔ השדה "${n}" חסר בטבלת הודעות.`);
for (const n of Object.values(L)) if (!LEADS.fields.some(f => f.name === n))   throw new Error(`⛔ השדה "${n}" חסר בטבלת לידים.`);
for (const n of Object.values(J)) if (!JOURNAL.fields.some(f => f.name === n)) throw new Error(`⛔ השדה "${n}" חסר ביומן המגעים.`);

const TZ = 'Asia/Jerusalem';
function nowInIsrael() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const get = t => (parts.find(p => p.type === t) || {}).value;
    return { day: get('weekday'), hm: `${get('hour')}:${get('minute')}` };
}
//  חלון = "HH:MM-HH:MM". ריק = סגור. חגים לא נבדקים — אין נתונים, לא מנחשים.
function inWindow() {
    const { day, hm } = nowInIsrael();
    const key = day === 'Fri' ? 'ו' : day === 'Sat' ? 'מוצש' : 'א-ה';
    const w = S.windows[key];
    if (!w) return { ok:false, why:`מחוץ לחלון: אין חלון ל${key}` };
    const m = w.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    if (!m) throw new Error(`⛔ חלון "${key}" אינו בפורמט HH:MM-HH:MM: "${w}"`);
    return (hm >= m[1] && hm <= m[2]) ? { ok:true } : { ok:false, why:`מחוץ לחלון: ${key} ${w}, עכשיו ${hm}` };
}
//  שער ההתיישנות — הודעה שאושרה ואז התרחש מגע שמשנה את ההקשר לא נשלחת.
//  אותם כללים בדיוק כמו במנוע: אירוע איפוס (הלקוח פנה · שיחה שנענתה ·
//  פגישה שהתקיימה) או הודעה יוצאת ידנית שמחליפה את מטרת הטיוטה.
//  שיחה שלא נענתה אינה מיישנת. נבדק רגע לפני הקריאה לספק (שחר, 8.9.2026).
const IN_DIR = 'נכנס — הלקוח פנה';
const MANUAL_OUT = ['הודעת WhatsApp', 'הודעה שנשלחה'];
//  מ-30.9.2026: גם סגירת עסקה וגם התחייבות שנקבעה מיישנות, זהה למנוע
//  2.7.0. שתי השכבות חייבות להסכים — שער ששוקל אחרת מהמנוע הוא בדיוק
//  סוג הבאג שהשער הזה נועד למנוע.
const J_COMMIT = 'מועד שנקבע';
async function isStale(lead, createdAt) {
    if (!createdAt) return false;
    const t0 = new Date(createdAt).getTime();
    const jq = await JOURNAL.selectRecordsAsync({ fields: Object.values(J) });
    return (lead.getCellValue(L.log) || []).map(x => jq.records.find(r => r.id === x.id))
        .filter(r => r && r.getCellValue(J.when))
        .some(r => {
            if (new Date(r.getCellValue(J.when)).getTime() <= t0) return false;
            const ty = r.getCellValueAsString(J.type), di = r.getCellValueAsString(J.dir);
            const re = r.getCellValueAsString(J.res),  pr = r.getCellValueAsString(J.proc);
            const reset  = di === IN_DIR || (ty === 'שיחת טלפון' && re === 'ענה') || (ty === 'פגישה או התנסות' && re === 'התקיים');
            const manual = di !== IN_DIR && MANUAL_OUT.includes(ty) && !pr;
            const closed = ty === 'עסקה נסגרה';
            const commit = !!r.getCellValue(J_COMMIT);
            return reset || manual || closed || commit;
        });
}

//  ── השער הטרי ────────────────────────────────────────────────────
//  נקרא מחדש מהבסיס רגע לפני הקריאה לספק. כל הבדיקות שלמעלה עבדו על
//  רשומות שנטענו בתחילת הריצה; בין הטעינה לשליחה יכול היה להיכנס מגע,
//  להיסגר עסקה או להשתנות סטטוס. השער הזה סוגר את החלון הזה, ולכן הוא
//  קורא מחדש ואינו מסתמך על מה שכבר בזיכרון (שחר, 30.9.2026).
//  מחזיר kind: ok · skip (לא נוגעים, מישהו אחר מטפל) · block (חסימה
//  קבועה) · stale (התיישן).
const TERMINAL_SALE = ['נסגרה עסקה', 'לא רלוונטי / נפלה עסקה'];
async function freshGuard(leadId, createdAt) {
    const m2 = (await MSGS.selectRecordsAsync({ fields: Object.values(M) })).getRecord(msgId);
    if (!m2) return { kind:'skip', why:'ההודעה נמחקה' };
    const st = m2.getCellValueAsString(M.state);
    if (st !== 'מאושר')              return { kind:'skip',  why:`מצב ההודעה השתנה ל״${st}״` };
    if (m2.getCellValueAsString(M.ext)) return { kind:'skip', why:'נוצר מזהה חיצוני בינתיים' };

    const l2 = (await LEADS.selectRecordsAsync({ fields: Object.values(L) })).getRecord(leadId);
    if (!l2)                          return { kind:'skip',  why:'הליד נמחק' };
    if (l2.getCellValue(L.dnc))       return { kind:'block', why:'אין ליצור קשר' };
    if (l2.getCellValue(L.personal))  return { kind:'block', why:'טיפול אישי' };
    const sale = l2.getCellValueAsString(L.sale);
    if (TERMINAL_SALE.includes(sale)) return { kind:'stale', why:`סטטוס מכירה סופי: ${sale}` };
    if (await isStale(l2, createdAt)) return { kind:'stale', why:'התרחש מגע חדש אחרי יצירת הטיוטה' };
    return { kind:'ok', why:'' };
}

//  הספק. mock בלבד היום — אין קוד רשת. whatsapp יתווסף כאן, ורק כאן.
//  מחזיר { ok:true, id } או { ok:false, kind: transient | permanent | ambiguous, why }.
const IMPLEMENTED = ['mock', 'mock-transient', 'mock-ambiguous'];
async function sendViaProvider(provider, text, phone) {
    if (provider === 'mock')           return { ok:true, id:`mock-${Date.now()}` };
    if (provider === 'mock-transient') return { ok:false, kind:'transient', why:'mock: תקלה חולפת' };
    if (provider === 'mock-ambiguous') return { ok:false, kind:'ambiguous', why:'mock: timeout אחרי הבקשה' };
    return { ok:false, kind:'ambiguous', why:`ספק ${provider} לא ממומש` };
}

const msgId = input.config().messageId;
const mq  = await MSGS.selectRecordsAsync({ fields: Object.values(M) });
const msg = mq.getRecord(msgId);
const attempts = msg.getCellValue(M.attempts) || 0;
const plusMinutes = n => new Date(Date.now() + n * 60000).toISOString();

async function block(why) {
    await MSGS.updateRecordAsync(msgId, { [M.state]: { name:'נחסם' }, [M.why]: why });
    console.log(`⛔ נחסם (קבוע): ${why} · ${msg.name}`);
}
async function wait(why, counted) {
    const f = { [M.state]: { name:'ממתין לשליחה' }, [M.lastErr]: why, [M.next]: plusMinutes(MS.retryMinutes) };
    if (counted) f[M.attempts] = attempts + 1;
    await MSGS.updateRecordAsync(msgId, f);
    console.log(`⏳ ממתין לשליחה: ${why} · ניסיון ${counted ? attempts + 1 : attempts}/${MS.maxAttempts} · הבא בעוד ${MS.retryMinutes} דק׳ · ${msg.name}`);
}
async function investigate(why) {
    await MSGS.updateRecordAsync(msgId, { [M.state]: { name:'דורש בירור' }, [M.lastErr]: why, [M.attempts]: attempts + 1 });
    console.log(`❓ דורש בירור: ${why} · ${msg.name}. אין retry אוטומטי עד אימות מול הספק.`);
}

if (msg.getCellValueAsString(M.state) !== 'מאושר') { console.log(`· ${msg.name} — המצב אינו ״מאושר״, לא נשלח`); }
else if (msg.getCellValueAsString(M.ext))           { await block('כבר קיים מזהה חיצוני — נשלח בעבר'); }
else {
const text  = (msg.getCellValueAsString(M.text) || '').trim();
const links = msg.getCellValue(M.lead) || [];
const lq    = await LEADS.selectRecordsAsync({ fields: Object.values(L) });
const lead  = links.length ? lq.getRecord(links[0].id) : null;
const created = String(msg.getCellValue(M.created) || '').slice(0, 10);
const phone = lead ? lead.getCellValueAsString(L.phone) : '';

// ── קבועים קודם — אין טעם לחכות למשהו שלא יתוקן לבד ─────────────
if (MS.sendFrom && created && created < MS.sendFrom) await block(`לפני תאריך ההפעלה (${MS.sendFrom})`);
else if (!text)                                      await block('טיוטה ריקה');
else if (!lead)                                      await block('אין ליד מקושר');
else if (lead.getCellValue(L.dnc))                   await block('אין ליצור קשר');
else if (lead.getCellValue(L.personal))              await block('טיפול אישי');
else if (!/^\+9725\d{8}$/.test(phone))               await block(`טלפון פסול: "${phone || '(ריק)'}"`);
else if (await isStale(lead, msg.getCellValue(M.created))) {
    await MSGS.updateRecordAsync(msgId, { [M.state]: { name:'התיישן' } });
    console.log(`⌛ ${msg.name} — התרחש מגע חדש אחרי יצירת הטיוטה. לא נשלח.`);
}
// ── זמניים — השהיה מנהלתית, לא ניסיון ──────────────────────────
else if (S.outbound !== true)                        await wait('שליחה_מופעלת ≠ true', false);
else if (S.external !== true)                        await wait('פעולות_חיצוניות_מופעלות ≠ true', false);
else if (!inWindow().ok)                             await wait(inWindow().why, false);
else if (!MS.msgProvider)                            await wait('אין ספק מוגדר', false);
else if (!IMPLEMENTED.includes(MS.msgProvider))      await wait(`ספק ${MS.msgProvider} טרם ממומש`, false);
else if (attempts >= MS.maxAttempts)                 await block(`עברו ${attempts} ניסיונות שליחה`);
else {
    // ── השער האחרון, ואז ״שולח״ לפני הקריאה ─────────────────────
    const gate = canSendOutbound(S, lead, L);
    const fresh = gate.ok ? await freshGuard(lead.id, msg.getCellValue(M.created)) : { kind:'ok' };
    if (!gate.ok) { await wait(gate.why, false); }
    else if (fresh.kind === 'skip')  { console.log(`· ${msg.name} — ${fresh.why}. לא נשלח.`); }
    else if (fresh.kind === 'block') { await block(fresh.why); }
    else if (fresh.kind === 'stale') {
        await MSGS.updateRecordAsync(msgId, { [M.state]: { name:'התיישן' } });
        console.log(`⌛ ${msg.name} — ${fresh.why}. לא נשלח.`);
    }
    else {
        await MSGS.updateRecordAsync(msgId, { [M.state]: { name:'שולח' }, [M.attempts]: attempts + 1 });
        let r;
        try { r = await sendViaProvider(MS.msgProvider, text, phone); }
        catch (e) { r = { ok:false, kind:'ambiguous', why:`חריגה: ${e.message || e}` }; }

        if (r.ok) {
            await MSGS.updateRecordAsync(msgId, { [M.state]: { name:'נשלח' }, [M.sentAt]: new Date().toISOString(), [M.ext]: r.id, [M.lastErr]: '' });
            await JOURNAL.createRecordAsync({
                [J.title]: `${msg.getCellValueAsString(M.proc)} · ${lead.name}`,
                [J.lead]:  [{ id: lead.id }],
                [J.type]:  { name:'הודעת WhatsApp' },
                [J.dir]:   { name:'יוצא — אנחנו פנינו' },
                [J.res]:   { name:'נשלח בהצלחה' },
                [J.when]:  new Date().toISOString(),
                [J.proc]:  { name: msg.getCellValueAsString(M.proc) },
                [J.who]:   { name:'המערכת' },
                [J.src]:   { name:'נוצר אוטומטית' },
                [J.detail]: text,
            });
            console.log(`✅ נשלח · ${msg.name} · ${phone} · ${r.id}`);
        }
        else if (r.kind === 'transient') {
            if (attempts + 1 >= MS.maxAttempts) await block(`עברו ${attempts + 1} ניסיונות שליחה: ${r.why}`);
            else await MSGS.updateRecordAsync(msgId, { [M.state]: { name:'ממתין לשליחה' }, [M.lastErr]: r.why, [M.next]: plusMinutes(MS.retryMinutes) })
                .then(() => console.log(`⏳ ממתין לשליחה: ${r.why} · ניסיון ${attempts + 1}/${MS.maxAttempts} · ${msg.name}`));
        }
        else if (r.kind === 'permanent') { await block(r.why); }
        else { await investigate(r.why); }
    }
}}
