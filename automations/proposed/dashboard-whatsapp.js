// ═══════════════════════════════════════════════════════════════
//  Main Dashboard · כפתורי WhatsApp וטלפון: מספר בינלאומי נקי + טקסט מוכן.
//  פונקציות טהורות, זהות לקוד שמוכנס לאלמנט (בלי טיפוסים). נבדקות ב-node:
//      node dashboard-whatsapp.js
//  כל המספרים בבדיקות פיקטיביים.
// ═══════════════════════════════════════════════════════════════

// מספר לקישור wa.me / tel:. עדיפות ל"טלפון מתוקן". מחזיר '' כשהמספר לא תקין.
//   0501112233 · +0501112233 · 00972501112233 · "+972 50‑111‑2233" → 972501112233
//   מספר זר (לא 972) נשאר כמות שהוא. מספר ישראלי שאינו נייד תקין (ספרה מיותרת, קווי) → ''
function waDigits(raw) {
    let d = String(raw || '').replace(/[‎‏‪-‮⁦-⁩؜]/g, '').replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    else if (d.startsWith('0')) d = '972' + d.slice(1);
    if (d.startsWith('972')) return /^9725\d{8}$/.test(d) ? d : '';
    return /^\d{8,15}$/.test(d) ? d : '';
}

// נושא ההודעה, לפי קו מוצר, כמות מתוקנת ופירוט המוצר
function waInterest(line, qty, detail) {
    const n = Number(qty) > 0 ? Number(qty) : 0;
    const d = String(detail || '');
    if (line === 'מזרנים') {
        const base = n === 1 ? 'מזרן אחד' : n === 2 ? 'שני מזרנים' : n > 2 ? `${n} מזרנים` : 'מזרנים';
        const extra = /ללא מיתוג/.test(d) ? ' ללא מיתוג' : /מיתוג אישי|לוגו/.test(d) ? ' עם מיתוג אישי' : '';
        return base + extra;
    }
    if (line === 'ויואלדי' || line === 'סימפוני') {
        const base = n === 1 ? 'רפורמר אחד' : n === 2 ? 'שני רפורמרים' : n > 2 ? `${n} רפורמרים` : 'רפורמרים';
        return `${base} של ${line}`;
    }
    return line || 'המוצרים שלנו';
}

// הטקסט המוכן. בלי שם לפנייה: "היי, ראינו…"
function waText(firstName, line, qty, detail) {
    const name = String(firstName || '').trim();
    return `היי${name ? ' ' + name : ''}, ראינו שהשארת פרטים לגבי ${waInterest(line, qty, detail)}. איך אפשר לעזור?`;
}

function waUrl(digits, text) {
    return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : '';
}

module.exports = { waDigits, waInterest, waText, waUrl };

if (require.main === module) {
    const assert = require('assert');
    const eq = (a, b, m) => assert.deepStrictEqual(a, b, m);
    // מספרים
    eq(waDigits('+972501112233'), '972501112233');
    eq(waDigits('050-111-2233'), '972501112233');
    eq(waDigits('0501112233'), '972501112233');
    eq(waDigits('+0501112233'), '972501112233');          // הפלוס המיותר
    eq(waDigits('00972501112233'), '972501112233');
    eq(waDigits('‪+972 50‑111‑2233‬'), '972501112233');   // תווי כיוון ומקף לא שובר
    eq(waDigits('(050) 111-2233'), '972501112233');
    eq(waDigits('+31612345678'), '31612345678');          // זר נשאר
    eq(waDigits('+9725011122334'), '');                   // ספרה מיותרת → לא פותחים מספר שגוי
    eq(waDigits('+97241234567'), '');                     // קווי
    eq(waDigits('123'), '');
    eq(waDigits(''), '');
    eq(waDigits(null), '');
    // נושא
    eq(waInterest('ויואלדי', 1, ''), 'רפורמר אחד של ויואלדי');
    eq(waInterest('ויואלדי', 2, ''), 'שני רפורמרים של ויואלדי');
    eq(waInterest('ויואלדי', '6', ''), '6 רפורמרים של ויואלדי');
    eq(waInterest('ויואלדי', '', ''), 'רפורמרים של ויואלדי');
    eq(waInterest('סימפוני', 4, ''), '4 רפורמרים של סימפוני');
    eq(waInterest('מזרנים', 10, 'עם מיתוג אישי / לוגו'), '10 מזרנים עם מיתוג אישי');
    eq(waInterest('מזרנים', 12, 'פתוח לשתי האפשרויות'), '12 מזרנים');
    eq(waInterest('מזרנים', 6, 'ללא מיתוג'), '6 מזרנים ללא מיתוג');
    eq(waInterest('מזרנים', '', ''), 'מזרנים');
    eq(waInterest('ציוד', 3, ''), 'ציוד');
    eq(waInterest('', '', ''), 'המוצרים שלנו');
    // טקסט מלא
    eq(waText('כרמית', 'ויואלדי', 1, ''), 'היי כרמית, ראינו שהשארת פרטים לגבי רפורמר אחד של ויואלדי. איך אפשר לעזור?');
    eq(waText('', 'מזרנים', 10, 'עם מיתוג אישי / לוגו'), 'היי, ראינו שהשארת פרטים לגבי 10 מזרנים עם מיתוג אישי. איך אפשר לעזור?');
    eq(waText('Shani', 'ויואלדי', 8, ''), 'היי Shani, ראינו שהשארת פרטים לגבי 8 רפורמרים של ויואלדי. איך אפשר לעזור?');
    // קישור: מתפענח בחזרה לטקסט המקורי
    const t = waText('כרמית', 'ויואלדי', 1, '');
    const link = waUrl('972501112233', t);
    assert(link.startsWith('https://wa.me/972501112233?text='));
    eq(decodeURIComponent(new URL(link).searchParams.get('text')), t);
    eq(waUrl('', t), '');
    console.log('✅ כל הבדיקות עברו');
}
