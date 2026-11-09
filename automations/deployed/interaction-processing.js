// ═══════════════════════════════════════════════════════════════
//  מנוע הגזירה המרכזי — Lead Recalculation
//
//  ENGINE_VERSION נרשם בלוג של כל ריצה. הקובץ הזה הוא ה-source of
//  truth היחיד; שתי האוטומציות ב-Airtable הן deployments של אותו
//  קוד. אם הלוגים של שתיהן מראים גרסה שונה — אחת מהן מיושנת.
//
//   A1a · Interaction Processing · שורה חדשה ביומן → interactionId
//   A1b · Lead Inputs Changed    · שינוי בשדה קלט   → leadId
//
//  A1b מאזינה לשדות ה*קלט* בלבד:
//      מועד שנקבע · סוג ההתחייבות · סטטוס מכירה · אין ליצור קשר
//  לעולם לא לשדות שהמנוע כותב — מצב טיפול · פעולה הבאה ·
//  תאריך הטיפול הבא · פעילות אחרונה · מספר פניות · דורש בדיקה · סבב נוכחי.
//  ─────────────────────────────────────────────────────────────
//  1. חישוב מלא ולא הגדלה — הרצה כפולה אינה מזיקה.
//  2. אינו מסיק "סטטוס מכירה" לעולם — לא מקדם לחם ולא סוגר עסקה
//     מתוך נתונים. הכתיבה היחידה המותרת אליו היא תרגום של אירוע
//     אנושי מפורש: שורת יומן מסוג "עסקה נסגרה" שאדם יצר בטופס.
//  3. אינו ממציא: אין מועד → אין תאריך. אין הגדרה → אין תאריך.
//  4. רץ בבסיס נקי: אין תלות בשדות מיגרציה. מה שכן — בבלוק LEGACY.
//
//  סבבי מעקב: סבב נפתח על שיחה יוצאת "לא ענה", אבל רק אם הודעת
//  הסבב הקודם כבר נשלחה. כמה שיחות ללא מענה לפני שההודעה יצאה
//  נשארות באותו סבב — כולן נרשמות ונספרות כפניות, רק לוח המעקב
//  לא מתקדם (שחר, 8.9.2026). תגובה נכנסת,
//  שיחה שנענתה או פגישה שהתקיימה מאפסות את הרצף; רצף חדש מתחיל
//  מהאירוע העסקי החדש. שורות בלי מועד מגע אינן נספרות לעולם.
//  אחרי הסבב האחרון: תאריך ופעולה ריקים, "דורש בדיקה" מסומן.
//  זה מצב טכני זמני עד תשובת בר — לא החלטה עסקית.
// ═══════════════════════════════════════════════════════════════

const ENGINE_VERSION = '2.8.0';   // 2026-09-08 · 2.0: סבבים · הגדרות · LEGACY · 2.1: ״סבב נוכחי״ · 2.2: סבב מתקדם רק אחרי הודעה שנשלחה · התחייבות מהיומן · טיוטות מיושנות · פגישה שבוטלה · 2.2.1: ״חזרה לבקשת הלקוח״ · 2.3: ולידציה של צירוף סוג/כיוון/תוצאה · 2.3.1: התחייבות נקראת גם משורה שאינה אינטראקציה · 2.4: חוב תגובה פתוח · 2.5: סגירת עסקה · 2.5.1: ״פירוט עסקה״ נטען דרך L · 2.6: סגירת עסקה מהטופס · 2.6.1: דגל הנתונים החסרים נבדק על הערכים האפקטיביים · 2.7: התיישנות חלה גם על הודעה שאושרה וטרם נשלחה · 2.8: תאריך אחרי מגע שסגר התחייבות · ניקוי התחייבות שמומשה

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

const S = await loadSettings();
console.log(`⚙ engine ${ENGINE_VERSION} · ${S.env} · ${base.name} · סבבים ${S.maxRounds} · מרווחים [${S.gaps.join(', ')}]`);

const LEADS   = base.getTable('לידים');
const JOURNAL = base.getTable('יומן מגעים');

const L = { name:'שם ליד',
            proc:'מצב טיפול', act:'פעולה הבאה', due:'תאריך הטיפול הבא', last:'פעילות אחרונה',
            cnt:'מספר פניות', sale:'סטטוס מכירה', dnc:'אין ליצור קשר', flag:'דורש בדיקה',
            personal:'טיפול אישי', commit:'מועד שנקבע', ctype:'סוג ההתחייבות', round:'סבב נוכחי',
            log:'יומן מגעים', created:'תאריך כניסה', line:'קו מוצר',
            dealDate:'תאריך סגירת עסקה', bought:'כמה נרכשו', amount:'סכום עסקה',
            dealNote:'פירוט עסקה' };
const J = { type:'סוג מגע', dir:'כיוון', res:'תוצאה', when:'מועד מגע', proc:'תהליך', lead:'לידים',
            commit:'מועד שנקבע', ctype:'סוג ההתחייבות', bought:'כמה נרכשו', amount:'סכום עסקה',
            title:'תיאור', who:'מי ביצע', src:'מקור הרשומה', detail:'פירוט' };
//  שכבת ההודעות — המנוע נוגע בה רק כדי ליישן טיוטה שאיבדה רלוונטיות.
const MSGS = base.getTable('הודעות');
const M = { lead:'ליד', state:'מצב', created:'מועד יצירה', proc:'תהליך' };

//  שדות ליבה — חייבים להתקיים בכל בסיס. מחיקה שקטה = חישוב שגוי.
for (const n of Object.values(L))
    if (!LEADS.fields.some(f => f.name === n)) throw new Error(`⛔ השדה "${n}" חסר בטבלת לידים. המנוע לא ירוץ.`);
for (const n of Object.values(J))
    if (!JOURNAL.fields.some(f => f.name === n)) throw new Error(`⛔ השדה "${n}" חסר ביומן המגעים. המנוע לא ירוץ.`);
for (const n of Object.values(M))
    if (!MSGS.fields.some(f => f.name === n)) throw new Error(`⛔ השדה "${n}" חסר בטבלת הודעות. המנוע לא ירוץ.`);

// ── LEGACY — DEV בלבד, אופציונלי. בבסיס נקי הבלוק הזה אינו עושה דבר ──
//  "פניות שלא תועדו": בסיס היסטורי לפניות שמעולם לא תועדו ביומן.
//  אין שדה → בסיס 0, והמספר נגזר מהיומן בלבד.
const LEGACY = { baselineField: 'פניות שלא תועדו' };
const fBase  = LEADS.fields.find(f => f.name === LEGACY.baselineField) || null;

const TERMINAL = ['נסגרה עסקה', 'לא רלוונטי / נפלה עסקה'];
const OUT = 'יוצא — אנחנו פנינו';
const IN  = 'נכנס — הלקוח פנה';
const CALL = 'שיחת טלפון', MEET = 'פגישה או התנסות';

//  נספרים כפנייה יוצאת (מדד בלבד — אינו קובע סבב). פגישה אינה כאן.
const COUNTS = ['שיחת טלפון', 'הודעת WhatsApp', 'הודעה שנשלחה', 'ניסיון יצירת קשר'];
const NOT_INTERACTION = ['יבוא סטטוס היסטורי', 'הערה פנימית', 'עסקה נסגרה'];

//  כשאדם מטפל או שהכדור אצלנו — הפעולה נגזרת משלב המכירה.
//  ליד חם: מעקב בשיחות ובהודעות (בר, 6.9). אין "לבדוק הצעה" יותר.
const SALE_ACT = {
    'ליד פוטנציאלי לפני פגישה': 'לתאם פגישה',
    'ליד חם':                   'להתקשר',
    'ליד חם אחרי פגישה':        'להתקשר',        // התווית הישנה, עד שינוי השם
    'רלוונטי לעתיד':            'לחזור בתאריך',
};

//  איזה סוג מגע סוגר איזו התחייבות. שיחה מקרית אינה סוגרת פגישה.
//  סוג התחייבות ריק → כל מגע מתוארך במועד או אחריו סוגר.
const FULFILLS = {
    'פגישה או התנסות': ['פגישה או התנסות'],
    'שיחה':            ['שיחת טלפון'],
    'חזרה לבקשת הלקוח': ['שיחת טלפון'],
    'חזרה שהלקוח ביקש': ['שיחת טלפון'],   // התווית הישנה, עד שכל הרשומות יעברו
};

const iso = d => d ? new Date(d).toLocaleDateString('en-CA', { timeZone:'Asia/Jerusalem' }) : null;
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const today = iso(Date.now());

// ── פתרון מזהה הליד משתי נקודות הכניסה ──────────────────────────
const cfg  = input.config();
const rows = await JOURNAL.selectRecordsAsync({ fields: Object.values(J) });
const src  = cfg.interactionId ? rows.records.find(r => r.id === cfg.interactionId) : null;

let leadId = cfg.leadId || null;
if (!leadId && cfg.interactionId) {
    if (!src) console.log(`⚠ שורת היומן לא נמצאה. מזהה: "${cfg.interactionId}" · סוג: ${typeof cfg.interactionId}`);
    else {
        const links = src.getCellValue(J.lead) || [];
        if (!links.length) console.log('אין קישור לליד — השורה קיימת אך לא מקושרת');
        else leadId = links[0].id;
    }
}

if (!leadId) {
    console.log('אין ליד לחישוב — לא בוצע דבר');
} else {

const lq   = await LEADS.selectRecordsAsync({ fields: Object.values(L).concat(fBase ? [fBase.id] : []) });
const lead = lq.getRecord(leadId);

const type = r => r.getCellValueAsString(J.type);
const dir  = r => r.getCellValueAsString(J.dir);
const res  = r => r.getCellValueAsString(J.res);
const proc = r => r.getCellValueAsString(J.proc);
const ts   = r => new Date(r.getCellValue(J.when)).getTime();

const mine  = (lead.getCellValue(L.log) || []).map(x => rows.records.find(r => r.id === x.id)).filter(Boolean);
const real  = mine.filter(r => !NOT_INTERACTION.includes(type(r)));
const dated = real.filter(r => r.getCellValue(J.when)).sort((a, b) => ts(a) - ts(b));   // עולה
const latest   = dated.length ? dated[dated.length - 1] : null;
const lastWhen = latest ? iso(latest.getCellValue(J.when)) : null;

//  סגירת עסקה — אירוע אנושי מפורש בלבד, לעולם לא הסקה (שחר, 10.9.2026).
//  שורת יומן מסוג "עסקה נסגרה" היא ההצהרה; הליד הוא ההשלכה שלה.
const closeRow = mine.filter(r => type(r) === 'עסקה נסגרה')
    .sort((a, b) => new Date(a.getCellValue(J.when) || 0) - new Date(b.getCellValue(J.when) || 0)).pop() || null;
const sale = closeRow ? 'נסגרה עסקה' : lead.getCellValueAsString(L.sale);
const dnc  = !!lead.getCellValue(L.dnc);
const cur  = lead.getCellValueAsString(L.proc);

// ── התחייבות — פעילה גם אחרי שהמועד עבר, עד מגע מהסוג שהתחייבנו לו ──
//  המקור הוא שורת היומן. הליד הוא ההשלכה שהמנוע מתחזק (שחר, 8.9.2026).
//  אין שורה עם מועד → נשמר מה שכבר על הליד, כדי לא למחוק התחייבויות ותיקות.
//  התחייבות נקראת מכל שורה שנושאת מועד, גם ״הערה פנימית״ שאינה
//  נספרת כאינטראקציה. אחרת מועד שנרשם בשורת הערה היה נבלע בשקט.
const commitRows = mine.filter(r => r.getCellValue(J.commit) && r.getCellValue(J.when))
    .sort((a, b) => ts(a) - ts(b));
const commitRow  = commitRows.length ? commitRows[commitRows.length - 1] : null;
const commitRaw  = commitRow ? commitRow.getCellValue(J.commit) : lead.getCellValue(L.commit);
const commit     = commitRaw ? iso(commitRaw) : null;
const cType      = commitRow ? commitRow.getCellValueAsString(J.ctype) : lead.getCellValueAsString(L.ctype);
const closers   = FULFILLS[cType] || null;
const fulfilled = !!commit && dated.some(r => {
    const w = iso(r.getCellValue(J.when));
    if (!w || w < commit) return false;
    return closers ? closers.includes(type(r)) : true;
});
const commitOn = commit && !fulfilled ? commit : null;

// ── חוב תגובה פתוח ──────────────────────────────────────────────
//  פנייה נכנסת פותחת חוב תגובה. החוב נסגר רק במענה יוצא שהצליח:
//  הודעה שנשלחה בפועל · שיחה שנענתה · פגישה שהתקיימה. ניסיון יוצא
//  שנכשל — בעיקר שיחה שלא נענתה — נרשם ביומן ונספר כפנייה, אבל
//  אינו מחזיר את הכדור ללקוח, אינו סוגר את החוב ואינו פותח סבב
//  (שחר, 9.9.2026).
const SENT_MSG = ['הודעת WhatsApp', 'הודעה שנשלחה'];
const resolvesInbound = r => (type(r) === CALL && res(r) === 'ענה')
    || (type(r) === MEET && res(r) === 'התקיים')
    || (dir(r) === OUT && SENT_MSG.includes(type(r)) && res(r) === 'נשלח בהצלחה');
let inIdx = -1;
dated.forEach((r, i) => { if (dir(r) === IN) inIdx = i; });
const inboundOpen = inIdx >= 0 && !dated.slice(inIdx + 1).some(resolvesInbound);

// ── סבבי מעקב ──────────────────────────────────────────────────
//  איפוס = תגובה נכנסת · שיחה שנענתה · פגישה שהתקיימה.
//  הרצף הנוכחי = כל מה שאחרי האיפוס האחרון. סבב = שיחה יוצאת "לא ענה".
const isReset = r => dir(r) === IN
    || (type(r) === CALL && res(r) === 'ענה')
    || (type(r) === MEET && res(r) === 'התקיים');
let resetIdx = -1;
dated.forEach((r, i) => { if (isReset(r)) resetIdx = i; });
const seq      = dated.slice(resetIdx + 1);
//  אשכול = רצף שיחות ללא מענה עד שיוצאת הודעת הסבב. אשכול = סבב אחד.
//  שיחה נוספת בתוך אשכול פתוח מעדכנת את מועד היעד ולא פותחת סבב חדש.
const isNoAnswer = r => type(r) === CALL && dir(r) === OUT && res(r) === 'לא ענה';
const isRoundMsg = r => dir(r) === OUT && proc(r) === 'הודעת סבב';
let round = 0, lastCall = null, msgSince = true;
for (const r of seq) {
    if (isNoAnswer(r)) { if (msgSince) { round++; msgSince = false; } lastCall = r; }
    else if (isRoundMsg(r)) msgSince = true;
}
//  חוב תגובה פתוח → אין סבב. השיחות עצמן נשארות ביומן ונספרות.
if (inboundOpen) { round = 0; lastCall = null; msgSince = true; }
const callDate = lastCall ? iso(lastCall.getCellValue(J.when)) : null;
//  הודעת הסבב הנוכחי כבר יצאה? רק אז מותר לסבב הבא להיפתח.
const roundMsg = round > 0 && msgSince;

// ── 1 · מספר פניות — מדד, לא מנגנון ─────────────────────────────
const outbound   = real.filter(r => COUNTS.includes(type(r)) && dir(r) === OUT);
const curCnt     = lead.getCellValue(L.cnt);
const derivedCnt = outbound.length;
const baseline   = fBase ? lead.getCellValue(fBase.id) : null;
//  LEGACY: בסיס ריק + יומן ריק + מספר ריק = "לא ידוע", נשאר ריק.
//  קורה רק כשיש שדה legacy. בבסיס נקי המספר תמיד נגזר מהיומן.
const newCnt = (fBase && baseline === null && derivedCnt === 0 && curCnt === null)
    ? null : (baseline || 0) + derivedCnt;

// ── 2 · פעילות אחרונה = max(תאריך כניסה, מועד המגע האחרון) ──────
const curLast = iso(lead.getCellValue(L.last));
const cands   = [iso(lead.getCellValue(L.created)), lastWhen].filter(Boolean).sort();
const newLast = cands.length ? cands[cands.length - 1] : undefined;

// ── 3 · מצב טיפול ───────────────────────────────────────────────
function deriveState() {
    if (dnc) return 'הסתיים';                              // השער העליון
    if (!latest) {
        if (TERMINAL.includes(sale)) return 'הסתיים';
        if (commitOn) return 'ממתין למועד';
        return cur || 'ממתין לפנייה';                      // LEGACY-סובלני: מצב קיים נשמר; ליד חדש → פתיחה
    }
    if (inboundOpen) return 'התקבלה תגובה';                 // חוב תגובה פתוח. גובר על סטטוס סופי
    if (TERMINAL.includes(sale)) return 'הסתיים';
    if (commitOn) return 'ממתין למועד';                    // התחייבות פעילה, גם אם עברה
    if (type(latest) === CALL) return res(latest) === 'ענה' ? 'בטיפול' : 'ממתין לתגובה';
    if (type(latest) === MEET) return 'בטיפול';
    return 'ממתין לתגובה';                                 // הודעה, הצעת מחיר, ניסיון
}
const newProc = deriveState();

// ── 4 · פעולה הבאה + תאריך ──────────────────────────────────────
//  נגזרים בכל הרצה, לעולם לא בירושה. null = אין פעולה אוטומטית.
let newAct = null, newDue = null, needsReview = false;

if (dnc || newProc === 'הסתיים') {
    newAct = 'אין פעולה';
} else if (newProc === 'התקבלה תגובה') {
    newAct = 'להשיב ללקוח';  newDue = today;
} else if (newProc === 'ממתין למועד') {
    newAct = cType === MEET ? 'לקיים פגישה' : 'להתקשר';  newDue = commitOn;
} else if (newProc === 'ממתין לפנייה') {
    //  הכדור אצלנו ואף מגע לא נרשם. ליד חדש → הודעת פתיחה, עכשיו.
    if (sale === 'חדש') { newAct = 'לשלוח הודעה'; newDue = today; }
    else { newAct = SALE_ACT[sale] || 'להתקשר'; }
} else if (newProc === 'בטיפול') {
    //  פגישה שבוטלה ולא נקבע מועד חדש באותו מגע — הליד לא נסגר,
    //  חוזרים ללקוח לקבוע המשך (שחר, 8.9.2026). נקבע מועד חדש באותה
    //  שורה → ההתחייבות החדשה תופסת והמצב כבר ״ממתין למועד״.
    if (latest && type(latest) === MEET && res(latest) === 'בוטל') { newAct = 'לתאם פגישה'; newDue = today; }
    //  ההתחייבות מומשה והכדור חזר אלינו. פעולה בלי תאריך נופלת לדוח
    //  התקועים כ״אין תאריך להמשך״ אף שלא קרה שום דבר רע — הפגישה פשוט
    //  התקיימה. היום הוא התאריך הנכון: יש מה לעשות, ועכשיו (שחר, 30.9.2026).
    else { newAct = SALE_ACT[sale] || 'להתקשר'; newDue = today; }
} else {
    //  ממתין לתגובה — לוח הזמנים של הסבבים, נמדד ממועד השיחה, לא מרגע התיעוד.
    if (round === 0) {
        newAct = 'להתקשר';  newDue = lastWhen;                 // אחרי הודעת פתיחה: השיחה באותו יום
    } else if (!roundMsg) {
        newAct = 'לשלוח הודעה';  newDue = callDate;            // לא ענה → הודעה, באותו יום
    } else if (round < S.maxRounds) {
        newAct = 'להתקשר';  newDue = addDays(callDate, S.gaps[round - 1]);
    } else {
        //  הסבב האחרון הסתיים. אין follow-up אוטומטי, אין סטטוס חדש,
        //  אין פעולה מומצאת. הליד נשאר גלוי דרך "דורש בדיקה" ודוח התקועים.
        //  זמני עד תשובת בר על מה קורה אחרי הסבב הרביעי.
        needsReview = true;
    }
}

// ── ולידציה: צירוף סוג מגע · כיוון · תוצאה ──────────────────────
//  איירטייבל לא יודע להגביל את רשימת הערכים לפי הקשר, ולכן הבדיקה כאן
//  (שחר, 8.9.2026). לא נוגעים בשורת היומן — היא האמת — רק מסמנים
//  ״דורש בדיקה״ כדי שהליד יצוף בעמוד החריגות ואדם יתקן.
//  בפנייה נכנסת התוצאה אינה בשימוש ולכן אינה נבדקת.
const VALID_RES = {
    'שיחת טלפון':      ['ענה', 'לא ענה'],
    'הודעת WhatsApp':  ['נשלח בהצלחה', 'נכשל'],
    'הודעה שנשלחה':    ['נשלח בהצלחה', 'נכשל'],
    'פגישה או התנסות': ['התקיים', 'בוטל'],
};
const badRows = dated.filter(r => {
    const allowed = VALID_RES[type(r)];
    if (!allowed) return false;
    if (type(r) !== MEET && dir(r) !== OUT) return false;
    const v = res(r);
    return !!v && !allowed.includes(v);
});
//  עסקה שנסגרה בלי נתונים מסחריים לא נעלמת מהעבודה (שחר, 8.9.2026).
//  נבדקים הערכים האפקטיביים — מה שיהיה על הליד בסוף הריצה הזו —
//  ולא מה שהיה עליו בתחילתה. אחרת סגירה מהטופס מדליקה דגל שווא,
//  כי הכמות והסכום נכתבים באותה ריצה עצמה (שחר, 10.9.2026).
const effBought = closeRow && closeRow.getCellValue(J.bought) !== null ? closeRow.getCellValue(J.bought) : lead.getCellValue(L.bought);
const effAmount = closeRow && closeRow.getCellValue(J.amount) !== null ? closeRow.getCellValue(J.amount) : lead.getCellValue(L.amount);
if (sale === 'נסגרה עסקה' && (effBought === null || effAmount === null)) {
    needsReview = true;
    console.log('⚠ נסגרה עסקה בלי כמה נרכשו או בלי סכום עסקה. מסומן דורש בדיקה.');
}
if (badRows.length) {
    needsReview = true;
    for (const r of badRows)
        console.log(`⚠ צירוף לא חוקי ביומן: ${type(r)} · ${dir(r) || '(אין כיוון)'} · ${res(r)} — ${iso(r.getCellValue(J.when))}. מסומן דורש בדיקה.`);
}

// ── כתיבה ───────────────────────────────────────────────────────
const f = {};
if (newProc !== cur)                                    f[L.proc] = { name:newProc };
if ((newAct || '') !== lead.getCellValueAsString(L.act)) f[L.act]  = newAct ? { name:newAct } : null;
if (newDue !== iso(lead.getCellValue(L.due)))           f[L.due]  = newDue;
if (newLast !== undefined && newLast !== curLast)       f[L.last] = newLast;
if (newCnt !== curCnt)                                  f[L.cnt]  = newCnt;
if (needsReview && !lead.getCellValue(L.flag))          f[L.flag] = true;   // רק מסמן. אדם מנקה.
if (round !== lead.getCellValue(L.round))               f[L.round] = round;  // פלט למנסח ההודעות
//  ההתחייבות היא השלכה של היומן. נכתבת רק כשיש שורת יומן שנושאת מועד,
//  ומתנקה ברגע שמומשה או שהליד הגיע לסוף הדרך. התחייבות שכבר קרתה
//  אינה מועד עתידי, והשארתה גורמת למסכים להציג מועד שעבר כאילו הוא
//  עדיין תלוי ועומד (שחר, 30.9.2026). היומן נשאר המקור — מנקים את
//  ההשלכה בליד בלבד, ושורת המגע עם המועד לא נוגעים בה.
const commitDone = fulfilled || newProc === 'הסתיים' || TERMINAL.includes(sale) || dnc;
if (commitDone) {
    if (lead.getCellValue(L.commit))        f[L.commit] = null;
    if (lead.getCellValueAsString(L.ctype)) f[L.ctype]  = null;
} else if (commitRow) {
    const jc = commitRow.getCellValue(J.commit);
    const cc = commitRow.getCellValueAsString(J.ctype);
    const lc = lead.getCellValue(L.commit);
    if (jc && (!lc || new Date(jc).getTime() !== new Date(lc).getTime())) f[L.commit] = jc;
    if (cc !== lead.getCellValueAsString(L.ctype))                        f[L.ctype]  = cc ? { name:cc } : null;
}

//  השלכת נתוני העסקה מהאירוע לליד. הליד נשאר המקום שקוראים ממנו.
if (closeRow) {
    const cb = closeRow.getCellValue(J.bought);
    const ca = closeRow.getCellValue(J.amount);
    const cn = closeRow.getCellValueAsString(J.detail);
    const cd = iso(closeRow.getCellValue(J.when));
    if (lead.getCellValueAsString(L.sale) !== 'נסגרה עסקה')  f[L.sale]     = { name:'נסגרה עסקה' };
    if (cb !== null && cb !== lead.getCellValue(L.bought))    f[L.bought]   = cb;
    if (ca !== null && ca !== lead.getCellValue(L.amount))    f[L.amount]   = ca;
    if (cn && cn !== lead.getCellValueAsString(L.dealNote))   f[L.dealNote] = cn;
    if (cd && !lead.getCellValue(L.dealDate))                 f[L.dealDate] = cd;
}

const send = canSendOutbound(S, lead, L);
console.log(`· סבב ${round}/${S.maxRounds} · הודעת סבב ${roundMsg ? 'תועדה' : 'לא'} · שליחה ${send.ok ? 'פתוחה' : 'חסומה: ' + send.why}`);
if (Object.keys(f).length) {
    await LEADS.updateRecordAsync(leadId, f);
    console.log(`✅ ${lead.name}`, f);
} else {
    console.log(`· ${lead.name} — אין שינוי`);
}

// ── סגירת עסקה ──────────────────────────────────────────────────
//  נתוני העסקה נשארים על הליד — הוא ה-source of truth. היומן רק
//  מתעד את האירוע, בסוג מגע ייעודי שאינו נחשב אינטראקציה, כדי שלא
//  יזיז מצב טיפול, סבב, מספר פניות או פעילות אחרונה (שחר, 8.9.2026).
if (sale === 'נסגרה עסקה' && !closeRow) {
    if (!lead.getCellValue(L.dealDate)) {
        await LEADS.updateRecordAsync(leadId, { [L.dealDate]: today });
        console.log(`· ${lead.name} — נרשם תאריך סגירת עסקה ${today}`);
    }
    if (!mine.some(r => type(r) === 'עסקה נסגרה')) {
        const n    = lead.getCellValue(L.bought);
        const amt  = lead.getCellValue(L.amount);
        const unit = { 'מזרנים':'מזרנים', 'ציוד':'פריטים' }[lead.getCellValueAsString(L.line)] || 'רפורמרים';
        let txt = 'עסקה נסגרה';
        if (n)   txt += ` · ${n} ${unit}`;
        if (amt) txt += ` · ₪${Math.round(amt).toLocaleString('en-US')}`;
        await JOURNAL.createRecordAsync({
            [J.title]:  txt,
            [J.lead]:   [{ id: leadId }],
            [J.type]:   { name:'עסקה נסגרה' },
            [J.when]:   new Date().toISOString(),
            [J.who]:    { name:'המערכת' },
            [J.src]:    { name:'נוצר אוטומטית' },
            [J.detail]: lead.getCellValueAsString(L.dealNote) || '',
        });
        console.log(`💰 ${lead.name} — ${txt}`);
    }
}

// ── הודעות שטרם נשלחו והתיישנו ──────────────────────────────────
//  הודעה שטרם יצאה מאבדת רלוונטיות כשקרה מגע שמשנה את ההקשר:
//  אירוע איפוס (הלקוח פנה · שיחה שנענתה · פגישה שהתקיימה), התחייבות
//  שנקבעה, סגירת עסקה, או הודעה יוצאת ידנית שמחליפה את מטרתה.
//  שיחה שלא נענתה לבדה אינה מיישנת — היא בדיוק הסיבה שהודעת המעקב
//  קיימת (שחר, 8.9.2026).
//  ״התיישן״ אינו ״נדחה״: דחייה היא החלטה אנושית שחוסמת יצירה חוזרת
//  לאותו מפתח לנצח, והתיישנות רק מפנה את הדרך לטיוטה מעודכנת.
const MANUAL_OUT = ['הודעת WhatsApp', 'הודעה שנשלחה'];
//  כל מצב שבו ההודעה עדיין לא יצאה. אישור אינו שליחה — כל עוד ההודעה
//  לא עברה לספק היא חייבת להתיישן בדיוק כמו טיוטה, אחרת הודעת פתיחה
//  תצא ללקוח שכבר סגר עסקה (שחר, 30.9.2026).
const UNSENT = ['טיוטה', 'ממתין לאישור', 'מאושר', 'ממתין לשליחה'];
//  אירוע מיישן. נגזר מ-mine ולא מ-dated כי "עסקה נסגרה" אינה
//  אינטראקציה ולכן אינה ב-dated — והיא בדיוק אירוע שמייתר הודעה.
const supersedes = mine.filter(r => r.getCellValue(J.when) && (
       isReset(r)
    || type(r) === 'עסקה נסגרה'
    || r.getCellValue(J.commit)
    || (dir(r) === OUT && MANUAL_OUT.includes(type(r)) && !proc(r))
)).sort((a, b) => ts(a) - ts(b));
const lastSup = supersedes.length ? supersedes[supersedes.length - 1] : null;
//  סטטוס סופי או "אין ליצור קשר" מייתרים כל הודעה שטרם יצאה, בלי קשר
//  לתאריכים: אין על מה לפנות, וגם הודעה שנוצרה אחרי האירוע אינה תקפה.
const deadEnd = TERMINAL.includes(sale) || !!lead.getCellValue(L.dnc);
if (lastSup || deadEnd) {
    const supTs = lastSup ? ts(lastSup) : null;
    const mq = await MSGS.selectRecordsAsync({ fields: Object.values(M) });
    const stale = mq.records.filter(m => (m.getCellValue(M.lead) || []).some(x => x.id === leadId)
        && UNSENT.includes(m.getCellValueAsString(M.state))
        && (deadEnd || new Date(m.getCellValue(M.created)).getTime() < supTs));
    for (const m of stale) {
        await MSGS.updateRecordAsync(m.id, { [M.state]: { name:'התיישן' } });
        console.log(`⌛ ${m.name} → התיישן · ${deadEnd ? sale : type(lastSup)}`);
    }
    if (!stale.length) console.log('· אין הודעה שטרם נשלחה שהתיישנה');
}
}
