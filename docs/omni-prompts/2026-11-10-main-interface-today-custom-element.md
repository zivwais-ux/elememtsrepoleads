# Omni prompt · Main Interface › "משימות להיום" as a custom element (option B) · v2 short

> נכתב 9.11.2026. v2: קיצור של v1 בכחצי, ותוספת כלל מפורש שאוסר לגעת בסכימה (שדות, טבלאות, אוטומציות).
> יעד: הדמו https://claude.ai/artifact/Y4zBwQgjCGDSWvCpmLMQdW כעמוד custom element **חדש**. העמוד הקיים `pagZPPSEifP6yT9FQ` לא משתנה.
> לא ללחוץ Publish. אחרי הביצוע: צילום מסך לכל טאב, ואני מוריד את הקוד ובודק.

## מה בפרומפט נוגע בנתונים
| פעולה | נוגע בנתונים? |
|---|---|
| קריאת 12 שדות קיימים מטבלת לידים | קריאה בלבד |
| סינון, ספירה, קיבוץ ומיון | בזיכרון של הדפדפן, לא נשמר |
| לחיצה על אריח, טאב או קבוצה | מצב תצוגה מקומי בלבד |
| יצירת עמוד חדש + אלמנט | שינוי בממשק, לא בנתונים |
| כתיבה לרשומות, שינוי שדות או טבלאות, אוטומציות | **אסור במפורש** (כללים 1–2) |

---

```
Build ONE new read-only custom-element page. Do not publish.

WHERE: Elements Main Interface (pbd1V5nLiZV8HZvrb). Create exactly one new
page "משימות להיום · חדש" with exactly one custom element on table לידים
(tbl91QjpePM88Zp9p). If that page already exists, edit it in place.
Do not change any other page (especially pagZPPSEifP6yT9FQ) or interface.

RULES
1. Read-only: no createRecordAsync / updateRecordAsync / updateRecordsAsync /
   deleteRecordAsync anywhere.
2. Do not create, rename, edit or delete any table, field, formula, view or
   automation. If something seems missing, stop and report it.
3. No date code: no Date objects, no "today", no toLocale*. Show time text
   only as it comes from the formula fields below.
4. initializeBlock({ interface: () => <App/> }); an error boundary around
   header, KPIs and list. No new npm packages; inline <svg> icons only;
   system fonts only. All styles in one THEME object. dir="rtl".

FIELDS (read only these)
שם ליד fldpRaAbMncaePGQB · כותרת fldxplqe7okD0DOHn · מה עכשיו fldBnzbAl5UDchsDS
סיבת עיכוב fldKLWRKe1Za6yidA · למה עכשיו fldhxOjKBbUZZOruy
סדר עבודה fldTSlcNVzTIbLX8H · סדר fldquExsjwY9z2DWU · אחראי fldc9BJfqXLxwPlJ1
טיפול אישי fldUUzkLcocMeHqTJ · יש הודעה ממתינה fldQbuFSBBTxLis8N ("כן" or "")
מצב טיפול fld5KlfuDpeb4PFo8 · תאריך כניסה fldoaqRvQ5bscM12Q ("YYYY-MM-DD" string)

LOGIC (copy of the existing page)
- Scope: תאריך כניסה >= "2026-09-03" (string compare) AND סדר עבודה contains
  neither "🟤" nor "ממתינים לתגובת".
- Tabs: "בר" (אחראי id seloPmlNWEDizoZCb, default) · "עומר"
  (selbh3WaP4gJfLiAw) · "כל הצוות" (no filter).
- KPIs: להיום = סדר עבודה contains "לקרות היום" · לאישורך = יש הודעה ממתינה
  is "כן" · דורש בדיקה = סדר עבודה contains "דורש בדיקה" · לידים חדשים =
  מצב טיפול id selI4ZU4gq0DcYEkZ AND יש הודעה ממתינה is not "כן".
- List grouped by the first character of סדר עבודה in order 🔴, 🟠, 🟣
  (skip empty groups); title = text before " · ", subtitle = text after;
  sort by סדר ascending. Emoji are parsed, never displayed.
- Clicking a KPI filters the list (again = clear). Group header collapses.
  Lead card click: expandRecord(record) if the SDK has it, else nothing.
- Must show: בר 2·1·2·1 · עומר 3·1·1·1 · כל הצוות 5·2·4·3.

CARD CONTENT
name = שם ליד · chips = כותרת without the leading "<name> · ", split on " · "
· owner avatar = first letter of אחראי (none → pill "אין אחראי")
· next = מה עכשיו without a trailing " · טיפול אישי" (+ tag "טיפול אישי" if checked)
· warnings = סיבת עיכוב split on " · " (empty → למה עכשיו as one pill).
  Red if it contains המועד עבר / נחסמה / אין אחראי / דורשת בירור;
  amber if אין תאריך / ללא פעילות / בדיקת נתונים; else gray.

DESIGN (exact; do not simplify; no gradients, glow, emoji, full-color cards)
- Page bg #F7F5FF, content max-width 1280px centered, padding 32px 28px,
  gap 24px. Text #1F1235, secondary #5B5470. Accent #6D28D9.
- Header: title "משימות להיום" 34px/800; under it 16px
  "כל מה שדורש פעולה מהצוות עכשיו או במהלך היום.". Opposite side: tabs as a
  white pill container (1px #E9E4F7, radius 999, padding 4); selected tab
  accent bg + white text; בר/עומר tabs start with a 22px round letter avatar
  (בר #DBEAFE/#1E40AF, עומר #D1FAE5/#065F46).
- KPIs: 4 white cards in a row (2 under 1100px), radius 22, padding 20,
  1px #ECE8F7, shadow 0 1px 2px rgba(46,16,101,.05). Top: 40px icon tile
  (radius 14, KPI color at 10%) + label 16px/700 + description 13px.
  Bottom: number 44px/800 tabular-nums in KPI color + unit 14px.
  להיום red #B91C1C clock · לאישורך amber #B45309 chat-check ·
  דורש בדיקה violet #6D28D9 warning · לידים חדשים green #047857 person-plus.
  Hover lift 2px; active = 2px accent border + #F7F5FF bg.
- List: one white container radius 24, 1px #ECE8F7, padding 8. Group header
  row: 12px color dot with 4px soft ring, title 18px/700, subtitle 14px,
  count pill, rotating chevron. Cards in a 2-column grid (1 under 1100px),
  gap 12.
- Card: white, radius 18, padding 18, 1px #F1EEFB, soft shadow, hover lift 1px.
  Row 1: name 17px/700 + chips (13px, #F5F3FA bg, radius 999) · avatar 32px
  on the opposite side. Row 2: next action as an accent pill (white 14px/600,
  radius 999, small arrow icon). Row 3: warning pills (13px/600, radius 999):
  red #FEF2F2/#B91C1C · amber #FFFBEB/#92400E · gray #F3F4F6/#374151.
- Real <button>s everywhere, aria-pressed on KPIs, aria-expanded on groups,
  text ≥ 13px, WCAG AA.

REPORT: first line "Not executed — cannot run against live data". Then the
new page/element IDs, confirmation that rules 1–2 held and no other page
changed, and whether expandRecord was available.
```
