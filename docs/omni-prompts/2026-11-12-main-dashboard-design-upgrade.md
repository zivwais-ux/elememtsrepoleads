# Omni prompt · Main Dashboard: שדרוג עיצוב כללי

> נכתב 12.11.2026. עיצוב בלבד, על האלמנט הקיים ב-Main Dashboard. בלי דפים חדשים, בלי שינוי לוגיקה, נתונים או שער הכתיבה.
> **להריץ אחרי** פרומפט כיווץ החלק הסגול (`2026-11-12-main-dashboard-compact-header.md`), ולא לפניו. אחרת העריכות יתנגשו.
> **לא ללחוץ Publish.** אחרי הביצוע אני מוריד את הקוד ומשווה: אסור שיופיע שינוי ב-WL_*, safeUpdate, safeCreate, מזהי שדות, או בטקסטים בעברית.

## מה משתפר
| תחום | היום | אחרי |
|---|---|---|
| טיפוגרפיה | פונט ברירת מחדל של הדפדפן | מחסנית פונטים עם Heebo/Assistant, היררכיה ברורה, מספרים tabular |
| כרטיסי ליד | מסגרת וצל זהים בכל מקום | צל רך בשתי שכבות, ריחוף עם הרמה קלה, פס צבע דק לפי עדיפות |
| תגיות סטטוס | מלבן צבעוני | pill עם נקודת צבע, ניגודיות AA |
| עמודות הלוח | רקע שטוח | כותרת דביקה, מונה בולט, גלילה נקייה |
| חיפוש | שדה רגיל | שדה גדול עם אייקון, מצב פוקוס ברור |
| מגירת הליד | כותרת פשוטה | כותרת עם אווטאר וסטטוס, רקע מופרד מהלוח |
| כפתורים | שלושה סגנונות שונים | שתי רמות בלבד: ראשי ומשני, אותו גובה ורדיוס |
| מצבים ריקים וטעינה | טקסט יבש | הודעה ידידותית ותנועה עדינה |

## מה בפרומפט נוגע בנתונים
כלום. רק קבועי `THEME`/`PAL`, מחרוזות ה-CSS ב-`GS`/`DRAWER_CSS`/`SWITCH_CSS`, וערכי `style` בתוך JSX.

---

```
Edit ONLY the custom element on page "Main Dashboard" (pagTW81hjKberKKyz,
interface Elements Daily Ops). Do not publish. Do not create or delete pages.
Do not touch any other page, table, field, view or automation.

GOAL: raise the visual quality of the existing page. VISUAL CHANGES ONLY.

HARD RULES (violating any = revert that edit):
- Do not change any logic, hook, state, filter, sort, field ID, table ID,
  WL_* whitelist, assertWritable/safeUpdate/safeCreate, date module, or any
  Hebrew text string.
- Do not change the purple header height (keep it at the compact size, about
  220px). Do not re-add the caption under the mode switch.
- Keep RTL. Keep every font size >= 13 and every click target >= 36px high.
- Keep all focus-visible outlines. Respect prefers-reduced-motion.
- Colors only from the existing PAL palette (plus tints of it). No new hues.
- No new dependencies, no external fonts loaded from the network.

Do the work in these 8 steps. After each step confirm the page still renders.

1) TYPOGRAPHY. In the GS string add at the top:
   body,.hdr,button,input,select,textarea{font-family:'Heebo','Assistant','Segoe UI',system-ui,-apple-system,sans-serif;}
   Add letter-spacing:-0.2px to card titles (THEME.fontTitle / fontSection users).
   Make every count, amount and KPI number use font-variant-numeric:tabular-nums.

2) ELEVATION + RADIUS SCALE. In PAL set:
   shadow:      '0 1px 2px rgba(46,16,101,0.06), 0 6px 20px rgba(46,16,101,0.07)'
   shadowHover: '0 2px 4px rgba(46,16,101,0.08), 0 14px 32px rgba(46,16,101,0.14)'
   Use one radius scale only: 8 (inputs, small buttons), 16 (cards, columns), 9999 (pills).
   Replace stray radii of 6, 7, 10, 20 with the nearest value from that scale.

3) LEAD CARDS (TodayCard, FullDealCard, ListCard .lrow). Hover lifts by 2px with
   shadowHover (already exists, keep transition .15s ease). Selected card keeps
   the 2px purple ring. Add a 4px inline-start edge in the column color on
   TodayCard only if it is not already there. Name line weight 700, secondary
   line color PAL.inkSoft, the "הבא ·" footer separated by the existing hairline.
   Equal inner padding 16 on all three card types.

4) STATUS TAGS. In .tag and every place using statusColor(): render as a pill
   (radius 9999, padding 4px 12px), with an 8px round dot in the foreground
   color before the text (a ::before in CSS, no JSX change). Verify text/background
   contrast is at least 4.5:1 for every statusColor() pair; if one fails, darken
   only the foreground.

5) BOARD COLUMNS (TodayColumn, FullColumn). Column header becomes position:sticky;
   top:0 with the column surface color and a 1px bottom hairline, so the title
   and count stay visible while the cards scroll. Count pill larger (min-width 28,
   height 28, font 14/700). Thin scrollbar (existing .sc style) on the card list.
   Empty column text centered with a soft muted tone and 24px vertical padding.

6) SEARCH FIELD + FILTER CHIPS. .inp gets min-height 44 in the search bar only,
   border 1px PAL.purpleLine, radius 12, a clearer focus ring
   (0 0 0 3px rgba(109,40,217,.25)). The owner chips and the page chips share one
   height (36) and one radius (9999); selected = solid, unselected = outline.

7) LEAD DRAWER (DealDrawer + LeftPane cards). Drawer header: add a 36px avatar
   with the lead initial (reuse the existing .avatar class and firstChar helper),
   the name, and the status tag, on a white bar with a 1px bottom hairline.
   Cards inside the drawer: same card style as above, 16px gap, section titles
   (.sec-title, .eyebrow) with consistent spacing. Primary buttons (.pbtn) and the
   WhatsApp/phone buttons (.sbtn) get the same height (40) and radius (8); the
   primary is solid PAL.purple600, the secondary is white with a purple outline.
   The WhatsApp button keeps its green tint.

8) POLISH. Smooth 150ms transitions on background/box-shadow/transform for
   interactive elements; the drawer slide-in stays. Empty state in the board
   ("אין לידים שממתינים לטיפול") gets a larger emoji (36px) and 16px text.
   Make sure nothing overflows horizontally at widths 360, 768 and 1280.

Everything not listed stays byte-identical. When done, send screenshots of:
היום mode, עסקאות mode, a lead drawer open, and the search results view, each at
width 1280, plus the היום mode at width 390 (mobile).
```

## בדיקת קבלה, אחרי הביצוע
1. אני מוריד את הקוד ומריץ השוואה לגרסה שלפני. כל ההבדלים צריכים להיות ב-style, THEME, PAL ומחרוזות ה-CSS בלבד.
2. אותם מספרים באריחים, אותם לידים בעמודות, אותה לוגיקת סינון.
3. אתה בודק בעין: היום, עסקאות, מגירה פתוחה, ובטלפון.
4. אם משהו לא מוצא חן, מבטלים שלב בודד. השלבים בלתי תלויים זה בזה.
