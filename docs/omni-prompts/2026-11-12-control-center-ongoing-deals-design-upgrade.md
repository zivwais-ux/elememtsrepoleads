# Omni prompt · Control Center + Ongoing deals: שדרוג עיצוב

> נכתב 12.11.2026. עיצוב בלבד, על האלמנטים הקיימים בשני העמודים. בלי דפים חדשים ובלי שינוי לוגיקה או נתונים.
> **סדר הרצה:** קודם פרומפט "Control Center: לא לספור לידי דוגמה" (אם עדיין לא הורץ), ורק אחריו זה. את שני העמודים מריצים בשתי הרצות נפרדות.
> **לא ללחוץ Publish.** אחרי כל הרצה אני מוריד את הקוד ומשווה. אסור שיופיע שינוי בחישובים, בסינונים, במזהי שדות, בטקסטים בעברית או בכתיבה.
> הערה: לא קראתי מחדש את הקוד של שני העמודים בסשן הזה, ולכן הפרומפט מנוסח כללי ונשען על הקבועים שבקוד. אם Omni לא מוצא אחד מהם, הוא אמור לדווח ולא לנחש.

---

## הרצה 1: Control Center

```
Edit ONLY the custom element on page "Control Center" (pagbmvRqFHOgLUjA4,
interface Elements Daily Ops). Do not publish. Do not create or delete pages.
Do not touch any other page, table, field, view or automation.

GOAL: raise the visual quality of the existing page. VISUAL CHANGES ONLY.

HARD RULES (violating any = revert that edit):
- Do not change any calculation, filter, grouping, drill-down logic, state,
  hook, field ID, table ID, or any Hebrew text string.
- Keep RTL. Keep every font size >= 13 and every click target >= 36px high.
- Keep focus-visible outlines. Respect prefers-reduced-motion.
- Colors only from the existing palette (purple family + existing semantic
  colors) and tints of it. No new hues, no external fonts, no new dependencies.
- Keep the same visual language as the page "Main Dashboard": radius scale
  8 / 16 / 9999, card shadow
  '0 1px 2px rgba(46,16,101,0.06), 0 6px 20px rgba(46,16,101,0.07)',
  font stack 'Heebo','Assistant','Segoe UI',system-ui,sans-serif.

Steps (confirm the page renders after each):
1) TYPOGRAPHY: apply the font stack above; tabular-nums on every number,
   amount and percentage; clear hierarchy: page title 20/700, section title
   16/700, body 14, caption 13 in the muted ink color.
2) HEADER: compact and consistent with Main Dashboard (padding 12px 20px,
   title 20). Filters (period, owner, "הצג לידי דוגמה" checkbox if present)
   in one aligned row, chips 36px high, selected = solid, unselected = outline.
3) KPI / REVENUE CARDS: the big number 28-32/700, label 13 above or below it,
   a small colored icon circle (28px) on the start side, hover lift 2px with
   the hover shadow. Equal height in each row, equal 16px gaps.
4) CHARTS / BREAKDOWNS: consistent card shell (white, radius 16, 1px
   hairline border, 16-24px padding); titles left-aligned to the start side;
   gridlines in a very light purple tint; bar and segment colors only from
   the existing palette, with at least 3:1 contrast against the card; legends
   and axis labels >= 13px; value labels tabular-nums.
5) TABLES / LISTS: sticky header row, zebra or hairline rows (not both), row
   hover tint PAL.purple50, numeric columns aligned to the end side, compact
   but >= 36px rows.
6) DRILL-DOWN PANEL (if present): same card style, a clear close button
   (36px), and the active filter shown as a removable pill.
7) EMPTY / ZERO STATES: friendly muted message, centered, 24px vertical
   padding, no raw "0" blocks without a label.
8) RESPONSIVE: no horizontal page scroll at widths 390, 768, 1280; cards
   wrap to one column on mobile.

Everything not listed stays byte-identical. Send screenshots at width 1280
of the top of the page, the revenue block, one chart/table section and an
open drill-down, plus the top of the page at width 390.
```

---

## הרצה 2: Ongoing deals

```
Edit ONLY the custom element on page "Ongoing deals" (interface Elements
Daily Ops). Do not publish. Do not create or delete pages. Do not touch any
other page, table, field, view or automation.

GOAL: raise the visual quality of the existing page. VISUAL CHANGES ONLY.

HARD RULES (violating any = revert that edit):
- Do not change any logic, sort order (quote high to low, then name), stage
  grouping, filter, field ID, table ID, link target or Hebrew text string.
- The page stays read-only. Add no write calls.
- Keep RTL. Keep every font size >= 13 and every click target >= 36px high.
- Keep focus-visible outlines. Respect prefers-reduced-motion.
- Colors only from the existing palette and tints of it. Keep the three stage
  edge colors (before meeting / hot lead / relevant for later) as they are.
- Same visual language as the page "Main Dashboard": radius 8 / 16 / 9999,
  card shadow '0 1px 2px rgba(46,16,101,0.06), 0 6px 20px rgba(46,16,101,0.07)',
  font stack 'Heebo','Assistant','Segoe UI',system-ui,sans-serif.

Steps (confirm the page renders after each):
1) TYPOGRAPHY: font stack above; tabular-nums on every amount and count.
   Deal name 16/700, secondary line 14 in the muted ink, footer 13.
2) HEADER: compact (padding 12px 20px, title 20), totals shown as small KPI
   tiles with a 28px icon circle, not as plain text.
3) COLUMNS: header sticky inside each column; stage name 16/700; count pill
   28px; the column sum 22/800 with the caption "X מתוך Y עם הצעה" in 13
   muted; 4px top edge in the stage color; soft column surface so cards stand
   out from it; thin scrollbar on the card list.
4) DEAL CARDS: padding 16, radius 16, hairline border, 4px inline-start edge
   in the stage color, hover lift 2px with the hover shadow. The quote amount
   is the visual anchor (16/700); "אין הצעה" is muted 13. Owner shown as a pill
   (purple tint) or an initial avatar, "דורש בדיקה" as an amber pill. The
   "הבא ·" footer separated by a hairline, text clamped to two lines.
5) EMPTY STATES: a column with no deals shows a friendly muted message with a
   small icon, centered.
6) RESPONSIVE: columns scroll horizontally inside their own container on
   mobile, with no page-level horizontal scroll at 390, 768, 1280.

Everything not listed stays byte-identical. Send screenshots at width 1280
(full board) and at 390, plus one close-up of a deal card.
```

## בדיקת קבלה, אחרי כל הרצה
1. אני מוריד את הקוד ומשווה לגרסה שלפני. ההבדלים צריכים להיות רק ב-style, בקבועי עיצוב ובמחרוזות CSS.
2. אותם מספרים וסכומים כמו לפני (הכנסות, מספר לידים, סכומי עמודות), אותו סדר כרטיסים.
3. אתה בודק בעין, כולל בטלפון. אם משהו לא מוצא חן, מבטלים שלב בודד.
