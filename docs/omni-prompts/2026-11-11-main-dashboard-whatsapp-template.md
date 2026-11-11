# Omni prompt · Main Dashboard: WhatsApp עם טקסט מוכן, וחיוג/WhatsApp ממספר נקי

> נכתב 11.11.2026. **שני שינויים, כולם בכרטיס הליד, ללא נגיעה בנתונים.**
> הפונקציות נבדקו ב-node: [`automations/proposed/dashboard-whatsapp.js`](../../automations/proposed/dashboard-whatsapp.js) (28 בדיקות, מספרים פיקטיביים).
> **לא ללחוץ Publish.** אחרי הביצוע אני מוריד את הקוד, מוודא שההבדל הוא רק שני הקטעים שלמטה, ורק אז מפרסמים.

## מה משתנה
| | היום | אחרי |
|---|---|---|
| כפתור 💬 | `https://wa.me/<מספר>`, שיחה ריקה | `https://wa.me/<מספר>?text=<הודעה מוכנה>`, לדוגמה: **"היי כרמית, ראינו שהשארת פרטים לגבי רפורמר אחד של ויואלדי. איך אפשר לעזור?"** |
| מספר לקישור | `טלפון מתוקן`, ואם ריק הטלפון הגולמי כמו שהוא. `054…` מקומי נפתח ל-`wa.me/054…` שאינו קיים, וספרה מיותרת פותחת מספר שגוי | תמיד בינלאומי נקי (`972…`). מספר ישראלי לא תקין → הכפתורים חסומים עם הסבר, ולא נפתח מספר שגוי |
| כפתור 📞 | `tel:` עם הטלפון הגולמי (תווי כיוון ורווחים) | `tel:+972…` נקי |

הטקסט: שם מ-`שם לפנייה` (ריק → "היי,"), נושא לפי קו מוצר, `כמות מתוקנת` ו-`פירוט המוצר`:

| קו מוצר | דוגמה |
|---|---|
| ויואלדי / סימפוני | "רפורמר אחד של ויואלדי" · "שני רפורמרים של ויואלדי" · "6 רפורמרים של סימפוני" · בלי כמות: "רפורמרים של ויואלדי" |
| מזרנים | "10 מזרנים עם מיתוג אישי" · "6 מזרנים ללא מיתוג" · "12 מזרנים" |
| ציוד / אחר | "ציוד" |

## מה בפרומפט נוגע בנתונים
| פעולה | נוגע בנתונים? |
|---|---|
| קריאת 5 שדות קיימים מהליד | קריאה בלבד |
| בניית קישור | בזיכרון הדפדפן |
| כתיבה, שינוי שדות, אוטומציות | **אסור**. שער הכתיבה והטופס שאחרי הלחיצה לא משתנים |

---

```
Edit ONLY the custom element on page "Main Dashboard" (pagTW81hjKberKKyz,
interface Elements Daily Ops). Do not publish. Do not touch any other page,
table, field, view or automation. No other code changes, no restyling, and do
not change the write gate or LogContactForm.

Make exactly these 2 edits in source.tsx:

1) Add these four functions at module level, immediately after the function getVal:

function waDigits(raw:any):string {
  let d = String(raw||'').replace(/[‎‏‪-‮⁦-⁩؜]/g,'').replace(/\D/g,'');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '972'+d.slice(1);
  if (d.startsWith('972')) return /^9725\d{8}$/.test(d) ? d : '';
  return /^\d{8,15}$/.test(d) ? d : '';
}
function waInterest(line:string, qty:any, detail:string):string {
  const n = Number(qty)>0 ? Number(qty) : 0;
  const d = String(detail||'');
  if (line==='מזרנים') {
    const base = n===1 ? 'מזרן אחד' : n===2 ? 'שני מזרנים' : n>2 ? `${n} מזרנים` : 'מזרנים';
    const extra = /ללא מיתוג/.test(d) ? ' ללא מיתוג' : /מיתוג אישי|לוגו/.test(d) ? ' עם מיתוג אישי' : '';
    return base+extra;
  }
  if (line==='ויואלדי' || line==='סימפוני') {
    const base = n===1 ? 'רפורמר אחד' : n===2 ? 'שני רפורמרים' : n>2 ? `${n} רפורמרים` : 'רפורמרים';
    return `${base} של ${line}`;
  }
  return line || 'המוצרים שלנו';
}
function waText(firstName:string, line:string, qty:any, detail:string):string {
  const name = String(firstName||'').trim();
  return `היי${name ? ' '+name : ''}, ראינו שהשארת פרטים לגבי ${waInterest(line, qty, detail)}. איך אפשר לעזור?`;
}
function waUrl(digits:string, text:string):string {
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : '';
}

2) In the lead card component, replace exactly these lines:

    const phone    = s(LF.phone)||s(LF.phoneFmt);
    const phoneFmt = s(LF.phoneFmt)||s(LF.phone);
    const waLink   = phoneFmt ? `https://wa.me/${phoneFmt.replace(/\D/g,'')}` : '';
    // Disabled-button reasons (shown in the button title AND in a caption under it)
    const NC_REASON = 'אין ליצור קשר — הליד מסומן כחסום לפניות';
    const NO_PHONE  = 'אין מספר טלפון בליד';

with:

    const phoneFmt = s(LF.phoneFmt)||s(LF.phone);
    const waNum    = waDigits(s(LF.phoneFmt)) || waDigits(s(LF.phone));
    const phone    = waNum ? `+${waNum}` : '';
    const waLink   = waNum ? waUrl(waNum, waText(s(LF.firstName), s(LF.product), s(LF.qtyAdj), s(LF.productDetail))) : '';
    // Disabled-button reasons (shown in the button title AND in a caption under it)
    const NC_REASON = 'אין ליצור קשר — הליד מסומן כחסום לפניות';
    const NO_PHONE  = phoneFmt ? 'הטלפון אינו תקין. לתקן ב"טלפון מתוקן"' : 'אין מספר טלפון בליד';

The two lines after them (phoneOff and waOff) stay unchanged. Everything else
stays byte-identical. Send a screenshot of a lead card showing both buttons.
```

## בדיקת קבלה (אחרי ש-Omni מסיים, לפני Publish)
1. פותחים את ליד הטסט `shani test` (מספר פיקטיבי `050-000-0802`).
2. לוחצים 💬: WhatsApp נפתח עם הטקסט **"היי Shani, ראינו שהשארת פרטים לגבי 10 מזרנים עם מיתוג אישי. איך אפשר לעזור?"**. **לא שולחים.** המספר פיקטיבי.
3. אחרי כ-0.3 שניות נפתח טופס התיעוד. סוגרים בלי לשמור.
4. לוחצים 📞: נפתח חיוג (ב-Mac, FaceTime) למספר `+972500000802`. מבטלים.
5. ליד הטסט השני, `xxx_test_ig`: אין שם, ולכן "היי, ראינו…". הוא מסומן "דורש בדיקה", אבל הכפתורים פעילים.
