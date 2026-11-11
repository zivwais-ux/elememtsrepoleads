# Omni prompt · המשך: נוסח ג' להודעת WhatsApp

> נכתב 11.11.2026. **המשך** ל-[הסבב הקודם](2026-11-11-main-dashboard-whatsapp-template.md), שכבר הוטמע ואומת (הקוד בגרסה `bbdcx2Cth7Vwq6Mxp`).
> **שתי עריכות בלבד.** הפונקציות נבדקו ב-node: [`automations/proposed/dashboard-whatsapp.js`](../../automations/proposed/dashboard-whatsapp.js).
> **לא ללחוץ Publish.** אחרי הביצוע אני מוריד את הקוד ומשווה.

## מה משתנה
ההודעה מציגה את Elements בשם, ומציגה את שם השולח (האחראי על הליד):

> היי כרמית, כאן בר מ-**Elements** 🙂
> ראינו שהשארת פרטים לגבי רפורמר אחד של ויואלדי ונשמח לעזור.
> כדי שנכוון אותך נכון, אפשר לספר לנו קצת: זה לסטודיו או לשימוש ביתי, ומתי נוח לשיחה קצרה?

| סוג הלקוח בליד | השאלה |
|---|---|
| עסקי | "…אפשר לספר לנו קצת על העסק, ומתי נוח לשיחה קצרה?" |
| פרטי | "…אפשר לספר לנו קצת מה חשוב לך, ומתי נוח לשיחה קצרה?" |
| לא ידוע | "…אפשר לספר לנו קצת: זה לסטודיו או לשימוש ביתי, ומתי נוח לשיחה קצרה?" |

אין אחראי על הליד: "אנחנו מ-Elements". אין שם לפנייה: "היי, כאן…".

## מה בפרומפט נוגע בנתונים
קריאה בלבד של שני שדות נוספים (`אחראי`, `סוג לקוח`). אין כתיבה ואין שינוי בשום דבר אחר.

---

```
Edit ONLY the custom element on page "Main Dashboard" (pagTW81hjKberKKyz,
interface Elements Daily Ops). Do not publish. Do not touch any other page,
table, field, view or automation. No other code changes.

Make exactly these 2 edits in source.tsx:

1) Replace the whole function waText with:

function waText(firstName:string, owner:string, line:string, qty:any, detail:string, custType:string):string {
  const name = String(firstName||'').trim();
  const who = String(owner||'').trim();
  const ask = custType==='עסקי' ? 'אפשר לספר לנו קצת על העסק, ומתי נוח לשיחה קצרה?'
            : custType==='פרטי' ? 'אפשר לספר לנו קצת מה חשוב לך, ומתי נוח לשיחה קצרה?'
            : 'אפשר לספר לנו קצת: זה לסטודיו או לשימוש ביתי, ומתי נוח לשיחה קצרה?';
  return `היי${name ? ' '+name : ''}, ${who ? 'כאן '+who+' מ-' : 'אנחנו מ-'}*Elements* 🙂\n` +
         `ראינו שהשארת פרטים לגבי ${waInterest(line, qty, detail)} ונשמח לעזור.\n` +
         `כדי שנכוון אותך נכון, ${ask}`;
}

2) In the lead card component, replace the call
   waText(s(LF.firstName), s(LF.product), s(LF.qtyAdj), s(LF.productDetail))
with
   waText(s(LF.firstName), s(LF.owner), s(LF.product), s(LF.qtyAdj), s(LF.productDetail), s(LF.custType))

Everything else stays byte-identical. Send a screenshot of a lead card.
```

## בדיקת קבלה, אחרי הפרסום (דקה)
1. ליד הטסט `shani test` (מזרנים, אחראי עומר, סוג "לא ידוע"): לוחצים 💬. צריך להיפתח "היי Shani, כאן עומר מ-Elements 🙂 … 10 מזרנים עם מיתוג אישי … זה לסטודיו או לשימוש ביתי…". **לא שולחים.** המספר פיקטיבי.
2. ליד הטסט `xxx_test_ig` (ויואלדי, אחראית בר, פרטי): "היי, כאן בר מ-Elements 🙂 … מה חשוב לך…".
