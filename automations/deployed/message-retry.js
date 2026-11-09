// ═══════════════════════════════════════════════════════════════
//  ניסיון חוזר — Message Retry · RETRY_VERSION
//
//  טריגר:  At scheduled time · כל שעה. אין input variables.
//  מוצא הודעות ״ממתין לשליחה״ שהגיע מועד הניסיון שלהן ומחזיר אותן
//  ל״מאושר״. זה הכל. Message Sending הוא הדלת היחידה, והוא בודק הכל
//  מחדש: מתגים, DNC, טיפול אישי, חלון, ספק, מזהה חיצוני.
//  לעולם לא נוגע ב: נשלח · נחסם · נדחה · שולח · דורש בירור · ממתין לאישור.
// ═══════════════════════════════════════════════════════════════

const RETRY_VERSION = '1.0.0';

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
const MSGS = base.getTable('הודעות');
const M = { state:'מצב', next:'ניסיון שליחה הבא', ext:'מזהה חיצוני' };
for (const n of Object.values(M)) if (!MSGS.fields.some(f => f.name === n)) throw new Error(`⛔ השדה "${n}" חסר בטבלת הודעות.`);

const now = Date.now();
const q = await MSGS.selectRecordsAsync({ fields: Object.values(M) });
const due = q.records.filter(r => r.getCellValueAsString(M.state) === 'ממתין לשליחה'
    && !r.getCellValueAsString(M.ext)
    && r.getCellValue(M.next) && new Date(r.getCellValue(M.next)).getTime() <= now);
const waiting = q.records.filter(r => r.getCellValueAsString(M.state) === 'ממתין לשליחה').length;

for (let i = 0; i < due.length; i += 50)
    await MSGS.updateRecordsAsync(due.slice(i, i + 50).map(r => ({ id: r.id, fields: { [M.state]: { name:'מאושר' } } })));

console.log(`↻ retry ${RETRY_VERSION} · ${S.env} · ממתינות ${waiting} · הוחזרו לאישור ${due.length} · ספק ${MS.msgProvider || 'אין'} · מתגים ${S.outbound && S.external ? 'פתוחים' : 'סגורים'}`);
