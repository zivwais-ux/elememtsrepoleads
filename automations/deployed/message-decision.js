// ═══════════════════════════════════════════════════════════════
//  החלטה על הודעה — Message Decision · DECISION_VERSION
//
//  טריגר:  When record updated · הודעות · שדה מעקב: החלטה (בלבד)
//  קלט:    messageId  (Airtable record ID)
//
//  מתרגם את ההחלטה האנושית למצב הטכני, ולא להפך:
//    אשר → ״מאושר״   רק מהודעה ב״ממתין לאישור״
//    דחה → ״נדחה״    מהודעה ב״ממתין לאישור״, ״מאושר״ או ״ממתין לשליחה״ (ביטול לפני שליחה),
//                    וגם מ״נחסם״ או ״דורש בירור״ (אדם ראה את החריגה וסגר אותה; לא נשלח שוב)
//  כל מצב אחר: מתעלם ורושם בלוג. נשלח ו-שולח לא משתנים מכאן.
//  ״החלטה״ לא מנוקה — היא ה-audit של ההחלטה האנושית (שחר, 7.9.2026).
// ═══════════════════════════════════════════════════════════════

const DECISION_VERSION = '1.0.0';

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
const MSGS = base.getTable('הודעות');
const M = { title:'תיאור', state:'מצב', decision:'החלטה' };
for (const n of Object.values(M)) if (!MSGS.fields.some(f => f.name === n)) throw new Error(`⛔ השדה "${n}" חסר בטבלת הודעות.`);

const APPROVE_FROM = ['ממתין לאישור'];
const REJECT_FROM  = ['ממתין לאישור', 'מאושר', 'ממתין לשליחה', 'נחסם', 'דורש בירור'];

const msgId = input.config().messageId;
const q = await MSGS.selectRecordsAsync({ fields: Object.values(M) });
const msg = q.getRecord(msgId);
const state = msg.getCellValueAsString(M.state);
const decision = msg.getCellValueAsString(M.decision);
console.log(`⚙ decision ${DECISION_VERSION} · ${S.env} · ${msg.name} · מצב ${state || '(ריק)'} · החלטה ${decision || '(ריק)'}`);

if (!decision) console.log('· אין החלטה — לא בוצע דבר');
else if (decision === 'אשר') {
    if (APPROVE_FROM.includes(state)) { await MSGS.updateRecordAsync(msgId, { [M.state]: { name:'מאושר' } }); console.log('✅ אושר → מאושר. השולח מקבל את זה מכאן.'); }
    else console.log(`· ״אשר״ על הודעה במצב ״${state}״ — מתעלם. אישור רק מ״ממתין לאישור״.`);
}
else if (decision === 'דחה') {
    if (REJECT_FROM.includes(state)) { await MSGS.updateRecordAsync(msgId, { [M.state]: { name:'נדחה' } }); console.log(['נחסם','דורש בירור'].includes(state) ? '⛔ חריגה נסגרה על ידי אדם → נדחה. לא תישלח.' : '⛔ נדחה על ידי אדם.'); }
    else console.log(`· ״דחה״ על הודעה במצב ״${state}״ — מתעלם. הודעה שנשלחה לא משתנה מכאן.`);
}
else console.log(`⚠ החלטה לא מוכרת: "${decision}"`);
