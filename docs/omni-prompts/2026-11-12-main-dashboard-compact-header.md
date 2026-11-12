# Omni prompt · Main Dashboard: כיווץ החלק הסגול

> נכתב 12.11.2026. הבעיה: החלק הסגול (מתג עסקאות/היום, כותרת, סינון אחראי, 6 אריחי הסינון) תופס יותר ממחצית המסך וחוסם את רשימת הלידים.
> **תוצאה צפויה:** גובה החלק הסגול יורד בכ-**42%** (380 → 221 פיקסלים, במדידה על תצוגה מקדימה ברוחב 840). האריחים נשארים מסננים כמו היום, והמספרים לא משתנים.
> תצוגה מקדימה: [לפני](img/header-before.png) · [אחרי](img/header-after.png). זו הדמיה של הפריסה, לא צילום של המסך האמיתי.
> **לא ללחוץ Publish.** אחרי הביצוע אני מוריד את הקוד ומשווה.

## מה משתנה
| רכיב | היום | אחרי |
|---|---|---|
| ריווח החלק הסגול | 24 פיקסלים מכל צד | 12 למעלה ולמטה, 20 בצדדים |
| כותרת "משימות להיום" | גודל 24 | גודל 20 |
| אריחי הסינון (הכל, דורש תגובה…) | עמודה: אייקון גדול, מספר 34, תווית. גובה כ-150 | אייקון קטן בצד, מספר 24 ותווית מתחתיו. גובה כ-76 |
| השורה מתחת למתג ("לפי דחיפות · מה צריך לקרות היום") | מוצגת | מוסרת |

## מה בפרומפט נוגע בנתונים
כלום. שינויי עיצוב בלבד, כולם בקבוע `THEME` ובשתי שורות JSX. הערכים האלה משמשים רק את החלק הסגול. אין שינוי בסינון, במספרים או בשער הכתיבה.

---

```
Edit ONLY the custom element on page "Main Dashboard" (pagTW81hjKberKKyz,
interface Elements Daily Ops). Do not publish. Do not touch any other page,
table, field, view or automation. Purely visual, no logic changes.

Make exactly these edits in source.tsx. In the THEME object, replace these lines:

1) bannerPad:   '24px 24px 24px',
   →   bannerPad:   '12px 20px 12px',

2) bannerTitleMb: 16,
   →   bannerTitleMb: 8,

3) bannerTitle: {fontSize:24, fontWeight:700, color:PAL.white, letterSpacing:'-0.3px'} as React.CSSProperties,
   →   bannerTitle: {fontSize:20, fontWeight:700, color:PAL.white, letterSpacing:'-0.3px'} as React.CSSProperties,

4) tile:        {flex:1, minWidth:120, minHeight:36, padding:20, borderRadius:20, cursor:'pointer', textAlign:'start', display:'flex', flexDirection:'column', alignItems:'flex-start', boxShadow:PAL.shadowTile} as React.CSSProperties,
   →   tile:        {flex:1, minWidth:110, minHeight:36, padding:8, borderRadius:14, cursor:'pointer', textAlign:'start', display:'grid', gridTemplateColumns:'auto 1fr', columnGap:8, alignItems:'center', boxShadow:PAL.shadowTile} as React.CSSProperties,

5) tilePad:     20,
   →   tilePad:     8,
   tilePadOn:   19,   // selected border is 2px (vs 1px) — padding shrinks 1px so tiles don't shift
   →   tilePadOn:   7,   // selected border is 2px (vs 1px) — padding shrinks 1px so tiles don't shift

6) tileIconBox: {width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12, flexShrink:0} as React.CSSProperties,
   →   tileIconBox: {width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', gridRow:'1 / span 2', flexShrink:0} as React.CSSProperties,

7) tileIconSize:18,
   →   tileIconSize:14,

8) tileNum:     {fontSize:34, fontWeight:700, lineHeight:1, marginBottom:8, color:PAL.ink, fontVariantNumeric:'tabular-nums'} as React.CSSProperties,
   →   tileNum:     {fontSize:24, fontWeight:700, lineHeight:1, gridColumn:2, color:PAL.ink, fontVariantNumeric:'tabular-nums'} as React.CSSProperties,

9) tileLabel:   {fontSize:14, fontWeight:500, lineHeight:1.4} as React.CSSProperties,
   →   tileLabel:   {fontSize:13, fontWeight:500, lineHeight:1.3, gridColumn:2} as React.CSSProperties,

In the ModeSwitch component:

10) DELETE this one line (the caption under the switch):
    <p style={{fontSize:13, color:PAL.white, marginTop:8, textAlign:'center'}}>{SWITCH_CAPTION[mode]}</p>
    Leave the SWITCH_CAPTION constant itself in place.

In the Banner component (deals-mode tile):

11) <p style={{fontSize:13, color:THEME.tileLabelOff, marginTop:4}}>{t.sum > 0 ? fmtShekel(t.sum) : 'אין הצעות'}</p>
    →   <p style={{fontSize:13, color:THEME.tileLabelOff, marginTop:2, gridColumn:2}}>{t.sum > 0 ? fmtShekel(t.sum) : 'אין הצעות'}</p>

Everything else stays byte-identical. Send a screenshot of the top of the dashboard in both modes (היום and עסקאות).
```

## בדיקת קבלה, אחרי הביצוע
1. ב"היום": שישה אריחים באותו גובה, כל אחד עם אייקון בצד, מספר ותווית. לחיצה על אריח עדיין מסננת, והמספרים זהים למה שהיו (הכל = סכום האריחים).
2. ב"עסקאות": האריחים מציגים גם סכום הצעות, בלי שבירת עיצוב.
3. רשימת הלידים מתחילה גבוה יותר, ולפחות כרטיס אחד נוסף נכנס למסך.
4. אם החלק הסגול עדיין גדול: אפשרות להעביר את מתג עסקאות/היום לאותה שורה עם הכותרת (חוסך עוד כ-50 פיקסלים, שינוי מבני קטן).
