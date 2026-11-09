# Omni prompt · Main Dashboard: card redesign + one data point · v2 (verified)

> נכתב 9.11.2026. v2 אומת מול הקוד הנוכחי של האלמנט (טיוטה מ-9.11 20:18, `blk0BoyJz7lxEAh6O`), שהורד בקריאה בלבד.
> היעד: Main Dashboard של Elements Daily Ops. לא העמוד "משימות להיום" בממשק הישן, שבנוי מאלמנטים מובנים ואי אפשר לעצב אותם בקוד.
> לא ללחוץ Publish. אחרי הביצוע: הדוח של Omni וצילום מסך.

## מה תוקן לעומת v1, ולמה

| # | הבעיה ב-v1 | מה נמצא בקוד | התיקון |
|---|---|---|---|
| 1 | "outline icon" | אין ספריית אייקונים באלמנט. ב-package.json יש רק react ו-@airtable/blocks | SVG inline בלבד, ואסור להוסיף חבילות או לגעת ב-package.json. הוספת חבילה עלולה לשבור את הבנייה |
| 2 | מפרט הכרטיס פירט רק חלק מהשדות | הכרטיס מציג גם תגית סטטוס, "דורש בדיקה", "ארכיון", "אין אחראי", ו"הבא · לא נקבעה פעולה" | חובה לשמור כל פיסת מידע שקיימת בכרטיס |
| 3 | "אווטאר עם האות הראשונה" | כשאין אחראי מוצג "אין אחראי", ו-159 לידים פעילים בלי אחראי | אווטאר רק כשיש אחראי. כשאין, נשאר הטקסט "אין אחראי" |
| 4 | "באיחור X ימים" | מחושב ב-`overdueDays(nextDate\|\|'')`, פונקציה ממודול התאריכים | הקריאה נשארת כמו שהיא. משנים רק את העיצוב סביבה |
| 5 | "Lead cards" בלי היקף | יש שלושה סוגי כרטיסים: TodayCard, FullDealCard, ListCard | רק TodayCard ו-TodayColumn. השאר לא משתנים |
| 6 | הגלולה "תשתמש בחישוב הקיים" | ב-App כבר קיים `boardDeals = buildBoardDeals(leads, owner)`, אבל Banner לא מקבל אותו | שני props חדשים ל-Banner: `boardDeals.length` ו-`sumQuotes(boardDeals)`. זו הצנרת היחידה שמותר להוסיף |
| 7 | — | הסכום יהיה ₪0 כי אין הצעות מתועדות | כשהסכום 0 מציגים "אין הצעות עדיין", באותו דפוס כמו אריחי העסקאות ("אין הצעות") |
| 8 | — | לאריחים ולכרטיסים יש `title`, `aria-pressed`, `role`, `tabIndex`, `onKeyDown` ו-classNames (`kpi`, `deal-card`) | שומרים את כולם. הם הנגישות והפוקוס |

---

```
EDIT IN PLACE — Elements Daily Ops › Main Dashboard (pagTW81hjKberKKyz),
element pel0Bqu4JFABjCWnW. No new page/element, no rebuild, no publish.
No new npm packages. Do not touch package.json or tailwind config.

Two changes. Purple stays the brand (use the existing PAL / THEME objects;
add new style values there, nowhere else).

1) RESTYLE — look like a real product (Linear / Attio / Stripe), not generic
   AI UI. Avoid: gradients, glassmorphism, glow, heavy shadows, emoji as
   decoration, rainbow colors.

   a) Category tiles in Banner (both the today tiles and the deals tiles):
      radius 20px, white, 1px border #EDE9FE, shadow 0 1px 2px rgba(46,16,101,.06),
      padding 20px. Number 34px/700 #1F1235, fontVariantNumeric 'tabular-nums'.
      Optional small icon: inline <svg> only, 18px, inside a 36px circle
      (tile edge color at 12% opacity). Selected: 2px #6D28D9 border,
      background #F7F5FF. Hover: translateY(-1px), 150ms.
      Keep every tile's content, title attribute, aria-pressed, onClick,
      className "kpi", the deals tiles' sum line, and the red mismatch alert.

   b) TodayCard and TodayColumn ONLY (do not change ListCard or FullDealCard):
      card radius 16px, padding 16px, 1px border #F1EEFB; column radius 20px,
      background #FBFAFF, 12px gap between cards, header = title + count pill.
      You may replace the 4px colored side edge with an 8px colored dot
      before the name.
      KEEP every piece of information the card shows today: name, "ארכיון"
      marker, "דורש בדיקה" tag, sales-status tag, product · city, owner,
      overdue, and the "הבא · …" line with its "לא נקבעה פעולה" fallback.
      Owner: if an owner exists, show a 24px round avatar with the first
      letter AND the name as aria-label/title; if empty, keep the text
      "אין אחראי" exactly as today.
      Overdue: keep the existing overdueDays(nextDate||'') call untouched;
      only restyle the pill (#FEF2F2 bg, #B91C1C text, radius 999px).
      Keep role, tabIndex, onKeyDown, aria-pressed, className "deal-card".

2) ONE DATA POINT — a compact pill in the Banner title row, shown only when
   mode === 'today': "עסקאות פתוחות: N · ₪X בהצעות".
   Plumbing allowed (and only this): in App, pass two new props to Banner:
   openCount = boardDeals.length and openSum = sumQuotes(boardDeals), using
   the existing boardDeals memo. No new field reads, no new queries, no new
   filters. If openSum is 0 show "עסקאות פתוחות: N · אין הצעות עדיין".
   Clicking the pill calls the existing onMode('deals'). Nothing else.

HARD RULES: no change to existing data logic, queries, filters, counters,
sorting, the category-sum invariant, the write gate, approve/reject/edit,
or field reads. Do not touch dates.ts or any function in the DATE & TIME
MODULE, selfTest(), initializeBlock, or the EB error boundaries. Keep every
Hebrew label word for word. RTL. WCAG AA contrast. Nothing smaller than 13px.

Report: first line "Not executed — cannot run against live data". Then:
1. Files changed and what changed (style values before → after).
2. The exact lines added for the pill (props + render + click).
3. Confirmation, item by item, that nothing listed under HARD RULES and
   nothing listed under KEEP was changed or removed.
```
