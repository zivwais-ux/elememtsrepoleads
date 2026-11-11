// הרצה מדומה של Lead Intake על לידים פיקטיביים, עם ההגדרות האמיתיות מ-schema/dev-settings.json.
// שימוש:  node lead-intake-2.2.0.test.js [נתיב לסקריפט, ברירת מחדל 2.2.0]
const fs=require('fs');
const path=require('path');const root=path.join(__dirname,'../../')+'';
const src=fs.readFileSync(process.argv[2]||path.join(__dirname,'lead-intake-2.2.0.js'),'utf8');
const settings=JSON.parse(fs.readFileSync(root+'schema/dev-settings.json','utf8'));
const rows=Array.isArray(settings)?settings:(settings.rows||settings.records||settings.settings);
const LF=['שם ליד','טלפון','טלפון מתוקן','שם לפנייה','סטטוס מכירה','מספר פניות','דורש בדיקה','קו מוצר','תאריך כניסה','כמות','כמות מתוקנת','אחראי','סוג לקוח','עסקי או פרטי?','אין ליצור קשר','טיפול אישי','לבדיקה','מועד שיחה מוצע','פירוט המוצר'];
const RF=['הבעיה','סוג הבעיה','חומרה','פרטים','מצב','נמצא בתאריך','לידים'];
const sel=v=>v==null||v===''?null:{name:v};
function rec(id,o){const v={'שם ליד':o.name,'טלפון':o.phone??null,'טלפון מתוקן':o.phoneN??null,'שם לפנייה':null,'סטטוס מכירה':null,'מספר פניות':null,'דורש בדיקה':false,'קו מוצר':sel(o.line),'תאריך כניסה':null,'כמות':o.qty??null,'כמות מתוקנת':null,'אחראי':null,'סוג לקוח':null,'עסקי או פרטי?':o.biz??null,'אין ליצור קשר':false,'טיפול אישי':false,'לבדיקה':null,'מועד שיחה מוצע':null,'פירוט המוצר':null};
 const str=x=>x==null?'':typeof x==='object'?(x.name||''):String(x);
 return {id,name:o.name,getCellValue:k=>v[k]??null,getCellValueAsString:k=>str(v[k])};}
async function run(label,o,others=[]){
 const recs=[rec('recT',o),...others.map((x,i)=>rec('recO'+i,x))];
 const writes=[],creates=[],logs=[];
 const tables={
  'הגדרות':{fields:[{name:'מפתח'},{name:'ערך'}],selectRecordsAsync:async()=>({records:rows.map(r=>({getCellValueAsString:k=>k==='מפתח'?r['מפתח']:r['ערך']}))})},
  'לידים':{fields:LF.map(name=>({name})),selectRecordsAsync:async()=>({records:recs,getRecord:id=>recs.find(r=>r.id===id)}),updateRecordAsync:async(id,f)=>writes.push(f)},
  'לבדיקה':{fields:RF.map(name=>({name})),createRecordAsync:async f=>creates.push(f)}};
 const base={id:rows.find(r=>r['מפתח']==='בסיס')['ערך'],name:'DEV',getTable:n=>tables[n]};
 const AF=Object.getPrototypeOf(async function(){}).constructor;
 const fn=new AF('base','input','output','console',src);
 await fn(base,{config:()=>({leadId:'recT'})},{set(){}},{log:(...a)=>logs.push(a.join(' '))});
 const w=writes[0]||{};
 console.log('\n▶',label);
 console.log('  נכתב:',JSON.stringify(Object.fromEntries(Object.entries(w).filter(([k])=>!['מועד שיחה מוצע','תאריך כניסה','סטטוס מכירה','מספר פניות'].includes(k)))));
 console.log('  לבדיקה:',creates.map(c=>`${c['סוג הבעיה'].name} / ${c['חומרה'].name}`).join(' | ')||'—');
}
(async()=>{
 await run('ויואלדי · ידית + פלוס מיותר + ביתי',{name:'xxx_meme',line:'ויואלדי',phone:'+0501234567',qty:'10',biz:'ביתי'});
 await run('מזרנים · שם לטיני באותיות קטנות + מיתוג',{name:'shani levi',line:'מזרנים',phone:'(050) 111-2233',qty:'10מזרנים עם מיתוג אישי / לוגו'});
 await run('מזרנים · טווח',{name:'דנה',line:'מזרנים',phone:'0501112244',qty:'בין 5 ל 10מזרנים עם מיתוג אישי / לוגו'});
 await run('ויואלדי · 99 מיטות (מעל התקרה)',{name:'רוני',line:'ויואלדי',phone:'0501112255',qty:'99',biz:'עסקי'});
 await run('ויואלדי · כמות 0',{name:'רוני',line:'ויואלדי',phone:'0501112266',qty:'0',biz:'עסקי'});
 await run('מזרנים · 180',{name:'Lee',line:'מזרנים',phone:'0501112277',qty:'180'});
 await run('ויואלדי · טלפון זר',{name:'Dana',line:'ויואלדי',phone:'+31612345678',qty:'4',biz:'עסקי'});
 await run('מזרנים · שם עסק',{name:'סטודיו נועה פילאטיס',line:'מזרנים',phone:'0501112288',qty:'6'});
 await run('ויואלדי · כפילות טלפון באותו קו',{name:'מיכל',line:'ויואלדי',phone:'0501112299',qty:'3',biz:'ביתי'},[{name:'מיכל ישן',line:'ויואלדי',phone:'0501112299',phoneN:'+972501112299',qty:'3'}]);
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
