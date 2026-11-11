// ═══════════════════════════════════════════════════════════════
//  תיקוני נרמול מוצעים לקליטה (Lead Intake 2.1.0 → 2.2.0)
//  פונקציות טהורות, ללא קריאה ל-Airtable. נבדקות ב-node:
//      node intake-normalizers-2.2.js
//  כל פונקציה מחזירה את אותה תוצאה כמו 2.1.0, חוץ מהמקרים שמצוינים כ"חדש".
//  סטטוס: הצעה בלבד. לא הודבק ב-DEV.
// ═══════════════════════════════════════════════════════════════
const BIDI   = /[‎‏‪-‮⁦-⁩؜]/g;
const DASHES = /[‐-―−﹘﹣－]/g;
const EMOJI  = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;
const BIZ    = /סטודיו|studio|כושר|יוגה|פילאטיס|pilates|אימונים|מאמנת|תזונה|שיקום|מרכז/i;

// חדש: "+0501234567" (פלוס מיותר לפני אפס) הוא נייד ישראלי תקין, לא "מספר זר".
function normPhone(raw) {
    if (!raw) return { ok:false, why:'טלפון חסר' };
    let s = String(raw).replace(BIDI,'').replace(DASHES,'-').replace(/[\s()\-.]/g,'');
    if (/^\+0\d{8,9}$/.test(s)) s = s.slice(1);                 // חדש
    if (s.startsWith('+972')) s = '0' + s.slice(4);
    else if (s.startsWith('00972')) s = '0' + s.slice(5);       // חדש
    else if (s.startsWith('972')) s = '0' + s.slice(3);
    if (/^0[2-489]\d{7}$/.test(s)) return { ok:false, why:'לא מספר נייד' };
    if (/^\+?\d{7,15}$/.test(s) && !s.startsWith('0')) return { ok:false, why:'מספר לא ישראלי' };
    if (!/^05\d{8}$/.test(s)) return { ok:false, why:'טלפון לא תקין' };
    return { ok:true, e164:'+972' + s.slice(1) };
}

// חדש: ידית (אינסטגרם / שם משתמש) אינה שם לפנייה. ההודעה תיפתח ב"היי," ולא ב"היי xxx_meme".
// latin: 'keep' (כמו היום) או 'skip' (שם באותיות לטיניות לא נכנס). ברירת מחדל: keep.
function normName(raw, { latin = 'keep' } = {}) {
    if (!raw) return null;
    let s = String(raw).normalize('NFKC').replace(BIDI,'').replace(EMOJI,'');
    s = s.replace(/^\s*\d+[.)]\s*/, '');
    s = s.split(/[|•·,\/]| - /)[0].replace(/\s+/g,' ').trim();
    if (!s || BIZ.test(s)) return null;
    if (/[_@]/.test(s) || /\d/.test(s)) return null;                          // חדש: ידית או מספרים
    const w = s.split(' ');
    if (w.length > 3) return null;
    const first = w[0];
    if (first.includes('.')) return null;                                      // חדש: dana.levi, ראשי תיבות
    if (!/[A-Za-z֐-׿]/.test(first)) return null;                     // חדש: בלי אותיות
    if (latin === 'skip' && !/[֐-׿]/.test(first)) return null;
    if (/^[a-z]/.test(first)) return first[0].toUpperCase() + first.slice(1);  // חדש: shani → Shani
    return first;
}

// חדש: פירוק "כמה מזרנים?" שמגיע כ-"<מספר><טקסט>" בלי רווח.
// מחזיר { n, detail, flag }. n=null כשאין כמות אמינה; flag = סיבה לשורת "לבדיקה".
function parseQty(raw, { max = 100 } = {}) {
    const t = String(raw ?? '').normalize('NFKC').replace(BIDI,'').trim();
    if (!t) return { n:null, detail:null, flag:null };
    let detail = null;
    if (/ללא מיתוג/.test(t)) detail = 'ללא מיתוג';
    else if (/מיתוג אישי|לוגו/.test(t)) detail = 'עם מיתוג אישי / לוגו';
    else if (/שתי האפשרויות/.test(t)) detail = 'פתוח לשתי האפשרויות';
    if (/\d+\s*(?:-|–|עד|ל|ל-)\s*\d+/.test(t) || /בין\s+\d+/.test(t))
        return { n:null, detail, flag:'כמות כטווח, לא חד-משמעית' };            // "בין 5 ל 10"
    const m = t.match(/^\d+(?:\.\d+)?/);
    if (!m) return { n:null, detail, flag: /\d/.test(t) ? 'כמות לא ברורה' : null };
    const n = Number(m[0]);
    if (!Number.isInteger(n)) return { n:null, detail, flag:'כמות לא שלמה' };
    if (n === 0) return { n:null, detail, flag:null };                          // ברירת מחדל של טופס, כמו היום
    if (n > max) return { n:null, detail, flag:`כמות חריגה (${n})` };
    return { n, detail, flag:null };
}

module.exports = { normPhone, normName, parseQty };

// ── בדיקות (נתונים סינתטיים בלבד) ────────────────────────────────
if (require.main === module) {
    const assert = require('assert');
    const eq = (a, b, m) => assert.deepStrictEqual(a, b, m);
    // טלפון: כל מה שעבד ב-2.1.0 ממשיך לעבוד
    eq(normPhone('+972501234567').e164, '+972501234567');
    eq(normPhone('(054) 111-2233').e164, '+972541112233');
    eq(normPhone('\u202A+972 54\u2011100\u20112000\u202C').e164, '+972541002000');
    eq(normPhone('0501112233').e164, '+972501112233');
    eq(normPhone('+972 50-123-4567').e164, '+972501234567');
    // טלפון: מה שנפסל נשאר נפסל
    eq(normPhone('+31612345678').why, 'מספר לא ישראלי');
    eq(normPhone('+97241234567').why, 'לא מספר נייד');
    eq(normPhone('+9725012345678').why, 'טלפון לא תקין');
    eq(normPhone('').why, 'טלפון חסר');
    // טלפון: החדש
    eq(normPhone('+0501234567').e164, '+972501234567');
    eq(normPhone('00972501234567').e164, '+972501234567');
    // שם
    eq(normName('שירן כהן'), 'שירן');
    eq(normName('Shani Levi'), 'Shani');
    eq(normName('shani levi'), 'Shani');
    eq(normName('😀 דנה ❤️'), 'דנה');
    eq(normName('1. רוני'), 'רוני');
    eq(normName('סטודיו נועה פילאטיס'), null);
    eq(normName('a b c d'), null);
    eq(normName('xxx_meme'), null);
    eq(normName('xxx_nitzan1'), null);
    eq(normName('dana.levi'), null);
    eq(normName('S. Cohen'), null);
    eq(normName('@dana'), null);
    eq(normName('Shani Levi', { latin:'skip' }), null);
    eq(normName('שני Levi', { latin:'skip' }), 'שני');
    // כמות
    eq(parseQty('10מזרנים עם מיתוג אישי / לוגו'), { n:10, detail:'עם מיתוג אישי / לוגו', flag:null });
    eq(parseQty('12אשמח לשמוע על שתי האפשרויות'), { n:12, detail:'פתוח לשתי האפשרויות', flag:null });
    eq(parseQty('10 מזרנים על המכשיריםמזרנים ללא מיתוג'), { n:10, detail:'ללא מיתוג', flag:null });
    eq(parseQty('20'), { n:20, detail:null, flag:null });
    eq(parseQty(''), { n:null, detail:null, flag:null });
    eq(parseQty('0'), { n:null, detail:null, flag:null });
    eq(parseQty('180').flag, 'כמות חריגה (180)');
    eq(parseQty('3.4').flag, 'כמות לא שלמה');
    eq(parseQty('בין 5 ל 10מזרנים עם מיתוג אישי / לוגו').flag, 'כמות כטווח, לא חד-משמעית');
    eq(parseQty('מזרן כמו של פילטיסמזרנים עם מיתוג אישי / לוגו'), { n:null, detail:'עם מיתוג אישי / לוגו', flag:null });
    eq(parseQty('הגיע הזמן לשדרג את הציוד שלך אשמח לשמוע על שתי האפשרויות').n, null);
    console.log('✅ כל הבדיקות עברו');
}
