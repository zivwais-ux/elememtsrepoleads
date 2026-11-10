// ═══════════════════════════════════════════════════════════════
//  whatsapp-core.js · WA_CORE 0.1.0 · טיוטה, לא פרוס
//
//  פונקציות טהורות לחיבור WhatsApp Cloud API. אין כאן רשת, אין
//  Airtable ואין גישה לשעון: כל זמן מגיע כפרמטר. כך הכל נבדק ב-node,
//  ואותו קוד יודבק בהמשך ל-Message Sending ולקולט ה-webhook.
//  תכנון: docs/whatsapp/plan.md
// ═══════════════════════════════════════════════════════════════

const WA_CORE = '0.1.0';
const WINDOW_MS = 24 * 60 * 60 * 1000;

// ── טלפון ──────────────────────────────────────────────────────
//  "טלפון מתוקן" במערכת: +9725XXXXXXXX. ב-WhatsApp: 9725XXXXXXXX.
function toWaId(e164) {
    const s = String(e164 || '');
    return /^\+9725\d{8}$/.test(s) ? s.slice(1) : null;
}
function fromWaId(waId) {
    const s = String(waId || '');
    return /^9725\d{8}$/.test(s) ? '+' + s : null;
}

// ── חלון 24 השעות ──────────────────────────────────────────────
//  טקסט חופשי מותר רק אם הלקוח כתב לנו ב-24 השעות האחרונות.
function withinWindow(lastInboundIso, nowIso) {
    if (!lastInboundIso || !nowIso) return false;
    const a = Date.parse(lastInboundIso), b = Date.parse(nowIso);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) return false;
    return b - a < WINDOW_MS;
}

// ── איזו הודעה יוצאת ───────────────────────────────────────────
//  מחזיר { kind:'template', key } או { kind:'text' } או { kind:'block', why }.
//  key = מפתח התבנית במערכת + "· בלי שם" כשאין שם לפנייה.
//  טיוטה שנערכה ידנית לא יכולה לצאת כתבנית (plan 3.2).
function chooseSend({ proc, round, hasName, edited, lastInboundIso, nowIso }) {
    const open = withinWindow(lastInboundIso, nowIso);
    if (proc === 'תשובה' && open) return { kind: 'text' };
    let key;
    if (proc === 'הודעת פתיחה') key = 'הודעת פתיחה';
    else if (proc === 'הודעת סבב' && Number.isInteger(round) && round >= 1 && round <= 4) key = `הודעת סבב ${round}`;
    else if (proc === 'תשובה') key = 'תשובה';
    else return { kind: 'block', why: `תהליך לא מוכר: "${proc}"` };
    if (edited) return { kind: 'block', why: 'הטיוטה נערכה ידנית ומחוץ לחלון 24 השעות אפשר לשלוח רק את נוסח התבנית המאושר' };
    return { kind: 'template', key: hasName ? key : `${key} · בלי שם` };
}

// ── משתנה ההתעניינות ───────────────────────────────────────────
//  בתבניות של Meta היחס "ב" נכנס לתוך המשתנה, כדי ש"ב-6 רפורמרים"
//  ו"בויואלדי" ייצאו נכון (אותו כלל כמו assemble ב-message-draft).
function interestParam(value) {
    const v = String(value || '').trim().replace(/\s+/g, ' ');
    if (!v) return null;
    return /^[0-9A-Za-z]/.test(v) ? `ב-${v}` : `ב${v}`;
}
//  Meta דוחה משתנה ריק, ירידת שורה, טאב או יותר מ-4 רווחים רצופים.
function cleanParam(value) {
    const v = String(value ?? '').replace(/[\t\r\n]+/g, ' ').replace(/ {2,}/g, ' ').trim();
    return v || null;
}

// ── גוף הבקשה ל-Graph API ──────────────────────────────────────
function templatePayload(waId, metaName, lang, params) {
    const clean = (params || []).map(cleanParam);
    if (!waId) throw new Error('אין wa_id תקין');
    if (!metaName) throw new Error('אין שם תבנית ב-Meta');
    if (clean.some(p => p === null)) throw new Error('משתנה ריק בתבנית');
    const body = { messaging_product: 'whatsapp', to: waId, type: 'template',
        template: { name: metaName, language: { code: lang || 'he' } } };
    if (clean.length) body.template.components = [{ type: 'body', parameters: clean.map(text => ({ type: 'text', text })) }];
    return body;
}
function textPayload(waId, text) {
    const t = String(text || '').trim();
    if (!waId) throw new Error('אין wa_id תקין');
    if (!t) throw new Error('טקסט ריק');
    return { messaging_product: 'whatsapp', to: waId, type: 'text', text: { body: t } };
}

// ── פענוח תשובת השליחה ─────────────────────────────────────────
//  אותו חוזה כמו sendViaProvider ב-message-send:
//  { ok:true, id } · { ok:false, kind:'transient'|'permanent'|'ambiguous', why }
function parseSendResult(httpStatus, json) {
    if (httpStatus === null || httpStatus === undefined)
        return { ok: false, kind: 'ambiguous', why: 'אין תשובה מהספק (timeout או רשת)' };
    const id = json && Array.isArray(json.messages) && json.messages[0] && json.messages[0].id;
    if (httpStatus >= 200 && httpStatus < 300) {
        return id ? { ok: true, id } : { ok: false, kind: 'ambiguous', why: 'הצלחה בלי מזהה הודעה' };
    }
    const err = (json && json.error) || {};
    const why = `Meta ${httpStatus}${err.code ? ' · ' + err.code : ''}${err.message ? ' · ' + err.message : ''}`;
    if (httpStatus === 429 || httpStatus >= 500) return { ok: false, kind: 'transient', why };
    return { ok: false, kind: 'permanent', why };
}

// ── פענוח webhook נכנס ─────────────────────────────────────────
//  מחזיר { messages:[...], statuses:[...] }. מתעלם ממה שלא מוכר.
function parseWebhook(body) {
    const out = { messages: [], statuses: [] };
    if (!body || body.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) return out;
    for (const entry of body.entry) {
        for (const ch of entry.changes || []) {
            const v = ch && ch.value;
            if (!v) continue;
            const names = {};
            for (const c of v.contacts || []) if (c && c.wa_id) names[c.wa_id] = (c.profile && c.profile.name) || '';
            for (const m of v.messages || []) {
                const ts = Number(m.timestamp);
                out.messages.push({
                    wamid: m.id, from: m.from, phone: fromWaId(m.from), profileName: names[m.from] || '',
                    at: Number.isFinite(ts) ? new Date(ts * 1000).toISOString() : null,
                    type: m.type, text: m.type === 'text' && m.text ? String(m.text.body || '') : '',
                    unsupported: m.type !== 'text',
                });
            }
            for (const s of v.statuses || []) {
                const ts = Number(s.timestamp);
                out.statuses.push({
                    wamid: s.id, status: s.status,
                    at: Number.isFinite(ts) ? new Date(ts * 1000).toISOString() : null,
                    error: s.errors && s.errors[0] ? `${s.errors[0].code || ''} ${s.errors[0].title || ''}`.trim() : '',
                });
            }
        }
    }
    return out;
}

// ── הסרה ───────────────────────────────────────────────────────
//  רק הודעה שכולה בקשת הסרה. "אל תסירו אותי" או משפט ארוך לא נחשבים.
const OPT_OUT = /^(הסר|הסירו|הסירו אותי|הסר אותי|תסירו|תסירו אותי|להסיר|להסרה|הסרה|stop|unsubscribe)$/i;
function isOptOut(text) {
    const t = String(text || '').normalize('NFKC').replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim();
    return OPT_OUT.test(t);
}

// ── איתור ליד להודעה נכנסת ─────────────────────────────────────
//  candidates: הלידים עם אותו "טלפון מתוקן":
//  { id, closed:boolean, lastOutboundIso:string|null }.
//  הליד הפעיל שקיבל מאיתנו הודעה אחרונה. שוויון או אין = לבדיקה.
function matchLead(candidates) {
    const live = (candidates || []).filter(c => c && !c.closed);
    if (live.length === 1) return { leadId: live[0].id };
    const withOut = live.filter(c => c.lastOutboundIso).sort((a, b) => Date.parse(b.lastOutboundIso) - Date.parse(a.lastOutboundIso));
    if (withOut.length && (withOut.length === 1 || withOut[0].lastOutboundIso !== withOut[1].lastOutboundIso))
        return { leadId: withOut[0].id };
    if (!live.length && (candidates || []).length === 1) return { leadId: candidates[0].id, reopened: true };
    return { review: live.length || (candidates || []).length ? 'כמה לידים עם אותו טלפון, אי אפשר לשייך בוודאות' : 'מספר לא מוכר' };
}

if (typeof module !== 'undefined') module.exports = {
    WA_CORE, toWaId, fromWaId, withinWindow, chooseSend, interestParam, cleanParam,
    templatePayload, textPayload, parseSendResult, parseWebhook, isOptOut, matchLead,
};
