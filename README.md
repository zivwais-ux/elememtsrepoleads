# Elements CRM · מערכת ניהול לידים

מערכת ניהול לידים ל-Elements (ציוד פילאטיס) על Airtable. מקור הפרויקט: מסמך ה-handoff מ-6.11.2026.

| | |
|---|---|
| PROD (חי, מקבל לידים מ-Make) | `appr0tZ1nJYtGdmER` · "Elements CRM" |
| DEV (כל הלוגיקה, blueprint) | `appXkWig8vi5kwzAa` · "Elements CRM (DEV)" |

## בריפו

- [`docs/work-plan.md`](docs/work-plan.md): מה עושים עכשיו, ובאיזה סדר.
- [`docs/plans/2026-11-11-bar-omer-dev-2-days.md`](docs/plans/2026-11-11-bar-omer-dev-2-days.md): בר ועומר ב-DEV, תוכנית ליומיים.
- [`docs/findings/2026-11-11-import-readiness.md`](docs/findings/2026-11-11-import-readiness.md): בדיקת היתכנות לייבוא PROD → DEV ולסינון לידי הדוגמה.
- [`docs/findings/`](docs/findings/): ממצאים מסריקות. קריאה בלבד, בלי נתונים אישיים.

## כללים

1. **PROD:** אין כתיבה בלי אישור מפורש.
2. **מתגי השליחה** נשארים false.
3. **בדיקות:** רק על לידי TEST חדשים ב-DEV. אין bulk על legacy.
4. **ריפו:** אין נתוני לקוחות (שמות, טלפונים, מזהי רשומות).
