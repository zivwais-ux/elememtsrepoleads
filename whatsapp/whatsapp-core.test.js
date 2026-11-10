// node --test whatsapp/whatsapp-core.test.js · בדיקות לפונקציות הטהורות. אין רשת.
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('./whatsapp-core.js');

test('טלפון: המרה הלוך וחזור', () => {
    assert.equal(W.toWaId('+972521234567'), '972521234567');
    assert.equal(W.fromWaId('972521234567'), '+972521234567');
    assert.equal(W.toWaId('0521234567'), null);
    assert.equal(W.toWaId('+97241234567'), null);       // קווי
    assert.equal(W.fromWaId('31612345678'), null);      // זר
});

test('חלון 24 שעות', () => {
    const now = '2026-11-10T12:00:00Z';
    assert.equal(W.withinWindow('2026-11-10T08:00:00Z', now), true);
    assert.equal(W.withinWindow('2026-11-09T12:00:01Z', now), true);
    assert.equal(W.withinWindow('2026-11-09T12:00:00Z', now), false);   // בדיוק 24 = סגור
    assert.equal(W.withinWindow(null, now), false);
    assert.equal(W.withinWindow('2026-11-11T00:00:00Z', now), false);   // עתידי = לא סומכים
});

test('בחירת סוג שליחה', () => {
    const now = '2026-11-10T12:00:00Z', fresh = '2026-11-10T10:00:00Z', old = '2026-11-01T10:00:00Z';
    assert.deepEqual(W.chooseSend({ proc: 'הודעת פתיחה', hasName: true, nowIso: now }), { kind: 'template', key: 'הודעת פתיחה' });
    assert.deepEqual(W.chooseSend({ proc: 'הודעת פתיחה', hasName: false, nowIso: now }), { kind: 'template', key: 'הודעת פתיחה · בלי שם' });
    assert.deepEqual(W.chooseSend({ proc: 'הודעת סבב', round: 3, hasName: true, nowIso: now }), { kind: 'template', key: 'הודעת סבב 3' });
    assert.deepEqual(W.chooseSend({ proc: 'תשובה', hasName: true, lastInboundIso: fresh, nowIso: now }), { kind: 'text' });
    assert.deepEqual(W.chooseSend({ proc: 'תשובה', hasName: true, lastInboundIso: old, nowIso: now }), { kind: 'template', key: 'תשובה' });
    assert.equal(W.chooseSend({ proc: 'תשובה', edited: true, lastInboundIso: fresh, nowIso: now }).kind, 'text');   // בתוך החלון עריכה מותרת
    assert.equal(W.chooseSend({ proc: 'הודעת פתיחה', edited: true, hasName: true, nowIso: now }).kind, 'block');
    assert.equal(W.chooseSend({ proc: 'הודעת סבב', round: 5, nowIso: now }).kind, 'block');
});

test('משתנה ההתעניינות', () => {
    assert.equal(W.interestParam('6 רפורמרים לסטודיו שלך בתל אביב'), 'ב-6 רפורמרים לסטודיו שלך בתל אביב');
    assert.equal(W.interestParam('ויואלדי'), 'בויואלדי');
    assert.equal(W.interestParam('Pilates'), 'ב-Pilates');
    assert.equal(W.interestParam('  '), null);
});

test('גוף בקשת תבנית', () => {
    const p = W.templatePayload('972521234567', 'elements_opening_v1', 'he', ['נועה', 'בויואלדי']);
    assert.equal(p.type, 'template');
    assert.equal(p.template.name, 'elements_opening_v1');
    assert.deepEqual(p.template.components[0].parameters.map(x => x.text), ['נועה', 'בויואלדי']);
    assert.throws(() => W.templatePayload('972521234567', 'x', 'he', ['']), /משתנה ריק/);
    assert.throws(() => W.templatePayload(null, 'x', 'he', []), /wa_id/);
    assert.equal(W.cleanParam('שורה\nשנייה'), 'שורה שנייה');
    assert.equal(W.templatePayload('972521234567', 'x', 'he', []).template.components, undefined);
});

test('גוף בקשת טקסט', () => {
    assert.deepEqual(W.textPayload('972521234567', ' שלום '), { messaging_product: 'whatsapp', to: '972521234567', type: 'text', text: { body: 'שלום' } });
    assert.throws(() => W.textPayload('972521234567', '  '), /ריק/);
});

test('פענוח תשובת שליחה', () => {
    assert.deepEqual(W.parseSendResult(200, { messages: [{ id: 'wamid.A' }] }), { ok: true, id: 'wamid.A' });
    assert.equal(W.parseSendResult(200, {}).kind, 'ambiguous');
    assert.equal(W.parseSendResult(null, null).kind, 'ambiguous');
    assert.equal(W.parseSendResult(429, { error: { code: 130429 } }).kind, 'transient');
    assert.equal(W.parseSendResult(503, {}).kind, 'transient');
    const p = W.parseSendResult(400, { error: { code: 132000, message: 'Number of parameters does not match' } });
    assert.equal(p.kind, 'permanent');
    assert.match(p.why, /132000/);
});

test('פענוח webhook: הודעה וסטטוס', () => {
    const body = { object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: {
        contacts: [{ wa_id: '972521234567', profile: { name: 'Noa' } }],
        messages: [{ id: 'wamid.IN1', from: '972521234567', timestamp: '1762776000', type: 'text', text: { body: 'מתי אפשר לדבר?' } },
                   { id: 'wamid.IN2', from: '972521234567', timestamp: '1762776060', type: 'image', image: { id: 'm1' } }],
        statuses: [{ id: 'wamid.OUT1', status: 'failed', timestamp: '1762776100', errors: [{ code: 131026, title: 'Message undeliverable' }] }],
    } }] }] };
    const r = W.parseWebhook(body);
    assert.equal(r.messages.length, 2);
    assert.equal(r.messages[0].phone, '+972521234567');
    assert.equal(r.messages[0].profileName, 'Noa');
    assert.equal(r.messages[0].text, 'מתי אפשר לדבר?');
    assert.equal(r.messages[0].at, '2025-11-10T12:00:00.000Z');
    assert.equal(r.messages[1].unsupported, true);
    assert.equal(r.statuses[0].status, 'failed');
    assert.match(r.statuses[0].error, /131026/);
    assert.deepEqual(W.parseWebhook({ object: 'page' }), { messages: [], statuses: [] });
    assert.deepEqual(W.parseWebhook(null), { messages: [], statuses: [] });
});

test('זיהוי הסרה', () => {
    for (const t of ['הסר', 'הסירו אותי', ' STOP ', 'הסרה.', 'הסר!']) assert.equal(W.isOptOut(t), true, t);
    for (const t of ['אל תסירו אותי', 'אפשר להסיר את הלוגו מהמזרן?', 'כן', '']) assert.equal(W.isOptOut(t), false, t);
});

test('איתור ליד', () => {
    assert.deepEqual(W.matchLead([{ id: 'a', closed: false }]), { leadId: 'a' });
    assert.deepEqual(W.matchLead([
        { id: 'a', closed: false, lastOutboundIso: '2026-11-01T10:00:00Z' },
        { id: 'b', closed: false, lastOutboundIso: '2026-11-08T10:00:00Z' },
    ]), { leadId: 'b' });
    assert.deepEqual(W.matchLead([{ id: 'a', closed: true }]), { leadId: 'a', reopened: true });
    assert.ok(W.matchLead([{ id: 'a', closed: false }, { id: 'b', closed: false }]).review);
    assert.deepEqual(W.matchLead([]), { review: 'מספר לא מוכר' });
});
