# Omni prompt · Main Dashboard UI polish (short follow-up)

> נכתב 9.11.2026. פרומפט המשך קצר לפרומפט v2 (הסגול נשאר). אותם כללים: לא ללחוץ Publish, ואחרי הביצוע צילום מסך + הדוח של Omni.

---

```
EDIT IN PLACE — Main Dashboard (pagTW81hjKberKKyz), element pel0Bqu4JFABjCWnW.
No new page/element, no rebuild, no publish.

Push the UI from "basic" to a polished, modern SaaS product the team enjoys
opening every morning. Purple stays the brand. Visual layer only.

Make it feel premium:
- Depth: soft layered shadows, 12–16px radius, white cards that float on
  the lavender background.
- Hierarchy: big bold numbers, clear section titles, quieter secondary text.
  One glance = what needs me today.
- Micro-interactions: smooth hover lift on cards and tiles (150ms), pressed
  state on buttons, animated count-up on the tile numbers on load.
- Friendly empty states: when a column has 0 items show a short positive
  line with an icon (e.g. "הכל טופל 🎉") instead of blank space.
- Small personal touch in the header: "בוקר טוב, בר" / "צהריים טובים" by
  time of day, using the selected owner filter (keep "כולם" → "בוקר טוב").
- Consistent icon set (one style, outline), aligned with text, RTL-correct.
- Generous whitespace, 8px grid, nothing cramped, nothing smaller than 13px.

Hard rules (unchanged): no change to data, queries, filters, counters,
sorting, the write gate, approve/reject/edit, or field reads. Do not touch
dates.ts or selfTest(). Keep initializeBlock and all error boundaries.
Keep every Hebrew label word for word. WCAG AA contrast everywhere.
The greeting uses the browser clock via the existing dates module only.

Report: first line "Not executed — cannot run against live data", then
files changed, what changed, and confirmation that the hard rules held.
```
