# Omni prompt · כל העמודים: שדרוג עיצוב רציני + שדרוג טכני

> נכתב 13.11.2026, אחרי בדיקת הקוד שהחזיר Omni ב-Main Dashboard (גרסה `bbdxXPjyhNsWuFubN`).
> הרצה בשלוש פעימות נפרדות: Main Dashboard, Control Center, Ongoing deals. אחרי כל אחת אני מוריד את הקוד ומשווה.
> **לא ללחוץ Publish.**

## ממצאי הבדיקה של ההרצה הקודמת (Main Dashboard)
- כיווץ החלק הסגול והעיצוב הבסיסי נכנסו כמתוכנן. הלוגיקה, השער, השדות והחישובים לא השתנו.
- **נמצאה סטייה:** נוסח הודעת ה-WhatsApp שאושר ("*Elements* 🙂") הוחלף ב-"Elements :)", ובניית הקישור עברה מ-`wa.me` ל-`api.whatsapp.com`. זה לא ביקשתי. הבלוק הראשון למטה מחזיר את הנוסח המאושר.
- **עדיין חסר:** שורת האריחים עוטפת לשורה שנייה במסך צר (`flexWrap:'wrap'` עם `minWidth:110`), וכרטיסי הלידים בעמודות צרים (`colMin:290`).

---

## הרצה 1: Main Dashboard

```
Edit ONLY the custom element on page "Main Dashboard" (pagTW81hjKberKKyz,
interface Elements Daily Ops). Do not publish. Do not create or delete pages.
Do not touch any other page, table, field, view or automation.

HARD RULES (violating any = revert that edit):
- Do not change the WL_* whitelists, assertWritable, safeUpdate, safeCreate,
  any field ID or table ID, the date module, or any Hebrew text string,
  except where a step below says so explicitly.
- Colors only from PAL and tints of it. No external fonts or dependencies.
- RTL. Font >= 13. Click targets >= 36px. Keep focus-visible outlines and
  prefers-reduced-motion.

STEP 0. REVERT AN UNREQUESTED CHANGE. In function waText, the first template
line must be EXACTLY:
  `היי${name ? ' '+name : ''}, ${who ? 'כאן '+who+' מ-' : 'אנחנו מ-'}*Elements* 🙂\n` +
(currently it says "Elements :)" and lost the asterisks and the emoji).
Keep the new percent-encoding helper in waUrl, but report in one line why
the URL was changed from wa.me to api.whatsapp.com. Do not change anything
else in waDigits / waInterest / waText.

PART A. DESIGN

A1) TILE ROW (the row of filter cards under the title). It must be ONE
    clear, long row that uses the full width and never drops tiles to a
    second line on screens >= 768px:
    - THEME.tilesRow -> {display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:12}
      for the 6-tile "today" row, and repeat(3, 1fr) for the deals row.
      Below 768px: 2 columns (use a CSS class in GS with a media query).
    - Each tile: minHeight 64, padding 12, radius 16, icon circle 32,
      number 28/700, label 13/500 on one line (ellipsis, never wrap to 2),
      the selected tile with the 2px purple border and tinted background.
    - Row height must stay compact: the purple header must not grow by more
      than 16px compared to now.

A2) BOARD CARDS. Lead cards in the columns are too narrow and get pushed down.
    - BOARD.colMin 290 -> 340, and the board container uses
      gridAutoFlow:'column' / flex with gap 16 so 3 columns fill the width
      evenly on 1280 and scroll horizontally (inside the board only) below 1100.
    - TodayCard / FullDealCard: padding 16, one-line name with ellipsis,
      tags on one row, "הבא ·" footer clamped to 2 lines, equal card height
      is NOT required.
    - Add a quick-action row at the bottom of TodayCard: two small buttons,
      "📞" (href tel:+digits) and "💬" (href waUrl(...) target _blank),
      built with the SAME helpers and the same disabled logic as in LeftPane
      (waDigits, waUrl, waText, noContact check). Clicking must call the same
      onLogContact flow LeftPane uses, by opening the drawer first
      (onOpen) and then the log form. No new write paths. If that cannot be done
      without touching the write gate, skip this item and say so.

A3) Remaining polish from the previous design prompt: consistent radius scale
    (8 / 16 / 9999), card hover lift, sticky column headers (done), 36px
    empty-state emoji (done), no horizontal page scroll at 390 / 768 / 1280.

PART B. TECHNICAL (no behavior change for the user)

B1) PERFORMANCE. The queue and board render all matching leads. Render the
    first 40 cards per column and a "הצג עוד 40" button below them (local
    state per column, reset when owner / category / search changes). Counts,
    sums and tiles must keep using the FULL set, not the rendered slice.
B2) STABILITY. Wrap each column and the drawer in the existing EB error
    boundary so one bad record cannot blank the page. Make getStr never throw
    on a missing field (it already returns a bracket text; make sure the UI
    hides "[שדה ... לא נמצא]" values in cards and shows nothing instead).
B3) STATE. Remember the last owner filter and mode (today / deals) in
    localStorage under 'elements.mainDashboard.v1', every read and write
    inside try/catch, and the page must work if storage is blocked.
B4) FEEDBACK. A small toast (bottom start, 3 seconds, role="status") after
    every successful or failed write, using the strings the code already
    produces ("✓ נשמר" / the gate's error). Do not add new Hebrew strings
    except "הצג עוד".
B5) HEALTH BANNER. If sendingOn === false, show a slim, dismissible strip
    (session only) under the header: "השליחה כבויה · האישור נרשם וההודעה לא נשלחת". This is a read-only
    display using the existing sendingOn value.
B6) CLEANUP. Remove dead code that is not referenced (check with a search):
    SWITCH_CAPTION, unused helpers or constants. Do not remove anything that is
    referenced.
B7) KEYBOARD. "/" focuses the search field (ignored while typing in an
    input); Esc already closes the drawer, keep it.

Everything not listed stays byte-identical. Send screenshots at 1280 and 390:
היום, עסקאות, drawer open, search results, and the "show more" button.
```

---

## הרצה 2: Control Center

```
Edit ONLY the custom element on page "Control Center" (pagbmvRqFHOgLUjA4,
interface Elements Daily Ops). Do not publish. Do not create or delete pages.
Do not touch any other page, table, field, view or automation.

HARD RULES: no change to any calculation, filter, grouping, drill-down logic,
field ID, table ID, write call or Hebrew text string. Colors only from the
existing palette. RTL. Font >= 13. Targets >= 36px. Keep focus-visible and
prefers-reduced-motion. Same visual language as Main Dashboard: radius scale
8 / 16 / 9999, card shadow '0 1px 2px rgba(46,16,101,0.06), 0 6px 20px rgba(46,16,101,0.07)',
font stack 'Heebo','Assistant','Segoe UI',system-ui,sans-serif.

DESIGN
1) Compact header (padding 12px 20px, title 20), one aligned row of filters,
   chips 36px, selected = solid, unselected = outline.
2) KPI cards in ONE long grid row (repeat(auto-fit, minmax(180px, 1fr)),
   gap 12): number 28/700 tabular-nums, label 13, 32px icon circle, hover lift.
3) Charts and tables in one card shell (white, radius 16, hairline border,
   16-24px padding), start-aligned titles, light gridlines, legends and axis
   labels >= 13, sticky table header, row hover tint, numeric columns aligned
   to the end side.
4) Drill-down panel: same card style, 36px close button, active filter as a
   removable pill. Friendly empty / zero states.
5) No horizontal page scroll at 390 / 768 / 1280.

TECHNICAL
6) Wrap each section in the existing error boundary pattern (or add a small
   one) so a failing section shows an inline message and the rest renders.
7) Memoize the heavy aggregations (useMemo with the right dependencies) and
   make sure nothing is recomputed on hover or on drawer open.
8) Show a one-line "עודכן לאחרונה" caption using the data already loaded
   (no new queries). If there is no suitable timestamp, skip it.
9) Remember the selected period and owner in localStorage under
   'elements.controlCenter.v1' (try/catch on every access).

Everything not listed stays byte-identical. Screenshots at 1280 (top, revenue,
one chart, one drill-down) and the top at 390.
```

---

## הרצה 3: Ongoing deals

```
Edit ONLY the custom element on page "Ongoing deals" (interface Elements
Daily Ops). Do not publish. Do not create or delete pages. Do not touch any
other page, table, field, view or automation.

HARD RULES: the page stays READ-ONLY (no write calls). No change to sort
order (quote high to low, then name), stage grouping, filters, field IDs,
table IDs, link targets or Hebrew text strings. Keep the three stage edge
colors. RTL. Font >= 13. Targets >= 36px. Same visual language as Main
Dashboard (radius 8 / 16 / 9999, the same shadow, the same font stack).

DESIGN
1) Compact header (padding 12px 20px, title 20) with totals as small KPI
   tiles in ONE long row (grid, auto-fit minmax(180px, 1fr)).
2) Columns: min width 340, sticky header, stage name 16/700, count pill 28px,
   column sum 22/800, caption "X מתוך Y עם הצעה", soft surface, thin scrollbar.
3) Deal cards: padding 16, radius 16, 4px inline-start stage edge, hover lift,
   quote amount as the visual anchor (16/700), owner pill, amber "דורש בדיקה"
   pill, "הבא ·" footer clamped to 2 lines.
4) Friendly empty state per column. No horizontal page scroll at 390 / 768 / 1280.

TECHNICAL
5) Render the first 40 deals per column with a "הצג עוד 40" button (counts and
   sums keep using the full set).
6) Error boundary around each column; memoize per-column sorting and sums.
7) Remember the last owner or stage filter in localStorage under
   'elements.ongoingDeals.v1' (try/catch on every access).

Everything not listed stays byte-identical. Screenshots at 1280 (full board),
at 390, and a close-up of one deal card.
```

## בדיקת קבלה אחרי כל הרצה
1. אני מוריד את הקוד ומשווה. הבלוק הראשון חייב להחזיר את נוסח ה-WhatsApp המאושר.
2. אין שינוי ב-WL_*, בשער הכתיבה, במזהי שדות, בחישובים או בסדר המיון.
3. אותם מספרים באריחים ובסכומים. "הצג עוד" לא משנה ספירות.
4. אתה בודק בעין, כולל בטלפון. אפשר לבטל שלב בודד.
