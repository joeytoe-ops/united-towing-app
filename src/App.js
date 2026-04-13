import React, { useState, useEffect, useCallback, useRef } from "react";

/* ─── CONFIG ─── */
const PIN = "united149";
const TAX = 0.08375;
const CC_FEE = 0.045;
const PARTNERS = ["JC Auto","Gabe Citgo","Karls Auto Body","Tasca Ford","Hartsdale Mobil","RDI Property Group","NFA Towing","German Car","Mancuso Auto Body","Cruz Control Auto","Vasco Tech Center","Performance Auto","Preferred Auto Service","Sal's Auto","Ferry Auto","Yonkers Auto Gallery","Renzo Auto","Tierney Auto","Caldarola Auto Body","Frank Donato Construction","Lenny's Auto"];
const SVC_ITEMS = [{k:"towing",l:"Towing"},{k:"waiting",l:"Waiting Time"},{k:"winch",l:"Winch"},{k:"road_service",l:"Road Service"},{k:"gate_fee",l:"Gate Fee"},{k:"admin_fee",l:"Admin Fee"},{k:"storage",l:"Storage"}];
const PAY_TYPES = ["Cash","Zelle","Check","Credit Card","Invoice Later","Pending Insurance"];
const ST = {PAID:"paid",UNPAID:"unpaid",MISSING:"missing"};

/* ─── UTILS ─── */
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const fmtDate = d => { if(!d) return "—"; const x=new Date(d); return isNaN(x)?"—":`${x.getMonth()+1}/${x.getDate()}/${String(x.getFullYear()).slice(2)}`; };
const fmtMoney = n => { if(n==null||isNaN(n)||n==="") return "—"; return "$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); };
const days = d => { if(!d) return 0; const ms=Date.now()-new Date(d).getTime(); return isNaN(ms)?0:Math.floor(ms/86400000); };
const calcTotals = (svc,tolls,pay) => {
  const s=svc||{}; const svcSum=SVC_ITEMS.reduce((a,i)=>a+(parseFloat(s[i.k])||0),0);
  const sub=svcSum+(parseFloat(tolls)||0); const tax=Math.round(sub*TAX*100)/100;
  const cc=pay==="Credit Card"?Math.round(sub*CC_FEE*100)/100:0;
  return {sub,tax,cc,total:Math.round((sub+tax+cc)*100)/100,svcSum};
};

const blank = () => ({
  id:uid(), jobDate:new Date().toISOString().split("T")[0], jobTime:new Date().toTimeString().slice(0,5),
  vehicle:{color:"",make:"",model:"",year:"",vin:"",plate:""},
  customer:{name:"",phone:""}, owner:{name:"",homePhone:"",workPhone:""},
  pickup:"",pickupCity:"",dropoff:"",dropoffCity:"",
  services:{}, price:"", paymentType:"Cash", tolls:"",
  poNumber:"",raNumber:"", status:ST.UNPAID, notes:"",
  vehiclePhoto:null, registrationPhoto:null, source:"app"
});

/* ─── DATA ─── */
const CK = "ut-v4";
const cache = j => { try{localStorage.setItem(CK,JSON.stringify(j))}catch{} };
const loadCache = () => { try{return JSON.parse(localStorage.getItem(CK)||"[]")}catch{return[]} };

// Parse legacy "United Towing Overview" row
function parseLegacy(r) {
  const name = String(r.jobName||"").trim();
  const num = String(r.jobNumber||"");
  // Filter junk: empty rows, note rows, non-numeric job numbers
  if (!name) return null;
  if (isNaN(Number(num))) return null; // job number must be a real number
  let jobDate = "";
  if (r.date) try { jobDate = new Date(r.date).toISOString().split("T")[0]; } catch {}
  const payRaw = String(r.paymentType||"").trim();
  const rcptRaw = String(r.receiptStatus||"").trim();
  const payUp = payRaw.toUpperCase();
  const rcptLow = rcptRaw.toLowerCase();
  // Price: numeric or nothing
  let price = "";
  if (r.payout!=null && r.payout!=="" && r.payout!=="-") {
    const p = parseFloat(r.payout);
    if (!isNaN(p) && p > 0) price = p;
  }
  // Status logic:
  // "NEEDS TO BE PAID" in payment type = unpaid (regardless of receipt)
  // Checkmark in receipt = paid
  // "Missing Receipt" + real payment method (cash/zelle/check/cc) = paid, missing receipt
  // No price = missing
  let status = ST.MISSING;
  let receiptMissing = false;
  const needsPay = payUp.includes("NEEDS TO BE PAID");
  const hasPay = payUp.includes("CASH") || payUp.includes("ZELLE") || payUp.includes("CHECK") || payUp.includes("CREDIT");
  const hasCheckmark = rcptRaw.includes("\u2705") || rcptRaw.includes("\u2611");
  const hasReceipt = rcptLow.includes("receipt in tow");
  if (!price && price !== 0) { status = ST.MISSING; }
  else if (needsPay) { status = ST.UNPAID; }
  else if (hasCheckmark || hasReceipt || hasPay) { status = ST.PAID; }
  else { status = ST.UNPAID; }
  if (rcptLow.includes("missing receipt")) receiptMissing = true;
  // Normalize payment type
  let payNorm = "Cash";
  if (payUp.includes("ZELLE")) payNorm = "Zelle";
  else if (payUp.includes("CHECK")) payNorm = "Check";
  else if (payUp.includes("CREDIT")) payNorm = "Credit Card";
  else if (payUp.includes("INSURANCE") || payUp.includes("PENDING")) payNorm = "Pending Insurance";
  else if (needsPay) payNorm = "Invoice Later";
  else if (payUp.includes("CASH")) payNorm = "Cash";
  // Match partner
  let cust = "";
  const combo = (name+" "+String(r.notes||"")).toLowerCase();
  for (const p of PARTNERS) if (combo.includes(p.toLowerCase())) { cust = p; break; }
  return {
    id:"L"+num, jobDate, jobTime:"",
    vehicle:{color:"",make:"",model:"",year:"",vin:"",plate:""},
    customer:{name:cust,phone:""}, owner:{name:"",homePhone:"",workPhone:""},
    pickup:"",pickupCity:"",dropoff:"",dropoffCity:"",
    services: price ? {towing:price} : {}, price, paymentType:payNorm, tolls:"",
    poNumber:"",raNumber:"", status, notes:String(r.notes||""),
    vehiclePhoto:null, registrationPhoto:null,
    source:"legacy", title:name, legacyNum:num, receiptMissing,
    legacyRaw:{jobName:name,receiptStatus:rcptRaw,paymentType:payRaw,payout:r.payout}
  };
}

// Parse "App Jobs" row
function parseApp(row) {
  const id=row[0]||uid();
  let jd=""; if(row[1]) try{jd=new Date(row[1]).toISOString().split("T")[0]}catch{}
  let jt=""; if(row[2]) try{const t=new Date(row[2]);jt=t.getUTCHours().toString().padStart(2,"0")+":"+t.getUTCMinutes().toString().padStart(2,"0")}catch{jt=String(row[2]).slice(0,5)}
  let svc={}; try{svc=JSON.parse(row[13])}catch{if(row[13])svc={towing:row[14]||""}}
  let ext={}; try{if(String(row[17]).startsWith("{"))ext=JSON.parse(row[17])}catch{}
  const st=(row[16]||"").toLowerCase();
  return {
    id, jobDate:jd, jobTime:jt,
    vehicle:{color:row[3]||"",make:row[4]||"",model:row[5]||"",year:row[6]||"",vin:row[7]||"",plate:row[8]||""},
    customer:{name:row[9]||"",phone:row[10]||""}, owner:ext.owner||{name:"",homePhone:"",workPhone:""},
    pickup:row[11]||"",pickupCity:ext.pickupCity||"",dropoff:row[12]||"",dropoffCity:ext.dropoffCity||"",
    services:svc, price:row[14]||"", paymentType:row[15]||"Cash", tolls:ext.tolls||"",
    poNumber:ext.poNumber||"",raNumber:ext.raNumber||"",
    status: st==="paid"?ST.PAID:((!row[14]||row[14]==="")?ST.MISSING:ST.UNPAID),
    notes:ext.notes!=null?ext.notes:(String(row[17]).startsWith("{")?"":(row[17]||"")),
    legacyNum:ext.legacyNum||"",
    vehiclePhoto:null, registrationPhoto:null, source:"app",
    title:[row[3],row[4],row[5]].filter(Boolean).join(" ")||(ext.legacyTitle||"")
  };
}

function toPayload(job, action) {
  const ext=JSON.stringify({notes:job.notes||"",owner:job.owner||{},pickupCity:job.pickupCity||"",dropoffCity:job.dropoffCity||"",tolls:job.tolls||"",poNumber:job.poNumber||"",raNumber:job.raNumber||"",legacyNum:job.legacyNum||"",legacyTitle:job.title||""});
  const sv=SVC_ITEMS.reduce((a,i)=>a+(parseFloat((job.services||{})[i.k])||0),0);
  return {action,id:job.id,date:job.jobDate||"",time:job.jobTime||"",color:job.vehicle?.color||"",make:job.vehicle?.make||"",model:job.vehicle?.model||"",year:job.vehicle?.year||"",vin:job.vehicle?.vin||"",plate:job.vehicle?.plate||"",customer:job.customer?.name||"",phone:job.customer?.phone||"",pickup:job.pickup||"",dropoff:job.dropoff||"",service:JSON.stringify(job.services||{}),price:sv||job.price||"",payment:job.paymentType||"",status:job.status||"",notes:ext,test:job.isTest||false};
}

async function fetchAll() {
  try {
    const r = await fetch("/api/sync"); const d = await r.json();
    const app = (d.appJobs||d.jobs||[]).map(parseApp);
    const leg = (d.legacyJobs||[]).map(parseLegacy).filter(Boolean);
    // Merge: if app job has legacyNum, it overrides that legacy entry
    // legacyNum is stored in the extended JSON notes field
    const appLegacyNums = new Set();
    app.forEach(j => {
      // Check raw notes column for legacyNum in JSON
      if (j.legacyNum) appLegacyNums.add("L"+j.legacyNum);
    });
    const filteredLeg = leg.filter(j => !appLegacyNums.has(j.id));
    return [...filteredLeg, ...app];
  } catch(e) { console.error(e); return null; }
}

async function sync(job, action="add") {
  try {
    const r = await fetch("/api/sync",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(toPayload(job,action))});
    return (await r.json());
  } catch(e) { console.error(e); return null; }
}

/* ─── PDF ─── */
async function makePDF(job) {
  if(!window.jspdf){await new Promise((ok,no)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
  const{jsPDF}=window.jspdf;const doc=new jsPDF({unit:"pt",format:"letter"});
  const w=612,m=36,pw=w-72;let y=m;
  const dk=[26,26,46],bl=[26,10,110],wt=[255,255,255];
  const svc=job.services||{};const tl=parseFloat(job.tolls)||0;
  const sv=SVC_ITEMS.reduce((a,i)=>a+(parseFloat(svc[i.k])||0),0);
  const sub=sv+tl,tax=Math.round(sub*TAX*100)/100;
  const cc=job.paymentType==="Credit Card"?Math.round(sub*CC_FEE*100)/100:0;
  const tot=Math.round((sub+tax+cc)*100)/100;
  const bx=(x,by,bw,bh,lb,vl,vs)=>{vs=vs||10;doc.setDrawColor(51);doc.setLineWidth(.5);doc.rect(x,by,bw,bh);doc.setFontSize(6);doc.setFont("helvetica","normal");doc.setTextColor(...dk);doc.text(lb,x+3,by+8);if(vl){doc.setFontSize(vs);doc.setFont("helvetica","bold");doc.setTextColor(...bl);doc.text(String(vl),x+4,by+bh-4);doc.setTextColor(...dk)}};
  const ck=(x,cy,on)=>{doc.rect(x,cy,9,9);if(on){doc.setFontSize(7);doc.setFont("helvetica","bold");doc.text("X",x+2,cy+7.5)}};
  // Header
  doc.setFillColor(...dk);doc.rect(m,y,pw,32,"F");doc.setTextColor(...wt);doc.setFontSize(22);doc.setFont("helvetica","bold");doc.text("24 HOUR TOWING",w/2,y+24,{align:"center"});y+=38;
  doc.setTextColor(...dk);doc.setFontSize(20);doc.text("UNITED",w/2,y+14,{align:"center"});y+=18;
  doc.setFontSize(9);doc.setFont("helvetica","normal");doc.text("TOWING & TRANSPORT",w/2,y+9,{align:"center"});y+=14;
  doc.setFontSize(8);doc.text('"Local & Long Distance"     "Flatbed Specialists"',w/2,y+8,{align:"center"});y+=12;
  doc.setFontSize(7);doc.text("Towing \u2022 Emergency Starting \u2022 Battery Service \u2022 Flat Tire Service",w/2,y+7,{align:"center"});y+=9;
  doc.text("Vehicle Locksmith Services \u2022 Unauthorized Tows \u2022 Fuel Delivery",w/2,y+7,{align:"center"});y+=14;
  doc.setFillColor(232,232,224);doc.rect(m,y,pw,24,"FD");doc.setTextColor(...dk);doc.setFontSize(16);doc.setFont("helvetica","bold");doc.text("914-500-5570",w/2,y+18,{align:"center"});y+=25;
  // Fields
  const rh=26,dw=pw*.6,tw=pw*.4;
  const ts=job.jobTime||"";const hr=parseInt(ts.split(":")[0]||"12");const ap=hr>=12?"PM":"AM";const dh=hr>12?hr-12:(hr===0?12:hr);
  const dt=dh+":"+(ts.split(":")[1]||"00");const ds=job.jobDate?new Date(job.jobDate+"T12:00:00").toLocaleDateString("en-US"):"";
  bx(m,y,dw,rh,"DATE:",ds);doc.rect(m+dw,y,tw,rh);doc.setFontSize(6);doc.setFont("helvetica","normal");doc.setTextColor(...dk);doc.text("TIME:",m+dw+3,y+8);
  if(ts){doc.setFontSize(10);doc.setFont("helvetica","bold");doc.setTextColor(...bl);doc.text(dt,m+dw+4,y+rh-4);doc.setTextColor(...dk)}
  const ax=m+dw+tw-62,px=m+dw+tw-30,cy2=y+8;ck(ax,cy2,ap==="AM");doc.setFontSize(7);doc.setFont("helvetica","bold");doc.text("AM",ax+11,cy2+7);ck(px,cy2,ap==="PM");doc.text("PM",px+11,cy2+7);y+=rh;
  bx(m,y,dw,rh,"CUSTOMER:",job.customer?.name||"");bx(m+dw,y,tw,rh,"PHONE:",job.customer?.phone||"");y+=rh;
  bx(m,y,dw,rh,"PICKUP LOCATION:",job.pickup||"");bx(m+dw,y,tw,rh,"CITY:",job.pickupCity||"");y+=rh;
  bx(m,y,dw,rh,"DELIVERY LOCATION:",job.dropoff||"");bx(m+dw,y,tw,rh,"CITY:",job.dropoffCity||"");y+=rh;
  const vc=[[.1,"YR:",job.vehicle?.year],[.14,"MAKE:",job.vehicle?.make],[.14,"MODEL:",job.vehicle?.model],[.14,"COLOR:",job.vehicle?.color],[.48,"VIN:",job.vehicle?.vin]];
  let vx=m;vc.forEach(v=>{bx(vx,y,pw*v[0],rh,v[1],v[2]||"",9);vx+=pw*v[0]});y+=rh;
  const oc=[[.3,"VEHICLE OWNER:",(job.owner?.name||"")],[.22,"HOME PHONE:",(job.owner?.homePhone||"")],[.22,"WORK PHONE:",(job.owner?.workPhone||"")],[.26,"LIC. NO.:",job.vehicle?.plate||""]];
  let ox=m;oc.forEach(o=>{bx(ox,y,pw*o[0],rh,o[1],o[2],9);ox+=pw*o[0]});y+=rh+3;
  // Remarks + Services
  const rw2=pw*.52,sw2=pw*.48,sx=m+rw2,hh=16,sr=19,bh2=sr*12;
  doc.rect(m,y,rw2,hh);doc.setFontSize(10);doc.setFont("helvetica","bold");doc.text("REMARKS",m+rw2/2,y+12,{align:"center"});
  doc.rect(m,y+hh,rw2,bh2);if(job.notes){doc.setFontSize(10);doc.setFont("helvetica","bold");doc.setTextColor(...bl);doc.text(job.notes,m+8,y+hh+14);doc.setTextColor(...dk)}
  const pay=job.paymentType||"";if(pay){doc.setFontSize(10);doc.setFont("helvetica","bold");doc.setTextColor(...bl);doc.text("PAID "+pay.toUpperCase(),m+8,y+hh+bh2-8);doc.setTextColor(...dk)}
  doc.rect(sx,y,sw2,hh);doc.setFontSize(10);doc.setFont("helvetica","bold");doc.text("SERVICES PERFORMED",sx+sw2/2,y+12,{align:"center"});
  const pdfR=[["TOWING","towing"],["WAITING TIME","waiting"],["WINCH","winch"],["ROAD SERVICE","road_service"],["GATE FEE","gate_fee"],["ADMIN FEE","admin_fee"],["STORAGE","storage"],["SUBTOTAL","_s"],["TAX","_t"],["TOLLS","_tl"],["CC PROCESS FEE (4.5%)","_c"],["TOTAL DUE","_tot"]];
  let sy=y+hh;pdfR.forEach(r2=>{doc.setDrawColor(51);doc.setLineWidth(.5);doc.rect(sx,sy,sw2,sr);let v="";
    if(r2[1]==="_s")v=sub>0?sub.toFixed(2):"";else if(r2[1]==="_t")v=tax>0?tax.toFixed(2):"";else if(r2[1]==="_tl")v=tl>0?tl.toFixed(2):"";else if(r2[1]==="_c")v=cc>0?cc.toFixed(2):"";else if(r2[1]==="_tot")v=tot>0?tot.toFixed(2):"";else{const sv2=parseFloat(svc[r2[1]])||0;if(sv2>0)v=sv2.toFixed(2)}
    ck(sx+5,sy+5,!!v);const it=r2[0]==="TOTAL DUE";doc.setFontSize(8);doc.setFont("helvetica",it?"bold":"normal");doc.setTextColor(...dk);doc.text(r2[0],sx+20,sy+sr-6);
    if(v){doc.setFontSize(it?11:10);doc.setFont("helvetica","bold");doc.setTextColor(...bl);doc.text(v,sx+sw2-6,sy+sr-5,{align:"right"});doc.setTextColor(...dk)}sy+=sr});
  y+=hh+bh2+3;
  // Bottom
  const lw=pw*.52,rw3=pw*.48,blh=52;doc.rect(m,y,lw,blh);doc.setFontSize(9);doc.setFont("helvetica","bold");doc.text("DAMAGE WAIVER",m+lw/2,y+12,{align:"center"});
  doc.setFontSize(5.5);doc.setFont("helvetica","normal");["I acknowledge towing or servicing the above referenced vehicle may result","in damage or loss, including loss or theft of personal items. I assume","full responsibility and release United Towing & Transport LLC and it's","representatives from any liability."].forEach((l,i)=>doc.text(l,m+4,y+22+i*7));
  doc.rect(m+lw,y,rw3,blh);doc.setFontSize(8);let py=y+14;["CASH","CK#","CHARGE ACCOUNT"].forEach(pm=>{ck(m+lw+8,py-3,pay.toUpperCase()===pm.split("#")[0].trim());doc.setFont("helvetica","normal");doc.text(pm,m+lw+20,py+4);py+=12});y+=blh+2;
  bx(m,y,pw*.5,20,"P.O.#",job.poNumber||"");bx(m+pw*.5,y,pw*.5,20,"R.A.#",job.raNumber||"");y+=23;
  doc.setFontSize(7);doc.text("x ___________________________________",m,y+8);doc.text("OWNER / AGENT",m+20,y+16);y+=22;
  doc.rect(m,y,lw,36);doc.setFontSize(8);doc.setFont("helvetica","bold");doc.text("ACKNOWLEDGMENT",m+lw/2,y+10,{align:"center"});
  doc.setFontSize(5.5);doc.setFont("helvetica","normal");doc.text("I acknowledge receipt of the above referenced vehicle and hereby",m+4,y+20);doc.text("release United Towing & Transport LLC from all liability.",m+4,y+27);y+=38;
  doc.setFontSize(7);doc.text("x ___________________________________",m,y+8);doc.text("OWNER / AGENT",m+20,y+16);y+=22;
  const bh3=26;doc.setFontSize(18);doc.setFont("helvetica","bold");doc.setTextColor(...dk);doc.text("No. "+(job.id||"").slice(-6).toUpperCase(),m+4,y+18);
  const tw3=pw*.42,tx=m+pw-tw3;doc.setFillColor(...dk);doc.rect(tx,y,tw3*.55,bh3,"F");doc.setTextColor(...wt);doc.setFontSize(14);doc.text("TOTAL",tx+tw3*.275,y+18,{align:"center"});
  doc.setTextColor(...dk);doc.rect(tx+tw3*.55,y,tw3*.45,bh3);if(tot>0){doc.setFontSize(15);doc.setFont("helvetica","bold");doc.setTextColor(...bl);doc.text(tot.toFixed(2),tx+tw3-6,y+18,{align:"right"})}
  y+=bh3+3;doc.setTextColor(...dk);doc.setFontSize(7);doc.setFont("helvetica","normal");doc.text("Thank You For Your Business",w-m,y+6,{align:"right"});
  doc.save("UnitedTowing_"+(job.customer?.name||"job").replace(/[^a-zA-Z0-9]/g,"_").slice(0,20)+"_"+(job.jobDate||"").replace(/-/g,"")+".pdf");
}

/* ─── STYLES ─── */
const C={bg:"#f5f4f1",wh:"#fff",dk:"#1a1a2e",ac:"#2d6a4f",red:"#c1292e",org:"#d97706",grn:"#2d6a4f",mut:"#8a8a8a",bdr:"#e2e0db",lgrn:"#e8f5e9",lred:"#fce8e8",lylw:"#fef9e7",lblu:"#e8f0fe",shd:"0 1px 3px rgba(0,0,0,0.06)"};
const btn={padding:"10px 18px",borderRadius:8,border:"none",cursor:"pointer",fontSize:14,fontWeight:600};
const inp={width:"100%",padding:"10px 11px",fontSize:14,borderRadius:7,border:`1.5px solid ${C.bdr}`,background:C.wh,boxSizing:"border-box",fontFamily:"inherit",outline:"none"};
const lbl={fontSize:11,fontWeight:600,color:C.mut,display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:.5};

/* ─── COMPONENTS ─── */
function Photo({label,icon,value,onChange}){
  const ref=useRef(null);const[prev,setPrev]=useState(value);
  return(<div><div style={lbl}>{label}</div>{prev?
    <div style={{position:"relative",borderRadius:8,overflow:"hidden",border:`1.5px solid ${C.bdr}`}}><img src={prev} alt={label} style={{width:"100%",height:100,objectFit:"cover",display:"block"}} /><button onClick={e=>{e.stopPropagation();setPrev(null);onChange(null);if(ref.current)ref.current.value=""}} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,.6)",color:"#fff",border:"none",borderRadius:"50%",width:22,height:22,fontSize:13,cursor:"pointer"}}>&times;</button></div>:
    <div onClick={()=>ref.current?.click()} style={{border:`1.5px dashed ${C.bdr}`,borderRadius:8,padding:"16px 8px",textAlign:"center",color:C.mut,fontSize:11,cursor:"pointer",background:C.wh}}><div style={{fontSize:20,marginBottom:2}}>{icon}</div>Tap</div>}
    <input ref={ref} type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onloadend=()=>{setPrev(r.result);onChange(r.result)};r.readAsDataURL(f)}} style={{display:"none"}} /></div>);
}

function SvcPricing({services,onChange}){
  const s=services||{};
  return(<div>{SVC_ITEMS.map(i=>{const v=s[i.k]||"";const on=parseFloat(v)>0;return(
    <div key={i.k} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:`1px solid ${C.bg}`}}>
      <div style={{flex:1,fontSize:13,fontWeight:on?600:400,color:on?C.dk:C.mut}}>{i.l}</div>
      <input value={v} onChange={e=>onChange({...s,[i.k]:e.target.value})} placeholder="$" type="number" inputMode="decimal"
        style={{width:85,padding:"7px 8px",fontSize:14,borderRadius:6,border:`1.5px solid ${on?C.ac:C.bdr}`,background:on?"#f0faf4":C.wh,textAlign:"right",boxSizing:"border-box",fontFamily:"inherit",fontWeight:on?600:400}} />
    </div>)})}</div>);
}

/* ─── LOGIN ─── */
function Login({onAuth}){
  const[p,setP]=useState("");const[err,setErr]=useState(false);
  const go=()=>{if(p.toLowerCase()===PIN){localStorage.setItem("ut-auth","1");onAuth()}else{setErr(true);setTimeout(()=>setErr(false),2000)}};
  return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.dk}}>
    <div onKeyDown={e=>e.key==="Enter"&&go()} style={{textAlign:"center",padding:40}}>
      <div style={{fontSize:22,fontWeight:700,color:"#fff",marginBottom:4}}>United Towing</div>
      <div style={{fontSize:12,color:"#888",marginBottom:20}}>Enter access code</div>
      <input value={p} onChange={e=>{setP(e.target.value);setErr(false)}} type="password" placeholder="Access code" autoFocus
        style={{padding:"12px 16px",fontSize:16,borderRadius:8,border:err?"2px solid #c1292e":"2px solid #444",background:"#2a2a3e",color:"#fff",width:200,textAlign:"center",outline:"none",display:"block",margin:"0 auto 12px"}} />
      <button onClick={go} style={{...btn,background:"#fff",color:C.dk,width:200}}>Enter</button>
      {err&&<div style={{color:"#c1292e",fontSize:12,marginTop:8}}>Wrong code</div>}
    </div></div>);
}

/* ─── CAPTURE FORM ─── */
function Capture({onSubmit,onCancel}){
  const[j,setJ]=useState(blank());const[cust2,setCust2]=useState(false);
  const[done,setDone]=useState(false);const[busy,setBusy]=useState(false);
  const[test,setTest]=useState(false);const[more,setMore]=useState(false);
  const u=(p,v)=>setJ(prev=>{const c=JSON.parse(JSON.stringify(prev));const k=p.split(".");let r=c;for(let i=0;i<k.length-1;i++)r=r[k[i]];r[k[k.length-1]]=v;return c});
  const{sub,tax,cc,total,svcSum}=calcTotals(j.services,j.tolls,j.paymentType);
  const go=async()=>{
    if(!j.customer.name&&!cust2)return;
    const f={...j,price:svcSum||j.price,isTest:test};
    if(!svcSum&&(!f.price||isNaN(f.price)))f.status=ST.MISSING;
    if(f.status===ST.PAID)f.paidDate=new Date().toISOString();
    setBusy(true);await sync(f,"add");if(!test)onSubmit(f);setBusy(false);setDone(true);
    setTimeout(()=>{setDone(false);setJ(blank());setCust2(false)},1500);
  };
  if(done)return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg}}>
    <div style={{textAlign:"center"}}><div style={{fontSize:44,marginBottom:8,color:test?"#666":C.grn}}>{test?"\uD83E\uDDEA":"\u2713"}</div>
    <div style={{fontSize:20,fontWeight:700,color:C.dk}}>{test?"Test sent":"Job logged"}</div></div></div>);
  const S=({children,title})=>(<div style={{background:C.bg,borderRadius:8,padding:"12px 14px",marginBottom:12}}>{title&&<div style={{fontSize:12,fontWeight:700,color:C.dk,marginBottom:8}}>{title}</div>}{children}</div>);
  return(
    <div style={{minHeight:"100vh",background:test?"#fff8f0":C.bg}}>
      <div style={{background:test?"#c2410c":C.dk,color:"#fff",padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:16,fontWeight:700}}>Log job</div><div style={{fontSize:11,color:"#ccc"}}>{test?"Test mode":"Syncs to Sheets"}</div></div>
        <button onClick={onCancel} style={{...btn,background:"rgba(255,255,255,.15)",color:"#fff",fontSize:12,padding:"7px 14px"}}>Cancel</button>
      </div>
      <div style={{padding:"14px 18px",maxWidth:440,margin:"0 auto"}}>
        {/* Test toggle */}
        <div onClick={()=>setTest(!test)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,padding:"8px 12px",borderRadius:8,background:test?"#fff7ed":C.wh,border:`1.5px solid ${test?"#c2410c":C.bdr}`,cursor:"pointer"}}>
          <div style={{width:36,height:20,borderRadius:10,background:test?"#c2410c":"#ccc",position:"relative",transition:"all .2s"}}><div style={{width:16,height:16,borderRadius:8,background:"#fff",position:"absolute",top:2,left:test?18:2,transition:"all .2s"}} /></div>
          <span style={{fontSize:12,fontWeight:600,color:test?"#c2410c":C.mut}}>Test mode</span>
        </div>
        {/* Date/Time */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div><label style={lbl}>Date</label><input type="date" value={j.jobDate} onChange={e=>u("jobDate",e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Time</label><input type="time" value={j.jobTime} onChange={e=>u("jobTime",e.target.value)} style={inp} /></div>
        </div>
        {/* Customer */}
        <S title="Customer">
          {!cust2?<select value={j.customer.name} onChange={e=>{if(e.target.value==="__new__"){setCust2(true);u("customer.name","")}else u("customer.name",e.target.value)}} style={{...inp,appearance:"auto"}}>
            <option value="">Select partner...</option>{PARTNERS.map(p=><option key={p} value={p}>{p}</option>)}<option value="__new__">+ New customer</option></select>:
            <div style={{display:"flex",gap:6}}><input value={j.customer.name} onChange={e=>u("customer.name",e.target.value)} placeholder="Name" style={{...inp,flex:1}} /><button onClick={()=>{setCust2(false);u("customer.name","")}} style={{...btn,padding:"8px 10px",background:C.bdr,color:C.dk,fontSize:11}}>Back</button></div>}
          <div style={{marginTop:8}}><label style={lbl}>Phone</label><input value={j.customer.phone} onChange={e=>u("customer.phone",e.target.value)} placeholder="914-555-1234" type="tel" style={inp} /></div>
        </S>
        {/* Vehicle */}
        <S title="Vehicle">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
            {[["Color","vehicle.color","Silver"],["Make","vehicle.make","Ford"],["Model","vehicle.model","E350"]].map(([l2,p,ph])=>(<div key={p}><label style={lbl}>{l2}</label><input value={p.split(".").reduce((o,k)=>o[k],j)} onChange={e=>u(p,e.target.value)} placeholder={ph} style={inp} /></div>))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            <div><label style={lbl}>Year</label><input value={j.vehicle.year} onChange={e=>u("vehicle.year",e.target.value)} placeholder="2021" style={inp} /></div>
            <div><label style={lbl}>VIN</label><input value={j.vehicle.vin} onChange={e=>u("vehicle.vin",e.target.value)} placeholder="VIN" style={inp} /></div>
            <div><label style={lbl}>Plate</label><input value={j.vehicle.plate} onChange={e=>u("vehicle.plate",e.target.value)} placeholder="ABC1234" style={inp} /></div>
          </div>
        </S>
        {/* Locations */}
        <S title="Locations">
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginBottom:8}}>
            <div><label style={lbl}>Pickup</label><input value={j.pickup} onChange={e=>u("pickup",e.target.value)} placeholder="123 Main St" style={inp} /></div>
            <div><label style={lbl}>City</label><input value={j.pickupCity} onChange={e=>u("pickupCity",e.target.value)} placeholder="Yonkers" style={inp} /></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8}}>
            <div><label style={lbl}>Dropoff</label><input value={j.dropoff} onChange={e=>u("dropoff",e.target.value)} placeholder="JC Auto" style={inp} /></div>
            <div><label style={lbl}>City</label><input value={j.dropoffCity} onChange={e=>u("dropoffCity",e.target.value)} placeholder="Scarsdale" style={inp} /></div>
          </div>
        </S>
        {/* Services + Pricing */}
        <S title="Services & pricing">
          <SvcPricing services={j.services} onChange={s=>setJ(p=>({...p,services:s}))} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
            <div><label style={lbl}>Tolls</label><input value={j.tolls} onChange={e=>u("tolls",e.target.value)} placeholder="$0" type="number" style={inp} /></div>
            <div><label style={lbl}>Payment</label><select value={j.paymentType} onChange={e=>u("paymentType",e.target.value)} style={{...inp,appearance:"auto"}}>{PAY_TYPES.map(p=><option key={p}>{p}</option>)}</select></div>
          </div>
          {total>0&&<div style={{borderTop:`1px solid ${C.bdr}`,marginTop:10,paddingTop:8,fontSize:13}}>
            <div style={{display:"flex",justifyContent:"space-between",color:C.mut}}><span>Subtotal</span><span>{fmtMoney(sub)}</span></div>
            {tax>0&&<div style={{display:"flex",justifyContent:"space-between",color:C.mut}}><span>Tax</span><span>{fmtMoney(tax)}</span></div>}
            {cc>0&&<div style={{display:"flex",justifyContent:"space-between",color:C.mut}}><span>CC fee</span><span>{fmtMoney(cc)}</span></div>}
            <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:16,color:C.dk,marginTop:4}}><span>Total</span><span>{fmtMoney(total)}</span></div>
          </div>}
        </S>
        {/* Status */}
        <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1.5px solid ${C.bdr}`,marginBottom:12}}>
          <div onClick={()=>u("status",ST.PAID)} style={{flex:1,padding:"10px 0",textAlign:"center",fontSize:13,fontWeight:600,cursor:"pointer",background:j.status===ST.PAID?C.grn:C.wh,color:j.status===ST.PAID?"#fff":C.mut}}>Paid</div>
          <div onClick={()=>u("status",ST.UNPAID)} style={{flex:1,padding:"10px 0",textAlign:"center",fontSize:13,fontWeight:600,cursor:"pointer",background:j.status===ST.UNPAID?C.red:C.wh,color:j.status===ST.UNPAID?"#fff":C.mut,borderLeft:`1px solid ${C.bdr}`}}>Needs payment</div>
        </div>
        {/* More fields */}
        <div onClick={()=>setMore(!more)} style={{textAlign:"center",padding:"6px 0",fontSize:12,fontWeight:600,color:C.ac,cursor:"pointer",marginBottom:more?8:12}}>{more?"\u25B2 Less":"\u25BC Owner, PO#, photos"}</div>
        {more&&<><S title="Vehicle owner"><div style={{marginBottom:8}}><label style={lbl}>Name</label><input value={j.owner.name} onChange={e=>u("owner.name",e.target.value)} style={inp} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><label style={lbl}>Home phone</label><input value={j.owner.homePhone} onChange={e=>u("owner.homePhone",e.target.value)} type="tel" style={inp} /></div><div><label style={lbl}>Work phone</label><input value={j.owner.workPhone} onChange={e=>u("owner.workPhone",e.target.value)} type="tel" style={inp} /></div></div></S>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}><div><label style={lbl}>PO #</label><input value={j.poNumber} onChange={e=>u("poNumber",e.target.value)} style={inp} /></div><div><label style={lbl}>RA #</label><input value={j.raNumber} onChange={e=>u("raNumber",e.target.value)} style={inp} /></div></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}><Photo label="Vehicle" icon="\uD83D\uDCF7" value={j.vehiclePhoto} onChange={v=>setJ(p=>({...p,vehiclePhoto:v}))} /><Photo label="Registration" icon="\uD83D\uDCC4" value={j.registrationPhoto} onChange={v=>setJ(p=>({...p,registrationPhoto:v}))} /></div></>}
        {/* Notes */}
        <div style={{marginBottom:14}}><label style={lbl}>Notes</label><input value={j.notes} onChange={e=>u("notes",e.target.value)} placeholder="AAA referral, etc." style={inp} /></div>
        <button onClick={go} disabled={busy} style={{...btn,width:"100%",padding:13,fontSize:15,background:busy?"#888":(test?"#c2410c":C.dk),color:"#fff",borderRadius:10}}>{busy?"Saving...":(test?"\uD83E\uDDEA Test":"Log job")}</button>
      </div></div>);
}

/* ─── EDIT PANEL ─── */
function Edit({job,onSave,onClose}){
  const leg=job.source==="legacy";
  const[j,setJ]=useState(JSON.parse(JSON.stringify(job)));
  const[busy,setBusy]=useState(false);const[msg,setMsg]=useState("");const[pdfing,setPdfing]=useState(false);
  const u=(p,v)=>setJ(prev=>{const c=JSON.parse(JSON.stringify(prev));const k=p.split(".");let r=c;for(let i=0;i<k.length-1;i++)r=r[k[i]];r[k[k.length-1]]=v;return c});
  const{sub,tax,cc,total,svcSum}=calcTotals(j.services,j.tolls,j.paymentType);
  const save=async()=>{
    setBusy(true);
    const saved={...j,price:svcSum||j.price,source:"app"};
    // If legacy, create new app job with legacy link
    if(leg){saved.id=uid();saved.legacyNum=job.legacyNum}
    await sync(saved,leg?"add":"update");
    onSave(saved);setMsg("Saved");setBusy(false);setTimeout(()=>setMsg(""),2000);
  };
  const pdf=async()=>{setPdfing(true);try{await makePDF(j)}catch(e){alert("PDF error")}setPdfing(false)};
  const ro=leg?{...inp,background:"#f0f0f0",color:"#666"}:inp;
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:12}}>
      <div style={{background:C.wh,borderRadius:12,width:"100%",maxWidth:560,maxHeight:"92vh",overflow:"auto",padding:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div><div style={{fontSize:16,fontWeight:700,color:C.dk}}>{leg?"Job #"+job.legacyNum:"Edit job"}</div>
          {leg&&<div style={{fontSize:11,color:"#666",marginTop:2}}>Editing creates app copy — original stays untouched</div>}</div>
          <button onClick={onClose} style={{...btn,padding:"5px 10px",background:C.bdr,color:C.dk,fontSize:11}}>Close</button>
        </div>
        {/* Legacy original */}
        {leg&&<div style={{background:C.lblu,borderRadius:8,padding:12,marginBottom:14,fontSize:12,lineHeight:1.6}}>
          <div><strong>Original:</strong> {job.title}</div>
          <div><strong>Price:</strong> {job.legacyRaw?.payout!=null?String(job.legacyRaw.payout):"—"} &middot; <strong>Payment:</strong> {job.legacyRaw?.paymentType||"—"}</div>
          <div><strong>Receipt:</strong> {job.legacyRaw?.receiptStatus||"—"}</div>
        </div>}
        {/* Date/Time */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div><label style={lbl}>Date</label><input type="date" value={j.jobDate} onChange={e=>u("jobDate",e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Time</label><input type="time" value={j.jobTime} onChange={e=>u("jobTime",e.target.value)} style={inp} /></div>
        </div>
        {/* Customer */}
        <div style={{background:C.bg,borderRadius:8,padding:"12px 14px",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:C.dk,marginBottom:8}}>Customer</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><label style={lbl}>Name</label><input value={j.customer.name} onChange={e=>u("customer.name",e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Phone</label><input value={j.customer.phone} onChange={e=>u("customer.phone",e.target.value)} style={inp} /></div>
          </div>
        </div>
        {/* Vehicle */}
        <div style={{background:C.bg,borderRadius:8,padding:"12px 14px",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:C.dk,marginBottom:8}}>Vehicle</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:8}}>
            {[["Year","vehicle.year"],["Color","vehicle.color"],["Make","vehicle.make"],["Model","vehicle.model"]].map(([l2,p])=>(<div key={p}><label style={lbl}>{l2}</label><input value={p.split(".").reduce((o,k)=>o[k],j)} onChange={e=>u(p,e.target.value)} style={inp} /></div>))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><label style={lbl}>VIN</label><input value={j.vehicle.vin} onChange={e=>u("vehicle.vin",e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Plate</label><input value={j.vehicle.plate} onChange={e=>u("vehicle.plate",e.target.value)} style={inp} /></div>
          </div>
        </div>
        {/* Locations */}
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginBottom:8}}>
          <div><label style={lbl}>Pickup</label><input value={j.pickup} onChange={e=>u("pickup",e.target.value)} style={inp} /></div>
          <div><label style={lbl}>City</label><input value={j.pickupCity} onChange={e=>u("pickupCity",e.target.value)} style={inp} /></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginBottom:12}}>
          <div><label style={lbl}>Dropoff</label><input value={j.dropoff} onChange={e=>u("dropoff",e.target.value)} style={inp} /></div>
          <div><label style={lbl}>City</label><input value={j.dropoffCity} onChange={e=>u("dropoffCity",e.target.value)} style={inp} /></div>
        </div>
        {/* Services */}
        <div style={{background:C.bg,borderRadius:8,padding:"12px 14px",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:C.dk,marginBottom:8}}>Services & pricing</div>
          <SvcPricing services={j.services} onChange={s=>setJ(p=>({...p,services:s}))} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
            <div><label style={lbl}>Tolls</label><input value={j.tolls} onChange={e=>u("tolls",e.target.value)} type="number" placeholder="0" style={inp} /></div>
            <div><label style={lbl}>Payment</label><select value={j.paymentType} onChange={e=>u("paymentType",e.target.value)} style={{...inp,appearance:"auto"}}>{PAY_TYPES.map(p=><option key={p}>{p}</option>)}</select></div>
          </div>
          {sub>0&&<div style={{borderTop:`1px solid ${C.bdr}`,marginTop:10,paddingTop:8,fontSize:13}}>
            <div style={{display:"flex",justifyContent:"space-between",color:C.mut}}><span>Subtotal</span><span>{fmtMoney(sub)}</span></div>
            {tax>0&&<div style={{display:"flex",justifyContent:"space-between",color:C.mut}}><span>Tax</span><span>{fmtMoney(tax)}</span></div>}
            {cc>0&&<div style={{display:"flex",justifyContent:"space-between",color:C.mut}}><span>CC fee</span><span>{fmtMoney(cc)}</span></div>}
            <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:16,color:C.dk,marginTop:4}}><span>Total</span><span>{fmtMoney(total)}</span></div>
          </div>}
        </div>
        {/* Owner / PO / RA */}
        <div style={{background:C.bg,borderRadius:8,padding:"12px 14px",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:C.dk,marginBottom:8}}>Owner / references</div>
          <div style={{marginBottom:8}}><label style={lbl}>Owner</label><input value={(j.owner||{}).name||""} onChange={e=>u("owner.name",e.target.value)} style={inp} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><label style={lbl}>Home phone</label><input value={(j.owner||{}).homePhone||""} onChange={e=>u("owner.homePhone",e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Work phone</label><input value={(j.owner||{}).workPhone||""} onChange={e=>u("owner.workPhone",e.target.value)} style={inp} /></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><label style={lbl}>PO #</label><input value={j.poNumber||""} onChange={e=>u("poNumber",e.target.value)} style={inp} /></div>
            <div><label style={lbl}>RA #</label><input value={j.raNumber||""} onChange={e=>u("raNumber",e.target.value)} style={inp} /></div>
          </div>
        </div>
        <div style={{marginBottom:12}}><label style={lbl}>Notes</label><textarea value={j.notes} onChange={e=>u("notes",e.target.value)} rows={2} style={{...inp,resize:"vertical"}} /></div>
        {/* Status */}
        <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1.5px solid ${C.bdr}`,marginBottom:12}}>
          <div onClick={()=>u("status",ST.PAID)} style={{flex:1,padding:"10px 0",textAlign:"center",fontSize:13,fontWeight:600,cursor:"pointer",background:j.status===ST.PAID?C.grn:C.wh,color:j.status===ST.PAID?"#fff":C.mut}}>Paid</div>
          <div onClick={()=>u("status",ST.UNPAID)} style={{flex:1,padding:"10px 0",textAlign:"center",fontSize:13,fontWeight:600,cursor:"pointer",background:j.status===ST.UNPAID?C.red:C.wh,color:j.status===ST.UNPAID?"#fff":C.mut,borderLeft:`1px solid ${C.bdr}`}}>Unpaid</div>
        </div>
        <button onClick={save} disabled={busy} style={{...btn,width:"100%",padding:12,background:busy?"#888":C.dk,color:"#fff",borderRadius:8,marginBottom:6}}>{busy?"Saving...":"Save"+(leg?" to App Jobs":"")}</button>
        {msg&&<div style={{textAlign:"center",fontSize:12,color:C.grn,fontWeight:600,marginBottom:6}}>{msg}</div>}
        <button onClick={pdf} disabled={pdfing} style={{...btn,width:"100%",padding:10,background:pdfing?"#888":"#92400e",color:"#fff",borderRadius:8,fontSize:13}}>{pdfing?"Generating...":"Generate PDF"}</button>
      </div></div>);
}

/* ─── DASHBOARD ─── */
function Dash({jobs,setJobs,onNew,onOut,loading,refresh}){
  const[edit,setEdit]=useState(null);const[filt,setFilt]=useState("action");
  const[q,setQ]=useState("");const[src,setSrc]=useState("all");const[show,setShow]=useState(50);
  let pool=jobs;if(src==="app")pool=jobs.filter(j=>j.source==="app");else if(src==="legacy")pool=jobs.filter(j=>j.source==="legacy");
  const unpaid=pool.filter(j=>j.status!==ST.PAID&&j.price&&!isNaN(j.price));
  const missing=pool.filter(j=>!j.price||isNaN(j.price));
  const paid=pool.filter(j=>j.status===ST.PAID);
  const colAmt=paid.reduce((a,j)=>a+(parseFloat(j.price)||0),0);
  const unpAmt=unpaid.reduce((a,j)=>a+(parseFloat(j.price)||0),0);
  const aging={"0-30":0,"30-60":0,"60-90":0,"90+":0};
  unpaid.forEach(j=>{const d=days(j.jobDate||j.createdAt);if(d<=30)aging["0-30"]++;else if(d<=60)aging["30-60"]++;else if(d<=90)aging["60-90"]++;else aging["90+"]++});
  // Partner AR
  const ar={};unpaid.forEach(j=>{const n=j.customer.name;if(!n)return;if(!ar[n])ar[n]={n:0,t:0,old:j.jobDate};ar[n].n++;ar[n].t+=parseFloat(j.price)||0;if(j.jobDate&&j.jobDate<(ar[n].old||"9"))ar[n].old=j.jobDate});
  const arList=Object.entries(ar).sort((a,b)=>b[1].t-a[1].t);
  const oneOff=unpaid.filter(j=>!j.customer.name);const oneOffAmt=oneOff.reduce((a,j)=>a+(parseFloat(j.price)||0),0);
  // Filter
  let list=pool;
  if(filt==="action")list=pool.filter(j=>j.status!==ST.PAID);
  else if(filt==="unpaid")list=unpaid;else if(filt==="missing")list=missing;else if(filt==="paid")list=paid;
  if(q){const s=q.toLowerCase();list=list.filter(j=>(j.customer.name||"").toLowerCase().includes(s)||(j.title||"").toLowerCase().includes(s)||(j.vehicle.make||"").toLowerCase().includes(s)||(j.vehicle.model||"").toLowerCase().includes(s)||(j.notes||"").toLowerCase().includes(s)||(j.pickup||"").toLowerCase().includes(s)||(j.dropoff||"").toLowerCase().includes(s))}
  list=[...list].sort((a,b)=>(b.jobDate||"").localeCompare(a.jobDate||""));
  const legN=jobs.filter(j=>j.source==="legacy").length;const appN=jobs.filter(j=>j.source==="app").length;
  const maxA=Math.max(...Object.values(aging),1);
  const handleSave=saved=>{setJobs(prev=>{const next=prev.map(j=>j.id===saved.id?saved:j);if(!prev.find(j=>j.id===saved.id))next.push(saved);cache(next);return next});setEdit(null)};
  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      {/* Header */}
      <div style={{background:C.dk,padding:"12px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:16,fontWeight:700,color:"#fff"}}>United Towing</div>
        <div style={{fontSize:11,color:"#777"}}>{loading?"Loading...":jobs.length+" jobs"}</div></div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={refresh} style={{...btn,background:"rgba(255,255,255,.1)",color:"#fff",fontSize:11,padding:"7px 10px"}}>{loading?"\u23F3":"\u21BB"}</button>
          <button onClick={onNew} style={{...btn,background:"#fff",color:C.dk,fontSize:12,padding:"7px 14px"}}>+ Log job</button>
          <button onClick={onOut} style={{...btn,background:"rgba(255,255,255,.1)",color:"#666",fontSize:10,padding:"7px 8px"}}>Out</button>
        </div>
      </div>
      <div style={{padding:"14px 16px",maxWidth:960,margin:"0 auto"}}>
        {/* Source tabs */}
        <div style={{display:"flex",gap:5,marginBottom:12}}>
          {[["all","All"],["legacy","Legacy ("+legN+")"],["app","App ("+appN+")"]].map(([k,l2])=>(
            <span key={k} onClick={()=>setSrc(k)} style={{padding:"4px 11px",borderRadius:14,fontSize:11,fontWeight:600,cursor:"pointer",background:src===k?C.dk:C.wh,color:src===k?"#fff":C.mut,border:`1px solid ${src===k?C.dk:C.bdr}`}}>{l2}</span>))}
        </div>
        {/* Metrics */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:14}}>
          {[{l:"Jobs",v:pool.length,bg:C.bg,c:C.dk},{l:"Collected",v:"$"+Math.round(colAmt).toLocaleString(),bg:C.lgrn,c:C.grn},{l:"Unpaid",v:"$"+Math.round(unpAmt).toLocaleString(),bg:C.lred,c:C.red},{l:"Missing",v:missing.length,bg:C.lylw,c:C.org}].map((m,i)=>(
            <div key={i} style={{background:m.bg,borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
              <div style={{fontSize:9,fontWeight:700,color:m.c,textTransform:"uppercase",letterSpacing:.5}}>{m.l}</div>
              <div style={{fontSize:17,fontWeight:700,color:m.c}}>{m.v}</div>
            </div>))}
        </div>
        {/* AR + Aging */}
        <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:10,marginBottom:14}}>
          <div style={{background:C.wh,borderRadius:10,padding:"12px 14px",boxShadow:C.shd}}>
            <div style={{fontSize:13,fontWeight:700,color:C.red,marginBottom:8}}>Unpaid partners</div>
            {arList.length===0?<div style={{fontSize:11,color:C.mut,textAlign:"center",padding:8}}>None</div>:
            arList.map(([n,d],i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<arList.length-1?`1px solid ${C.bg}`:""}}><div><div style={{fontSize:12,fontWeight:600}}>{n}</div><div style={{fontSize:10,color:C.mut}}>{d.n} &middot; {days(d.old)}d</div></div><div style={{fontSize:13,fontWeight:700,color:C.red}}>{fmtMoney(d.t)}</div></div>))}
            {oneOff.length>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",color:C.mut,fontSize:12}}><span>One-off ({oneOff.length})</span><span>{fmtMoney(oneOffAmt)}</span></div>}
            <div style={{borderTop:`2px solid ${C.bdr}`,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:700}}><span>Total</span><span style={{color:C.red}}>{fmtMoney(unpAmt)}</span></div>
          </div>
          <div style={{background:C.wh,borderRadius:10,padding:"12px 14px",boxShadow:C.shd}}>
            <div style={{fontSize:13,fontWeight:700,color:C.dk,marginBottom:8}}>Aging</div>
            {[{l:"0-30d",n:aging["0-30"],c:C.grn},{l:"30-60d",n:aging["30-60"],c:C.org},{l:"60-90d",n:aging["60-90"],c:"#D85A30"},{l:"90+d",n:aging["90+"],c:C.red}].map((a,i)=>(
              <div key={i} style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.mut,marginBottom:2}}><span>{a.l}</span><span style={{fontWeight:600}}>{a.n}</span></div>
              <div style={{height:8,borderRadius:4,background:C.bg,overflow:"hidden"}}><div style={{width:`${Math.round((a.n/maxA)*100)}%`,height:"100%",background:a.c,borderRadius:4}} /></div></div>))}
          </div>
        </div>
        {/* Job list */}
        <div style={{background:C.wh,borderRadius:10,padding:"12px 14px",boxShadow:C.shd}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:6}}>
            <div style={{fontSize:14,fontWeight:700}}>Jobs</div>
            <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
              <input value={q} onChange={e=>{setQ(e.target.value);setShow(50)}} placeholder="Search..." style={{padding:"5px 8px",fontSize:11,borderRadius:6,border:`1px solid ${C.bdr}`,width:110}} />
              {["action","unpaid","missing","paid","all"].map(f=>(<span key={f} onClick={()=>{setFilt(f);setShow(50)}} style={{padding:"3px 7px",borderRadius:10,fontSize:10,fontWeight:600,cursor:"pointer",background:filt===f?C.dk:C.bg,color:filt===f?"#fff":C.mut}}>{f==="action"?"Needs action":f[0].toUpperCase()+f.slice(1)}</span>))}
            </div>
          </div>
          {list.slice(0,show).map(j=>{
            const t=j.source==="legacy"?j.title:([j.vehicle.color,j.vehicle.make,j.vehicle.model].filter(Boolean).join(" ")||j.title||"No info");
            return(<div key={j.id} onClick={()=>setEdit(j)} style={{padding:"9px 0",borderBottom:`1px solid ${C.bg}`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:C.dk,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t||"—"}{j.source==="legacy"&&<span style={{padding:"1px 4px",borderRadius:4,fontSize:8,fontWeight:700,background:C.lblu,color:"#1565c0",marginLeft:5}}>L</span>}{j.receiptMissing&&<span style={{padding:"1px 4px",borderRadius:4,fontSize:8,fontWeight:700,background:C.lylw,color:C.org,marginLeft:4}}>No rcpt</span>}</div>
                <div style={{fontSize:11,color:C.mut,marginTop:1}}>{j.customer.name||""}{j.customer.name&&" \u00B7 "}{fmtDate(j.jobDate)}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:13,fontWeight:700,color:j.price&&!isNaN(j.price)?C.dk:C.org}}>{j.price&&!isNaN(j.price)?fmtMoney(j.price):"No price"}</div>
                <div style={{fontSize:10,fontWeight:600,color:j.status===ST.PAID?C.grn:(j.status===ST.UNPAID?C.red:C.org)}}>{j.status===ST.PAID?"Paid":(j.status===ST.UNPAID?"Unpaid":"Missing")}</div>
              </div>
            </div>)})}
          {list.length>show&&<button onClick={()=>setShow(s=>s+50)} style={{...btn,width:"100%",marginTop:8,padding:10,background:C.bg,color:C.dk,fontSize:12,borderRadius:8}}>Show more ({list.length-show} remaining)</button>}
          {list.length===0&&<div style={{textAlign:"center",padding:16,fontSize:12,color:C.mut}}>No jobs match</div>}
        </div>
      </div>
      {edit&&<Edit job={edit} onSave={handleSave} onClose={()=>setEdit(null)} />}
    </div>);
}

/* ─── ROOT ─── */
export default function App(){
  const[auth,setAuth]=useState(()=>localStorage.getItem("ut-auth")==="1");
  const[jobs,setJobs]=useState([]);const[view,setView]=useState("dash");const[loading,setLoading]=useState(false);
  const load=useCallback(async()=>{setLoading(true);const r=await fetchAll();if(r&&r.length>0){setJobs(r);cache(r)}else{const c=loadCache();if(c.length>0)setJobs(c)};setLoading(false)},[]);
  useEffect(()=>{if(auth)load()},[auth,load]);
  const add=useCallback(j=>{setJobs(p=>{const n=[...p,j];cache(n);return n});setView("dash")},[]);
  if(!auth)return<Login onAuth={()=>setAuth(true)} />;
  if(view==="log")return<Capture onSubmit={add} onCancel={()=>setView("dash")} />;
  return<Dash jobs={jobs} setJobs={setJobs} onNew={()=>setView("log")} onOut={()=>{localStorage.removeItem("ut-auth");setAuth(false)}} loading={loading} refresh={load} />;
}
