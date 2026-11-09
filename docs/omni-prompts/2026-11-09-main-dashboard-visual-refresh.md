# Omni prompt · Main Dashboard visual refresh (minor)

> נכתב 9.11.2026. שינוי ויזואלי בלבד, בלי שינוי בלוגיקה, בנתונים או בכתיבה.
> לפני השליחה: לא ללחוץ Publish. אחרי ש-Omni מסיים: צילום מסך, ואני מצליב את המספרים מול הבסיס.

---

```
EDIT IN PLACE — visual styling only.
Interface: Elements Daily Ops (pbdIyh3aqTTfi2btj)
Page: Main Dashboard (pagTW81hjKberKKyz)
Element: pel0Bqu4JFABjCWnW
No new page. No new element. No delete. No rebuild. No publish.

GOAL
The screen is almost entirely purple and hard to read. Make it calm, light and
readable. This is a MINOR visual pass: change colors, spacing and typography
only. Every number, label, filter, sort, grouping, counter and button must
behave exactly as it does now.

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
the palette can be changed in one place later.

Palette:
- Page background: light neutral gray, e.g. #F6F7F9.
- Surfaces (cards, columns, header area): white #FFFFFF, 1px border #E5E7EB,
  radius 12px, very soft shadow (0 1px 2px rgba(0,0,0,0.06)).
- Text: primary #111827, secondary #4B5563. No text lighter than #6B7280.
- ONE accent color for interactive/selected states only, e.g. indigo #4F46E5
  (or keep the current purple, but only as an accent, never as a large
  background).
- Status colors are semantic only and stay as they are in meaning:
  red = today/overdue, orange = needs review, green = waiting for customer,
  purple = future. Use them as thin accents (top border of a column,
  left/right edge of a card, small badge), never as full backgrounds.

Header / banner (the purple block with the today|deals toggle, title and
category tiles):
- Replace the full purple background with a white (or very light gray) panel.
- Title "משימות להיום" in primary text color, the count badge in the accent.
- Today | Deals toggle: neutral segmented control; the selected segment uses
  the accent color with white text, the other is white with gray text.
- Owner filter chips (כולם / בר / עומר): white chips with gray border;
  the selected chip uses the accent.
- Category tiles (הכל, דורש תגובה ללקוח, הודעה לאישור, שיחות ופגישות,
  דורש בדיקה, לידים חדשים): white cards, large number in primary text color,
  label underneath in secondary color, a 3px colored top edge matching the
  category's semantic color. The selected tile gets the accent border (2px)
  and a very light accent background (accent at ~8% opacity).

Queue columns (להיום / דורש בדיקה / בהמשך):
- White column background, keep the colored top border.
- Count badge: light tint of the column color with dark text.
- Lead cards: white, 12px padding minimum, 8px gap between cards.
  Lead name 16px semi-bold, secondary line 14px. Keep the colored edge.
- Overdue text ("באיחור X ימים"): keep red, but make sure it passes contrast
  (#B91C1C on white).

Typography and spacing:
- Body text minimum 14px, never smaller than 13px anywhere.
- Consistent 8px spacing scale (8 / 16 / 24).

Accessibility:
- All text must meet WCAG AA contrast (4.5:1 for normal text, 3:1 for large).
  In particular: no white text on light purple, no light-gray text on white.
- Visible focus outline on every clickable element (2px accent outline).
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
