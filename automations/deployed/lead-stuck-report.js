// stuck-leads.js — לידים תקועים (B3) · STUCK_VERSION 2.0.0
//
//  רץ פעם ביום. עובר על הלידים הפעילים שנכנסו מתאריך החיתוך ומסמן
//  בשדה ״סיבת תקיעה״ למה הליד לא זז. דוח בלבד: לא משנה סטטוס, לא
//  פוסל, לא מזיז תאריך. אידמפוטנטי, והסימון נמחק מעצמו כשהסיבה נעלמת.
//
//  ״טיפול אישי״ חוסם שליחה אוטומטית בלבד — הליד נשאר בדוח.
//  ליד שסיים את סבבי המעקב מגיע לכאן דרך ״ללא תאריך״ (תאריך ריק).
//
//  אוטומציה: Lead Stuck Report · At scheduled time (יומי, בוקר) · Run script.
//  אין input variables. אזהרה: לא להוסיף ״סיבת תקיעה״ למעקב של Lead Inputs Changed.

const STUCK_VERSION = '2.0.0';

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
const DRY_RUN = false;   // true = רק לספור ולהדפיס, בלי לכתוב

const TZ = 'Asia/Jerusalem';
const L = {
    name: 'שם ליד', state: 'מצב טיפול', dnc: 'אין ליצור קשר', due: 'תאריך הטיפול הבא',
    owner: 'אחראי', last: 'פעילות אחרונה', action: 'פעולה הבאה', stuck: 'סיבת תקיעה',
    line: 'קו מוצר', created: 'תאריך כניסה', personal: 'טיפול אישי',
};
const R = { overdue: 'תאריך עבר', noOwner: 'ללא אחראי', noDate: 'ללא תאריך', idle: 'ללא פעילות' };
const ORDER = [R.overdue, R.noOwner, R.noDate, R.idle];

function todayISO() { return new Date().toLocaleDateString('en-CA', { timeZone: TZ }); }
function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000); }

const leads = base.getTable('לידים');
for (const f of Object.values(L)) {
    if (!leads.fields.find(x => x.name === f)) throw new Error(`⛔ השדה "${f}" חסר בטבלת לידים.`);
}

const today = todayISO();
const q = await leads.selectRecordsAsync({ fields: Object.values(L) });

//  בתחום הדוח = נכנס מתאריך החיתוך (או שאין חיתוך). ליד בלי תאריך כניסה
//  נבדק תמיד — עדיף לראות אותו מאשר לאבד אותו.
function inScope(r) {
    if (!S.cutoff) return true;
    const c = r.getCellValue(L.created);
    return !c || c >= S.cutoff;
}
//  ליד פעיל = לא הסתיים ולא DNC.
function isActive(r) {
    return !r.getCellValue(L.dnc) && r.getCellValueAsString(L.state) !== 'הסתיים';
}

function reasonsFor(r) {
    if (!inScope(r) || !isActive(r)) return [];
    const out = [];
    const due    = r.getCellValue(L.due);                // 'YYYY-MM-DD' או null
    const action = r.getCellValueAsString(L.action);

    if (due && due < today)                 out.push(R.overdue);   // תאריך עבר ולא בוצע
    if (!r.getCellValue(L.owner))           out.push(R.noOwner);   // אף אחד לא אחראי
    if (!due && action !== 'אין פעולה')     out.push(R.noDate);    // אין מתי — כולל סיום סבבים

    const thr = S.idle[r.getCellValueAsString(L.line)];            // סף לפי קו מוצר; ריק = לא נבדק
    if (thr !== null && thr !== undefined) {
        const last = r.getCellValue(L.last);
        if (!last || daysBetween(last, today) > thr) out.push(R.idle);
    }
    return out;
}

const counts  = Object.fromEntries(ORDER.map(k => [k, 0]));
const byOwner = {};
const updates = [];
let scope = 0, active = 0, stuck = 0;

for (const r of q.records) {
    if (inScope(r)) scope++;
    if (inScope(r) && isActive(r)) active++;
    const want = reasonsFor(r);
    const have = (r.getCellValue(L.stuck) || []).map(o => o.name);

    if (want.length) {
        stuck++;
        for (const k of want) counts[k]++;
        const o = r.getCellValueAsString(L.owner) || '— ללא אחראי';
        byOwner[o] = (byOwner[o] || 0) + 1;
    }
    //  כותבים רק כשמשתנה. ליד מחוץ לתחום עם סימון ישן — מנוקה.
    const same = want.length === have.length && want.every(k => have.includes(k));
    if (!same) updates.push({ id: r.id, fields: { [L.stuck]: want.map(name => ({ name })) } });
}

if (!DRY_RUN) {
    for (let i = 0; i < updates.length; i += 50) await leads.updateRecordsAsync(updates.slice(i, i + 50));
}

console.log(`לידים תקועים ${STUCK_VERSION} · ${S.env} · ${today}${DRY_RUN ? ' · DRY RUN' : ''} · חיתוך ${S.cutoff || 'אין'}`);
console.log(`בתחום: ${scope} · פעילים: ${active} · תקועים: ${stuck} · שונו: ${updates.length}`);
for (const k of ORDER) console.log(`  ${k}: ${counts[k]}`);
console.log(`  ספי ללא פעילות: ${Object.entries(S.idle).map(([l, v]) => `${l}=${v === null ? 'לא נבדק' : v}`).join(' · ')}`);
console.log('לפי אחראי:');
for (const [o, n] of Object.entries(byOwner).sort((a, b) => b[1] - a[1])) console.log(`  ${o}: ${n}`);
