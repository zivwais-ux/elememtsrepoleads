# Omni prompt · Main Dashboard visual refresh (minor) · v2 · purple kept

> נכתב 9.11.2026. v2: לבקשת זיו, הסגול נשאר כצבע המותג. אין מעבר לאפור.
> שינוי ויזואלי בלבד, בלי שינוי בלוגיקה, בנתונים או בכתיבה.
> לפני השליחה: לא ללחוץ Publish. אחרי ש-Omni מסיים: צילום מסך, ואני מצליב את המספרים מול הבסיס.

---

```
EDIT IN PLACE — visual styling only.
Interface: Elements Daily Ops (pbdIyh3aqTTfi2btj)
Page: Main Dashboard (pagTW81hjKberKKyz)
Element: pel0Bqu4JFABjCWnW
No new page. No new element. No delete. No rebuild. No publish.

GOAL
Keep PURPLE as the brand color of this screen. Do not switch to gray or to
another color. The problem today is not the color but the execution: flat,
washed-out purple everywhere, low-contrast text, tiles that blend into the
background. Make it look polished, readable and premium while staying purple.
This is a MINOR visual pass: colors, contrast, spacing and typography only.
Every number, label, filter, sort, grouping, counter and button must behave
exactly as it does now.

DO NOT TOUCH (hard rules)
1. Data logic: no change to queries, filters, sorting, grouping, counters, the
   category-sum invariant, the search, or the owner filter (כולם / בר / עומר).
2. The write gate and its closed whitelist. No new writes, no new buttons
   that write. Approve / reject / edit-draft stay exactly as they are.
3. The date module (dates.ts) and its selfTest(). Do not touch any date code.
   No new Date(string), no toLocale*, no date math outside dates.ts.
4. Keep initializeBlock({ interface: () => <App/> }) exactly as is.
5. Keep every error boundary.
6. Keep reading display values from the formula fields at runtime. Do not
   hard-code Hebrew strings that the code compares against.
7. Keep all existing Hebrew text and labels word for word. RTL stays RTL.
8. Do not change field names, field IDs, or which fields are read.

DESIGN DIRECTION
Put all colors in ONE theme object (e.g. theme.ts) and use it everywhere, so
the palette can be tuned in one place later.

Purple palette (one family, used with intent):
- purple900 #2E1065 — darkest, for text on light purple surfaces
- purple700 #5B21B6 — header background (deep, rich, not washed out)
- purple600 #6D28D9 — primary accent: selected states, buttons, badges
- purple100 #EDE9FE — light tint: hover, selected-tile background, chips
- purple50  #F7F5FF — page background (very light lavender, not gray)
- White #FFFFFF for cards and columns.
- Text on white: #1F1235 primary, #5B5470 secondary. Nothing lighter.
Status colors stay semantic and are used ONLY as thin accents (column top
border, card edge, small badge), never as large backgrounds:
red = today/overdue, orange = needs review, green = waiting for customer,
purple = future.

Header / banner (the block with the today|deals toggle, title and tiles):
- Keep it purple, but make it ONE solid deep purple (purple700), optionally a
  subtle gradient purple700 → purple600. Remove any washed-out / translucent
  purple layers.
- Title "משימות להיום" and the date line: white, title 24px bold.
- Count badge next to the title: white background, purple700 text.
- Today | Deals toggle: white pill container; selected segment purple600
  with white text; unselected segment white with purple900 text.
- Owner chips (כולם / בר / עומר): unselected = transparent with a 1px white
  border at 60% opacity and white text; selected = solid white with purple700
  text.
- Category tiles (הכל, דורש תגובה ללקוח, הודעה לאישור, שיחות ופגישות,
  דורש בדיקה, לידים חדשים): SOLID WHITE cards on the purple header, so they
  pop. Number 28–32px bold in purple900, label 14px in #5B5470, a 3px
  colored top edge matching the category's semantic color. Selected tile:
  2px purple600 border + purple100 background. Hover: purple100 background.

Below the header:
- Page background purple50 (light lavender), so the whole screen feels
  purple-branded without being heavy.
- Search box: white, 1px border #DDD6FE, purple600 focus ring.

Queue columns (להיום / דורש בדיקה / בהמשך):
- White columns, radius 12px, soft shadow (0 1px 3px rgba(46,16,101,0.08)).
- Keep the colored top border per column.
- Count badge: purple100 background, purple900 text.
- Lead cards: white, 12px padding minimum, 8px gap between cards, keep the
  colored edge. Lead name 16px semi-bold, secondary lines 14px.
- Owner badge on the card (בר / עומר): purple100 background, purple700 text.
- Overdue text ("באיחור X ימים"): #B91C1C so it stays readable.

Typography and spacing:
- Body text minimum 14px, never smaller than 13px anywhere.
- Consistent 8px spacing scale (8 / 16 / 24).

Accessibility:
- All text must meet WCAG AA contrast (4.5:1 normal text, 3:1 large).
  In particular: no white text on light purple, no light-purple text on white.
- Visible focus outline on every clickable element (2px purple600 outline,
  white outline when on the purple header).
- Clickable targets at least 36px tall.
- Never rely on color alone: keep the existing text labels and icons.

REPORT FORMAT
First line, exactly: "Not executed — cannot run against live data"
Then:
1. The list of files you changed.
2. For each file, a short list of what changed (styles only).
3. An explicit confirmation, item by item, that rules 1–8 under
   DO NOT TOUCH were not violated.
4. Anything you could not do, and why.
Do not describe what the screen "shows". Do not publish.
```
