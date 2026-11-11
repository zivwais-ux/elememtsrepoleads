// מיפוי PROD → DEV. הפונקציות normPhone/normName/customerType/num מועתקות מ-lead-intake.js 2.1.0
const fs=require('fs');
const BIDI=/[‎‏‪-‮⁦-⁩؜]/g, DASHES=/[‐-―−﹘﹣－]/g;
const EMOJI=/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;
const BIZ=/סטודיו|studio|כושר|יוגה|פילאטיס|pilates|אימונים|מאמנת|תזונה|שיקום|מרכז/i;
function normPhone(raw){ if(!raw) return {ok:false,why:'טלפון חסר'};
 let s=String(raw).replace(BIDI,'').replace(DASHES,'-').replace(/[\s()\-.]/g,'');
 if(s.startsWith('+972')) s='0'+s.slice(4); else if(s.startsWith('972')) s='0'+s.slice(3);
 if(/^0[2-489]\d{7}$/.test(s)) return {ok:false,why:'לא מספר נייד'};
 if(/^\+?\d{7,15}$/.test(s)&&!s.startsWith('0')) return {ok:false,why:'מספר לא ישראלי'};
 if(!/^05\d{8}$/.test(s)) return {ok:false,why:'טלפון לא תקין'};
 return {ok:true,e164:'+972'+s.slice(1)}; }
function normName(raw){ if(!raw) return null;
 let s=String(raw).normalize('NFKC').replace(BIDI,'').replace(EMOJI,'');
 s=s.replace(/^\s*\d+[.)]\s*/,''); s=s.split(/[|•·,\/]| - /)[0].replace(/\s+/g,' ').trim();
 if(!s||BIZ.test(s)) return null; const w=s.split(' '); return w.length>3?null:w[0]; }
const num=v=>{const m=String(v??'').match(/\d+/);return m?parseInt(m[0],10):null;};
function customerType(raw){ const s=String(raw??'').normalize('NFKC').replace(BIDI,'').trim();
 if(!s) return 'לא ידוע'; if(/עסק|סטודיו|studio|business|b2b/i.test(s)) return 'עסקי'; if(/בית|פרט|private|b2c/i.test(s)) return 'פרטי'; return 'לא ידוע'; }
const ilDate=iso=>new Date(iso).toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'});
const TODAY=process.argv[4]||'2026-11-11';
const LINE={tbl9SV4GU8kICBARH:'ויואלדי',tblctwsCBcoivy8Kf:'מזרנים',tblJSFUoHoohJCnDL:'סימפוני'};
const OWNER={ויואלדי:'בר',מזרנים:'עומר',סימפוני:'בר'};
// טבלת התרגום (import-readiness §5), סטטוס PROD אחרי trim
const MAP={
 'נשלחה הודעה':{sale:'חדש',proc:'ממתין לתגובה',cnt:1,base:0},
 'לא ענה':{sale:'חדש',proc:'ממתין לתגובה',cnt:1,base:0},
 'ליד פוטנציאלי לפני פגישה':{sale:'ליד פוטנציאלי לפני פגישה',proc:'ממתין לפנייה'},
 'ליד חם אחרי פגישה':{sale:'ליד חם',proc:'ממתין לפנייה',base:1},
 'רלוונטי לעתיד':{sale:'רלוונטי לעתיד',proc:'ממתין לפנייה'},
 'לא רלוונטי / נפלה עסקה':{sale:'לא רלוונטי / נפלה עסקה',proc:'הסתיים',closed:true},
 'נסגרה עסקה':{sale:'נסגרה עסקה',proc:'הסתיים',closed:true},
 '':{sale:'חדש',proc:'ממתין לפנייה',cnt:0},
};
const F={name:'fldpRaAbMncaePGQB',line:'fldWGKe4vGkx1XVvA',created:'fldoaqRvQ5bscM12Q',phone:'fldKvMdPHQSnLRRHF',phoneN:'fldvB6SsLTeFttB1y',email:'fldV4Ueosp3y9c7gd',city:'flde7KAqyoktWZoPy',biz:'fldAiU8m4b0pAYLyY',sale:'fldMY3LA2vVjdPVdB',proc:'fld5KlfuDpeb4PFo8',act:'fldoy2yHibIG89U5G',due:'fldMiSAOsPZ8fYE6f',notes:'fld5ophHFlD0xoMos',cnt:'fld11IWYjoDQycO4v',owner:'fldc9BJfqXLxwPlJ1',flag:'fldhU70kjBUhQPwCp',qty:'fldanMrw7VXYVS9Te',qtyN:'fldvrsoDbTXuVe4iX',bought:'fld7b3QrXuipNnwSn',deal:'fldoyl9VMjVkiK9bI',detail:'fldjDM31QcXiwJ9P2',source:'fld0WZ6DyE9iXPMzr',leadId:'flduCDzBXtmukPTkf',clickId:'fldSH3LH4YfOWNRsf',origStatus:'fldxK5D4AGvGRv5ai',origId:'fldpBArnJe2f074Oa',first:'fldbmFm4a62391oGb',base:'fldIZXrS7ppfwzlUB',ctype:'fldeM9Ce7N7mK5QJo',reason:'fldrvrGCzUgDJCr7y'};
const rows=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const out=[],issues=[];
for(const r of rows){
 const line=LINE[r.tbl]; const st=(r.status||'').trim(); const m=MAP[st];
 if(!m){issues.push(`סטטוס לא מוכר: "${st}" ב-${r.id}`);continue;}
 const f={};const set=(k,v)=>{if(v!==undefined&&v!==null&&v!=='')f[F[k]]=v;};
 set('name',r.name); set('line',line); set('created',ilDate(r.created)); set('phone',r.phone);
 const p=normPhone(r.phone); if(p.ok) set('phoneN',p.e164); else {f[F.flag]=true; set('reason',p.why);}
 set('email',r.email); set('city',r.city); set('biz',r.biz); set('notes',r.notes);
 set('sale',m.sale); set('proc',m.proc); if(m.cnt!==undefined) f[F.cnt]=m.cnt; if(m.base!==undefined) f[F.base]=m.base;
 if(m.closed) set('act','אין פעולה'); else {set('act','להתקשר'); set('due',TODAY);}
 set('owner',OWNER[line]);
 if(line==='מזרנים'){ const t=String(r.qtyText||''); const n=num(t); if(n) {set('qty',String(n)); set('qtyN',n);} const rest=t.replace(/^\s*\d+\s*/,'').trim(); set('detail',rest); set('ctype','לא ידוע'); }
 else { if(r.qty>0){set('qty',String(r.qty)); set('qtyN',r.qty);} set('ctype',customerType(r.biz)); }
 set('first',normName(r.name)); set('deal',r.deal); set('bought',r.bought);
 set('source',r.source); set('leadId',r.leadId); set('clickId',r.clickId);
 set('origStatus',r.status||''); set('origId',`${r.tbl}/${r.id}`);
 out.push({fields:f});
}
fs.writeFileSync(process.argv[3],JSON.stringify(out,null,0)); console.error('records',out.length,'issues',issues);
