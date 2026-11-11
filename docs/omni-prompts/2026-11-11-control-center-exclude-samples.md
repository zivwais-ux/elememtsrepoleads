# Omni prompt · Control Center: לא לספור לידי דוגמה

> נכתב 11.11.2026. רקע: [import-readiness §6](../findings/2026-11-11-import-readiness.md).
> **החלטה:** לידי הדוגמה **נשארים** ב-DEV לבדיקות. הם מוצאים רק מהניתוח העסקי, ויש מתג להחזיר אותם.
> **יעד:** הכנסות ₪1,621,984 במקום ₪1,742,584, ו-1,027 לידים במקום 1,038 (בטווח "הכל").
> **בדיקה אחרי Omni:** אני מוריד את הקוד ומשווה אותו לגרסה שהכנתי. ההבדל צריך להיות רק 3 הקטעים שלמטה.
> **לא ללחוץ Publish** עד שהבדיקה עוברת.

## מה בפרומפט נוגע בנתונים
| פעולה | נוגע בנתונים? |
|---|---|
| סינון רשומות בזיכרון של הדפדפן | לא |
| מתג "הצג לידי דוגמה" | מצב תצוגה מקומי בלבד |
| כתיבה, מחיקה, שינוי שדות או אוטומציות | אסור במפורש |

---

```
Edit ONLY the custom element on page "Control Center" (pagbmvRqFHOgLUjA4,
interface Elements Daily Ops). Do not publish. Do not touch any other page,
table, field, view or automation. No other code changes, no restyling.

Make exactly these 3 edits in source.tsx:

1) Replace the line
   const records=useRecords(table!,{fields:accessibleFids.length>0?accessibleFids:[F.name]});
   with:
   const allRecords=useRecords(table!,{fields:accessibleFids.length>0?accessibleFids:[F.name]});
   const[includeSamples,setIncludeSamples]=useState(false);
   const isSample=(r:any)=>safeStr(r,F.notes).startsWith('ליד לדוגמה');
   const sampleCount=useMemo(()=>allRecords.filter(isSample).length,[allRecords]);
   const records=useMemo(()=>includeSamples?allRecords:allRecords.filter(r=>!isSample(r)),[allRecords,includeSamples]);
   const archiveTotal=useMemo(()=>records.filter(r=>safeStr(r,F.archive)==='כן').length,[records]);

2) In the header, replace the hard-coded text
   ניתוח עסקי · כל 1038 הלידים, כולל 1027 רשומות ארכיון היסטורי
   with:
   ניתוח עסקי · כל {records.length} הלידים, כולל {archiveTotal} רשומות ארכיון היסטורי
   {sampleCount>0&&(includeSamples?` · כולל ${sampleCount} לידי דוגמה`:` · ללא ${sampleCount} לידי דוגמה`)}

3) Right after the closing </select> of the owner dropdown ("כל האחראים"), add:
   {sampleCount>0&&(
     <label style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,color:'#FFFFFF',cursor:'pointer'}}>
       <input type="checkbox" checked={includeSamples} onChange={e=>{setIncludeSamples(e.target.checked);setDrillState(null);}}/>
       הצג לידי דוגמה ({sampleCount})
     </label>
   )}

Everything else stays byte-identical. After the change, with period "הכל"
and no filters, the revenue block must show ₪1,621,984 and the header
"כל 1027 הלידים ... · ללא 11 לידי דוגמה". With the checkbox on:
₪1,742,584 and 1038. Send a screenshot of both states.
```
