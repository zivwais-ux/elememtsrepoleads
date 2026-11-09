# Omni prompt · Main Interface › "משימות להיום" as a custom element (option B)

> נכתב 9.11.2026. יעד: לבנות את הדמו https://claude.ai/artifact/Y4zBwQgjCGDSWvCpmLMQdW כעמוד custom element **חדש** בממשק Elements Main Interface. העמוד הקיים `pagZPPSEifP6yT9FQ` לא נוגעים בו עד שהחדש יאומת.
> כל הלוגיקה בפרומפט שוחזרה מהגדרות העמוד הקיים (`get_page_layout`) ומהנוסחאות בסכימה, כדי שהמספרים יהיו זהים.
> **הקוד לא מחשב תאריכים בכלל:** כל טקסט שקשור לזמן מגיע מנוסחאות קיימות.
> לא ללחוץ Publish. אחרי הביצוע: הדוח של Omni, צילום מסך לכל טאב, ואני מוריד את הקוד ובודק.

---

```
TASK: Build ONE new custom-element page. Read-only. Do not publish.

WHERE
- Interface: Elements Main Interface (pbd1V5nLiZV8HZvrb).
- Create exactly ONE new page named "משימות להיום · חדש" containing exactly
  ONE custom element. Source table: לידים (tbl91QjpePM88Zp9p).
- If a page with that name already exists, EDIT IT IN PLACE instead.
- Do NOT modify, move, rename or delete any other page, especially the
  existing "משימות להיום" (pagZPPSEifP6yT9FQ). Do not touch Elements Daily Ops.
- No publish.

ABSOLUTE RULES
1. READ-ONLY. The element never writes: no createRecordAsync,
   updateRecordAsync, updateRecordsAsync, deleteRecordAsync anywhere.
2. NO DATE CODE. Do not create Date objects, do not compute "today", do not
   format dates, no toLocale*. Every time-related text comes ready-made from
   the formula fields listed below. Do not show today's date in the header.
3. Read values with getCellValue / getCellValueAsString only.
   Compare select fields by choice ID, not by text, where an ID is given.
4. initializeBlock({ interface: () => <App/> }). One error boundary around
   each section (header, KPIs, list).
5. No new npm packages. Icons = inline <svg> only (stroke icons, 2px).
   No external fonts or network calls. Font stack: system-ui, -apple-system,
   "Segoe UI", Arial, sans-serif.
6. All colors/sizes in ONE THEME object at the top of the file.
7. RTL: root has dir="rtl". All Hebrew text exactly as written below.

FIELDS TO READ (enable only these in the element config)
fldpRaAbMncaePGQB שם ליד        · fldxplqe7okD0DOHn כותרת (formula)
fldBnzbAl5UDchsDS מה עכשיו (formula) · fldKLWRKe1Za6yidA סיבת עיכוב (formula)
fldhxOjKBbUZZOruy למה עכשיו (formula) · fldTSlcNVzTIbLX8H סדר עבודה (formula)
fldquExsjwY9z2DWU סדר (formula, sort key) · fldc9BJfqXLxwPlJ1 אחראי (select)
fldUUzkLcocMeHqTJ טיפול אישי (checkbox) · fldQbuFSBBTxLis8N יש הודעה ממתינה (formula → "כן" or "")
fld5KlfuDpeb4PFo8 מצב טיפול (select) · fldoaqRvQ5bscM12Q תאריך כניסה (date, "YYYY-MM-DD")

DATA LOGIC — must reproduce the existing page exactly
A. Scope (apply to everything): keep a lead only if ALL are true:
   - תאריך כניסה string >= "2026-09-03" (plain string comparison, no Date)
   - סדר עבודה does NOT contain "🟤"
   - סדר עבודה does NOT contain "ממתינים לתגובת"
B. Tabs (owner filter on top of scope), in this order:
   "בר"  → אחראי choice id seloPmlNWEDizoZCb
   "עומר" → אחראי choice id selbh3WaP4gJfLiAw
   "כל הצוות" → no owner filter
   Default tab: "בר".
C. KPI counts (scope + tab):
   להיום       = סדר עבודה contains "לקרות היום"
   לאישורך     = יש הודעה ממתינה === "כן"
   דורש בדיקה  = סדר עבודה contains "דורש בדיקה"
   לידים חדשים = מצב טיפול choice id selI4ZU4gq0DcYEkZ AND יש הודעה ממתינה !== "כן"
D. List: group by the first character of סדר עבודה, groups in this fixed
   order, show a group only if it has leads:
   "🔴" · "🟠" · "🟣". Group title = text after the emoji up to " · ";
   group subtitle = text after " · ". Inside a group sort by סדר ascending
   (string compare).
E. Clicking a KPI card filters the list to that KPI's leads (same rule as
   in C); clicking it again clears the filter. Local UI state only.
   Clicking a group header collapses / expands it. Local UI state only.
F. Clicking a lead card: open the record with expandRecord(record) from the
   interface SDK if it exists. If it does not exist, do nothing on click and
   say so in the report. Do not build navigation or a URL hack.

VALIDATION (data in DEV on 9.11.2026 — your numbers must match):
   tab בר: להיום 2 · לאישורך 1 · דורש בדיקה 2 · לידים חדשים 1
   tab עומר: 3 · 1 · 1 · 1
   tab כל הצוות: 5 · 2 · 4 · 3   (groups: 🔴 5, 🟠 4)

LEAD CARD CONTENT (per lead)
- name     = שם ליד
- chips    = כותרת with the leading "<שם ליד> · " removed, then split on " · "
             (e.g. "ויואלדי", "6 רפורמרים", "תל אביב", "עסקי")
- owner    = אחראי name, or none
- next     = מה עכשיו; if it ends with " · טיפול אישי" remove that suffix
             (shown separately as a tag)
- personal = טיפול אישי checked
- warnings = סיבת עיכוב split on " · " (each one a pill);
             if סיבת עיכוב is empty, show למה עכשיו as one neutral pill;
             if both empty, no warnings row.
  Warning color: RED if the text contains "המועד עבר" or "נחסמה" or
  "אין אחראי" or "דורשת בירור"; AMBER if it contains "אין תאריך" or
  "ללא פעילות" or "בדיקת נתונים"; otherwise NEUTRAL.

DESIGN — follow these values exactly. Do not improvise, do not simplify.
Avoid: gradients, glow, glass, emoji (the 🔴🟠🟣 are only parsed, never
shown), colored full backgrounds on cards, all-caps, centered layouts.

THEME
  pageBg #F7F5FF · surface #FFFFFF · ink #1F1235 · inkSoft #5B5470
  muted #6B6385 · line #ECE8F7 · lineSoft #F1EEFB · accent #6D28D9
  accentSoft #EDE9FE · accentInk #2E1065
  red #DC2626 / redNum #B91C1C / redBg #FEF2F2 / redSoft #FEE2E2 / redInk #991B1B
  amber #D97706 / amberNum #B45309 / amberBg #FFFBEB / amberSoft #FEF3C7 / amberInk #92400E
  violet #7C3AED / violetNum #6D28D9
  green #059669 / greenNum #047857
  neutralBg #F3F4F6 / neutralInk #374151
  owner בר: bg #DBEAFE ink #1E40AF · owner עומר: bg #D1FAE5 ink #065F46
  chipBg #F5F3FA chipInk #4A4360
  shadowCard 0 1px 2px rgba(46,16,101,.05)
  shadowHover 0 8px 20px rgba(46,16,101,.10)

PAGE
  background pageBg; content max-width 1280px, centered, padding 32px 28px 56px;
  vertical gap 24px between header, KPI row, list.

1. HEADER (one row; wraps on narrow screens)
   Right side (RTL start): title "משימות להיום" 34px/800 ink, letter-spacing
   -0.01em; under it 16px inkSoft: "כל מה שדורש פעולה מהצוות עכשיו או במהלך היום."
   Left side: segmented tabs in a pill container: background surface,
   1px solid #E9E4F7, radius 999px, padding 4px, gap 4px.
   Each tab: radius 999px, padding 8px 20px, min-height 40px, 15px/600.
   Selected tab: background accent, white text. Unselected: transparent,
   text accentInk, hover background accentSoft.
   Tabs "בר" and "עומר" start with a 22px round avatar (first letter, 12px/700,
   owner colors). "כל הצוות" has no avatar.

2. KPI ROW — 4 equal columns, gap 16px (2 columns under 1100px, 1 under 560px).
   Order right→left: להיום · לאישורך · דורש בדיקה · לידים חדשים.
   Each KPI is a <button>: background surface, radius 22px, padding 20px,
   1px solid line, shadowCard, column layout, gap 16px.
   Top row: icon tile 40×40, radius 14px, background = KPI color at 10%
   opacity, icon 20px in KPI color; next to it label 16px/700 ink and
   description 13px inkSoft (line-height 1.35).
   Bottom: number 44px/800, tabular-nums, in the KPI "Num" color, followed by
   a unit word 14px muted.
   KPI   | color  | Num color | icon            | description                              | unit
   להיום | red    | redNum    | clock           | לקוח שמחכה, איחור, או מתוזמן להיום       | לידים
   לאישורך | amber | amberNum | chat bubble+check | טיוטות שמחכות לאישור שלך              | טיוטות
   דורש בדיקה | violet | violetNum | warning triangle | משהו חוסם ואי אפשר להתקדם        | לידים
   לידים חדשים | green | greenNum | person + plus | הגיעו ועדיין לא פנינו אליהם            | לידים
   Hover: translateY(-2px) + shadow 0 12px 28px rgba(46,16,101,.12), 150ms.
   Active (filtering): 2px solid accent border + background #F7F5FF.

3. LIST — one container: background surface, 1px solid line, radius 24px,
   padding 8px.
   Group header = full-width <button>: radius 16px, padding 16px, hover
   background pageBg. Right: a 12px dot in the group color with a 4px ring
   in its soft color (box-shadow 0 0 0 4px), then title 18px/700 ink and
   subtitle 14px inkSoft under it. Left: count pill (14px/700, padding 3px 12px,
   radius 999px, soft bg + ink of the group) and a chevron that rotates
   when open.
   Group colors: 🔴 red/redSoft/redInk · 🟠 amber/amberSoft/amberInk ·
   🟣 violet/accentSoft/accentInk.
   Cards area under an open group: CSS grid, 2 equal columns (1 under 1100px),
   gap 12px, padding 4px 16px 20px.

4. LEAD CARD — a <button>, text-align right, background surface,
   1px solid lineSoft, radius 18px, padding 18px, shadowCard, column, gap 12px.
   Hover: translateY(-1px), shadowHover, border #DDD6FE. Focus: 3px #C4B5FD
   outline, offset 2px.
   Row 1: left = name 17px/700 ink; under it the chips (13px/500, padding
   3px 10px, radius 999px, chipBg/chipInk, wrap, gap 6px).
   Right end of row 1: owner avatar 32px round, first letter 14px/700, owner
   colors, title + aria-label "אחראי: <name>". No owner → neutral pill
   "אין אחראי" (13px/600, neutralBg/neutralInk).
   Row 2: "next" pill — background accent, white 14px/600, padding 5px 14px,
   radius 999px, with a small arrow icon before the text. If personal: a tag
   "טיפול אישי" next to it (13px/600, accentSoft bg, #5B21B6 text).
   Row 3 (only if warnings): top border 1px lineSoft, padding-top 12px,
   warning pills wrap with gap 6px: 13px/600, padding 3px 10px, radius 999px,
   small info icon (circle + !) before the text.
   RED pill = redBg/redNum · AMBER pill = amberBg/amberInk · NEUTRAL =
   neutralBg/neutralInk.

ACCESSIBILITY: every clickable thing is a real <button>; KPI buttons have
aria-pressed; group headers have aria-expanded; tabs have role="tab" and
aria-selected inside role="tablist"; all text ≥ 13px; contrast WCAG AA.

REPORT
First line exactly: "Not executed — cannot run against live data".
Then: (1) the new page ID and element ID; (2) confirmation no other page
was changed; (3) the exact filter code for scope, tabs and each KPI;
(4) whether expandRecord was available; (5) confirmation that the file has
no write calls and no Date / toLocale usage.
```
