# Omni prompt · Main Dashboard: card redesign + one data point

> נכתב 9.11.2026. היעד הוא Main Dashboard של Elements Daily Ops (custom element), ולא עמוד "משימות להיום" בממשק הישן: העמוד הישן בנוי מאלמנטים מובנים של Airtable, ואי אפשר לעצב אותם בקוד.
> לא ללחוץ Publish. אחרי הביצוע: הדוח של Omni וצילום מסך.

---

```
EDIT IN PLACE — Elements Daily Ops › Main Dashboard (pagTW81hjKberKKyz),
element pel0Bqu4JFABjCWnW. No new page/element, no rebuild, no publish.

Two changes. Purple stays the brand.

1) REDESIGN THE CATEGORY TILES AND LEAD CARDS — look like a real product
   (think Linear / Attio / Stripe dashboard), not generic AI UI.
   Avoid: gradients, glassmorphism, glow, heavy shadows, emoji as decoration,
   all-caps, centered everything, rainbow colors.
   Do:
   - Tiles: white, radius 20px, 1px border #EDE9FE, shadow
     0 1px 2px rgba(46,16,101,.06). Padding 20px.
     Top row: a 36px soft circle (category color at 12% opacity) holding one
     outline icon (same icon set everywhere), label to its side (14px, #5B5470).
     Below: the number, 34px, weight 700, #1F1235, tabular figures.
     Selected tile: 2px #6D28D9 border, background #F7F5FF. Hover: border
     #DDD6FE, translateY(-1px), 150ms.
   - Lead cards: white, radius 16px, padding 16px, 1px border #F1EEFB, no
     colored full edge — instead a 8px status dot before the lead name.
     Name 16px/600, meta line 14px #5B5470, the "next action" line in a
     soft pill (#F7F5FF bg, #2E1065 text, radius 999px). Owner as a 24px round
     avatar with the first letter (בר / עומר), not a text badge.
     Overdue: small red pill "באיחור X ימים" (#FEF2F2 bg, #B91C1C text).
   - Columns: radius 20px, header with title + count pill, 12px gap between
     cards, column background #FBFAFF.

2) ADD ONE DATA POINT IN THE TODAY HEADER — a compact pill next to the title:
   "עסקאות פתוחות: N · ₪X בהצעות".
   Compute it ONLY by reusing the values the deals board in this same element
   already computes (the open-deals list and its quotes sum, e.g.
   buildBoardDeals / sumQuotes), with the current owner filter applied.
   Read-only. No new field reads, no new queries, no date code.
   Clicking the pill switches to the existing "עסקאות" mode (same as the
   existing toggle). Nothing else.

HARD RULES: no change to existing data logic, queries, filters, counters,
sorting, the category-sum invariant, the write gate, approve/reject/edit,
or field reads. Do not touch dates.ts, selfTest(), any date/time code,
initializeBlock, or error boundaries. Keep every Hebrew label word for word.
RTL. WCAG AA contrast. Nothing smaller than 13px.

Report: first line "Not executed — cannot run against live data". Then files
changed, what changed, how the pill's numbers are computed (name the exact
existing functions/variables reused), and confirmation the hard rules held.
```
