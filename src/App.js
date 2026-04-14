import React, { useState, useEffect, useCallback, useRef } from "react";

/* ════════════════════════════════════════
   CONFIG
   ════════════════════════════════════════ */
const PIN = "united149";
const TAX = 0.08375;
const CC_FEE = 0.045;
const PARTNERS = [
  "JC Auto","Gabe Citgo","Karls Auto Body","Tasca Ford","Hartsdale Mobil",
  "RDI Property Group","NFA Towing","German Car","Mancuso Auto Body",
  "Cruz Control Auto","Vasco Tech Center","Performance Auto",
  "Preferred Auto Service","Sal's Auto","Ferry Auto","Yonkers Auto Gallery",
  "Renzo Auto","Tierney Auto","Caldarola Auto Body",
  "Frank Donato Construction","Lenny's Auto"
];
const SVC = [
  { k:"towing", l:"Towing" },{ k:"waiting", l:"Waiting Time" },
  { k:"winch", l:"Winch" },{ k:"road_service", l:"Road Service" },
  { k:"gate_fee", l:"Gate Fee" },{ k:"admin_fee", l:"Admin Fee" },
  { k:"storage", l:"Storage" }
];
const PAY = ["Cash","Zelle","Check","Credit Card","Invoice Later","Pending Insurance"];
const ST = { PAID:"paid", UNPAID:"unpaid", MISSING:"missing" };

/*  NEW COLUMN MAP (clean sheet layout)
    A=Job#  B=Date  C=Time  D=Description  E=Customer  F=Phone
    G=Pickup  H=Dropoff  I=Color  J=Make  K=Model  L=Year  M=Plate
    N=Price  O=Payment  P=Status  Q=Notes  R=VIN  S=Services(JSON)  T=Extended(JSON)
    Indices: 0-19 (20 columns)
*/
const COL = {
  ID:0, DATE:1, TIME:2, DESC:3, CUST:4, PHONE:5,
  PICKUP:6, DROPOFF:7, COLOR:8, MAKE:9, MODEL:10, YEAR:11, PLATE:12,
  PRICE:13, PAYMENT:14, STATUS:15, NOTES:16, VIN:17, SVC:18, EXT:19
};

/* ════════════════════════════════════════
   THEME
   ════════════════════════════════════════ */
const T = {
  bg:"#f4f3f0", surface:"#ffffff", dark:"#111827", accent:"#16a34a",
  red:"#dc2626", amber:"#d97706", blue:"#2563eb", muted:"#6b7280",
  border:"#e5e5e5", radius:10, shadow:"0 1px 3px rgba(0,0,0,.08)",
  font:"'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const fmtDate = d => {
  if (!d) return "\u2014";
  const x = new Date(d + (d.length === 10 ? "T12:00:00" : ""));
  return isNaN(x) ? "\u2014" : `${x.getMonth()+1}/${x.getDate()}/${String(x.getFullYear()).slice(2)}`;
};
const money = n => (n == null || isNaN(n) || n === "") ? "\u2014" : "$" + Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const ago = d => {
  if (!d) return 0;
  const ms = Date.now() - new Date(d + (d.length===10?"T12:00:00":"")).getTime();
  return isNaN(ms) ? 0 : Math.floor(ms/86400000);
};
const totals = (svc, tolls, pay, taxRate) => {
  const s = svc||{};
  const svcSum = SVC.reduce((a,i) => a + (parseFloat(s[i.k])||0), 0);
  const tl = parseFloat(tolls)||0;
  const rate = (taxRate==null||taxRate===undefined) ? TAX : parseFloat(taxRate)||0;
  const tax = Math.round(svcSum*rate*100)/100;
  const chargeBase = svcSum + tax + tl;
  const cc = pay==="Credit Card" ? Math.round(chargeBase*CC_FEE*100)/100 : 0;
  const total = Math.round((chargeBase+cc)*100)/100;
  const sub = svcSum + tl;
  return { sub, svcSum, tl, tax, taxRate:rate, cc, total };
};

/* Returns array of missing field labels for a job.
   Paid jobs with receipt = closed, no flags.
   Paid jobs without receipt = just "Receipt".
   Everything else = check all fields. */
const getMissing = (j) => {
  const isPaid = j.status === ST.PAID;
  const hasReceipt = !j.receiptMissing && isPaid;
  // Fully closed job — paid and has receipt
  if (isPaid && hasReceipt) return [];
  // Paid but missing receipt only
  if (isPaid && j.receiptMissing) return ["Receipt"];
  // Paid with price and no receiptMissing flag — assume closed
  if (isPaid && j.price && !isNaN(j.price)) return [];
  // Not paid — check what's actually missing
  const m = [];
  if (!j.price || isNaN(j.price) || parseFloat(j.price) === 0) m.push("Price");
  if (!j.customer?.name) m.push("Customer");
  if (!j.pickup) m.push("Pickup");
  if (!j.dropoff) m.push("Dropoff");
  if (!j.vehicle?.make && !j.vehicle?.model) m.push("Vehicle");
  return m;
};

const freshJob = () => ({
  id:uid(), jobDate:new Date().toISOString().split("T")[0],
  jobTime:new Date().toTimeString().slice(0,5),
  vehicle:{color:"",make:"",model:"",year:"",vin:"",plate:""},
  customer:{name:"",phone:""}, owner:{name:"",homePhone:"",workPhone:""},
  pickup:"",pickupCity:"",dropoff:"",dropoffCity:"",
  services:{}, price:"", paymentType:"Cash", tolls:"",
  poNumber:"",raNumber:"", status:ST.UNPAID, notes:"",
  taxMode:"standard", taxRate:TAX,
  vehiclePhoto:null, registrationPhoto:null, source:"app", title:""
});

/* ════════════════════════════════════════
   DATA LAYER
   ════════════════════════════════════════ */
const CK = "ut-v6";
const cacheJobs = j => { try{localStorage.setItem(CK,JSON.stringify(j))}catch{} };
const loadCached = () => { try{return JSON.parse(localStorage.getItem(CK)||"[]")}catch{return[]} };

function parseRow(row) {
  const id = row[COL.ID] || uid();
  let jd = "";
  if (row[COL.DATE]) try { jd = new Date(row[COL.DATE]).toISOString().split("T")[0]; } catch {}
  let jt = "";
  if (row[COL.TIME]) try {
    const t = new Date(row[COL.TIME]);
    jt = t.getUTCHours().toString().padStart(2,"0")+":"+t.getUTCMinutes().toString().padStart(2,"0");
  } catch { jt = String(row[COL.TIME]).slice(0,5); }

  let svc = {};
  try { svc = JSON.parse(row[COL.SVC]); } catch {}
  let ext = {};
  try { if (String(row[COL.EXT]).startsWith("{")) ext = JSON.parse(row[COL.EXT]); } catch {}
  const st = (row[COL.STATUS]||"").toLowerCase();
  const isM = String(id).startsWith("L") || !!ext.legacyNum;
  const desc = String(row[COL.DESC]||"").trim();
  const price = row[COL.PRICE];

  return {
    id, jobDate:jd, jobTime:jt,
    vehicle: {
      color:row[COL.COLOR]||"", make:row[COL.MAKE]||"", model:row[COL.MODEL]||"",
      year:row[COL.YEAR]||"", vin:row[COL.VIN]||"", plate:row[COL.PLATE]||""
    },
    customer: { name:row[COL.CUST]||"", phone:row[COL.PHONE]||"" },
    owner: ext.owner || {name:"",homePhone:"",workPhone:""},
    pickup:row[COL.PICKUP]||"", pickupCity:ext.pickupCity||"",
    dropoff:row[COL.DROPOFF]||"", dropoffCity:ext.dropoffCity||"",
    services:svc, price:price||"", paymentType:row[COL.PAYMENT]||"Cash",
    tolls:ext.tolls||"", poNumber:ext.poNumber||"", raNumber:ext.raNumber||"",
    taxMode:ext.taxMode||"standard", taxRate:ext.taxRate!=null?ext.taxRate:TAX,
    status: st==="paid"?ST.PAID : (st==="unpaid"?ST.UNPAID : ((!price||price==="")?ST.MISSING:ST.UNPAID)),
    notes: row[COL.NOTES]||"",
    legacyNum: ext.legacyNum||"",
    receiptMissing: ext.receiptMissing||false,
    vehiclePhoto:null, registrationPhoto:null,
    source: isM ? "migrated" : "app",
    title: desc || [row[COL.COLOR],row[COL.MAKE],row[COL.MODEL]].filter(Boolean).join(" ") || (ext.legacyTitle||"")
  };
}

function buildPayload(job, action) {
  const veh = [job.vehicle.color, job.vehicle.make, job.vehicle.model].filter(Boolean).join(" ");
  const desc = job.title || veh || "";
  const ext = JSON.stringify({
    owner:job.owner||{}, pickupCity:job.pickupCity||"", dropoffCity:job.dropoffCity||"",
    tolls:job.tolls||"", poNumber:job.poNumber||"", raNumber:job.raNumber||"",
    legacyNum:job.legacyNum||"", legacyTitle:job.title||"",
    receiptMissing:job.receiptMissing||false,
    taxMode:job.taxMode||"standard", taxRate:job.taxRate!=null?job.taxRate:TAX
  });
  const sv = SVC.reduce((a,i) => a + (parseFloat((job.services||{})[i.k])||0), 0);
  return {
    action, id:job.id, date:job.jobDate||"", time:job.jobTime||"",
    desc: desc,
    customer:job.customer?.name||"", phone:job.customer?.phone||"",
    pickup:job.pickup||"", dropoff:job.dropoff||"",
    color:job.vehicle?.color||"", make:job.vehicle?.make||"",
    model:job.vehicle?.model||"", year:job.vehicle?.year||"",
    plate:job.vehicle?.plate||"",
    price:sv||job.price||"", payment:job.paymentType||"", status:job.status||"",
    notes:job.notes||"", vin:job.vehicle?.vin||"",
    service:JSON.stringify(job.services||{}), ext: ext,
    test:job.isTest||false
  };
}

// Convert a new legacy row from Overview into an App Jobs entry and sync it
function parseLegacyNew(r) {
  const payRaw = String(r.pay||"").trim();
  const rcptRaw = String(r.receipt||"").trim();
  const payUp = payRaw.toUpperCase();
  const rcptLow = rcptRaw.toLowerCase();
  let price = "";
  if (r.payout!=null && r.payout!=="" && r.payout!=="-") {
    const p = parseFloat(r.payout); if (!isNaN(p)&&p>0) price = p;
  }
  const needsPay = payUp.includes("NEEDS TO BE PAID");
  const hasPay = payUp.includes("CASH")||payUp.includes("ZELLE")||payUp.includes("CHECK")||payUp.includes("CREDIT");
  const hasChk = rcptRaw.includes("\u2705")||rcptRaw.includes("\u2611");
  const hasRcpt = rcptLow.includes("receipt in tow");
  let status = ST.MISSING;
  if (!price&&price!==0) status=ST.MISSING;
  else if (needsPay) status=ST.UNPAID;
  else if (hasChk||hasRcpt||hasPay) status=ST.PAID;
  else status=ST.UNPAID;
  let payNorm = "Cash";
  if (payUp.includes("ZELLE")) payNorm="Zelle";
  else if (payUp.includes("CHECK")) payNorm="Check";
  else if (payUp.includes("CREDIT")) payNorm="Credit Card";
  else if (payUp.includes("INSURANCE")) payNorm="Pending Insurance";
  else if (needsPay||payUp.includes("PENDING")) payNorm="Invoice Later";
  else if (payUp.includes("CASH")) payNorm="Cash";
  let cust = "";
  const combo = (String(r.name)+" "+String(r.notes||"")).toLowerCase();
  for (const p of PARTNERS) if (combo.includes(p.toLowerCase())) { cust=p; break; }
  let jd = "";
  if (r.date) try { jd=new Date(r.date).toISOString().split("T")[0]; } catch {}
  const name = String(r.name||"").trim();
  return {
    id:"L"+r.n, jobDate:jd, jobTime:"",
    vehicle:{color:"",make:"",model:"",year:"",vin:"",plate:""},
    customer:{name:cust,phone:""}, owner:{name:"",homePhone:"",workPhone:""},
    pickup:"",pickupCity:"",dropoff:"",dropoffCity:"",
    services:price?{towing:price}:{}, price, paymentType:payNorm, tolls:"",
    poNumber:"",raNumber:"", status, notes:String(r.notes||""),
    legacyNum:String(r.n), receiptMissing:rcptLow.includes("missing receipt"),
    vehiclePhoto:null, registrationPhoto:null, source:"migrated",
    title:name
  };
}

async function fetchAll() {
  try {
    const r = await fetch("/api/sync");
    const d = await r.json();
    const appJobs = (d.jobs||[]).map(parseRow);

    // Auto-import any new rows from Overview that aren't in App Jobs yet
    const newLegacy = d.newLegacy || [];
    if (newLegacy.length > 0) {
      console.log(`Auto-importing ${newLegacy.length} new jobs from Overview`);
      const imported = [];
      for (const row of newLegacy) {
        const job = parseLegacyNew(row);
        const ok = await syncJob(job, "add");
        if (ok) imported.push(job);
      }
      return [...appJobs, ...imported];
    }
    return appJobs;
  } catch (e) { console.error(e); return null; }
}

async function syncJob(job, action="add") {
  try {
    const r = await fetch("/api/sync", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(buildPayload(job, action))
    });
    return await r.json();
  } catch (e) { console.error(e); return null; }
}

/* ════════════════════════════════════════
   PDF
   ════════════════════════════════════════ */
async function makePDF(job) {
  if (!window.jspdf) {
    await new Promise((ok,no) => {
      const s = document.createElement("script");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload=ok; s.onerror=no; document.head.appendChild(s);
    });
  }
  const{jsPDF}=window.jspdf; const doc=new jsPDF({unit:"pt",format:"letter"});
  const w=612,m=36,pw=w-72; let y=m;
  const dk=[26,26,46],bl=[26,10,110],wt=[255,255,255];
  const svc=job.services||{}; const tl=parseFloat(job.tolls)||0;
  const sv=SVC.reduce((a,i)=>a+(parseFloat(svc[i.k])||0),0);
  const pdfTaxRate=job.taxMode==="exempt"?0:(job.taxRate!=null?parseFloat(job.taxRate):TAX);
  const sub=sv+tl, tax=Math.round(sv*pdfTaxRate*100)/100;
  const chargeBase=sv+tax+tl;
  const cc=job.paymentType==="Credit Card"?Math.round(chargeBase*CC_FEE*100)/100:0;
  const tot=Math.round((chargeBase+cc)*100)/100;
  const bx=(x,by,bw,bh,lb,vl,vs)=>{vs=vs||10;doc.setDrawColor(51);doc.setLineWidth(.5);doc.rect(x,by,bw,bh);doc.setFontSize(6);doc.setFont("helvetica","normal");doc.setTextColor(...dk);doc.text(lb,x+3,by+8);if(vl){doc.setFontSize(vs);doc.setFont("helvetica","bold");doc.setTextColor(...bl);doc.text(String(vl),x+4,by+bh-4);doc.setTextColor(...dk)}};
  const ck=(x,cy,on)=>{doc.rect(x,cy,9,9);if(on){doc.setFontSize(7);doc.setFont("helvetica","bold");doc.text("X",x+2,cy+7.5)}};
  doc.setFillColor(...dk);doc.rect(m,y,pw,32,"F");doc.setTextColor(...wt);doc.setFontSize(22);doc.setFont("helvetica","bold");doc.text("24 HOUR TOWING",w/2,y+24,{align:"center"});y+=38;
  doc.setTextColor(...dk);doc.setFontSize(20);doc.text("UNITED",w/2,y+14,{align:"center"});y+=18;
  doc.setFontSize(9);doc.setFont("helvetica","normal");doc.text("TOWING & TRANSPORT",w/2,y+9,{align:"center"});y+=14;
  doc.setFontSize(8);doc.text('"Local & Long Distance"     "Flatbed Specialists"',w/2,y+8,{align:"center"});y+=12;
  doc.setFontSize(7);doc.text("Towing \u2022 Emergency Starting \u2022 Battery Service \u2022 Flat Tire Service",w/2,y+7,{align:"center"});y+=9;
  doc.text("Vehicle Locksmith Services \u2022 Unauthorized Tows \u2022 Fuel Delivery",w/2,y+7,{align:"center"});y+=14;
  doc.setFillColor(232,232,224);doc.rect(m,y,pw,24,"FD");doc.setTextColor(...dk);doc.setFontSize(16);doc.setFont("helvetica","bold");doc.text("914-500-5570",w/2,y+18,{align:"center"});y+=25;
  const rh=26,dw=pw*.6,tw=pw*.4;
  const ts=job.jobTime||"";const hr=parseInt(ts.split(":")[0]||"12");const ap=hr>=12?"PM":"AM";
  const dh=hr>12?hr-12:(hr===0?12:hr);const dt=dh+":"+(ts.split(":")[1]||"00");
  const ds=job.jobDate?new Date(job.jobDate+"T12:00:00").toLocaleDateString("en-US"):"";
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
  const rw2=pw*.52,sw2=pw*.48,sx=m+rw2,hh=16,sr=19,bh2=sr*12;
  doc.rect(m,y,rw2,hh);doc.setFontSize(10);doc.setFont("helvetica","bold");doc.text("REMARKS",m+rw2/2,y+12,{align:"center"});
  doc.rect(m,y+hh,rw2,bh2);if(job.notes){doc.setFontSize(10);doc.setFont("helvetica","bold");doc.setTextColor(...bl);doc.text(job.notes,m+8,y+hh+14);doc.setTextColor(...dk)}
  const pay=job.paymentType||"";if(pay){doc.setFontSize(10);doc.setFont("helvetica","bold");doc.setTextColor(...bl);doc.text("PAID "+pay.toUpperCase(),m+8,y+hh+bh2-8);doc.setTextColor(...dk)}
  doc.rect(sx,y,sw2,hh);doc.setFontSize(10);doc.setFont("helvetica","bold");doc.text("SERVICES PERFORMED",sx+sw2/2,y+12,{align:"center"});
  const pdfR=[["TOWING","towing"],["WAITING TIME","waiting"],["WINCH","winch"],["ROAD SERVICE","road_service"],["GATE FEE","gate_fee"],["ADMIN FEE","admin_fee"],["STORAGE","storage"],["SUBTOTAL","_s"],["TAX","_t"],["TOLLS","_tl"],["CC PROCESS FEE (4.5%)","_c"],["TOTAL DUE","_tot"]];
  let sy=y+hh;pdfR.forEach(r=>{doc.setDrawColor(51);doc.setLineWidth(.5);doc.rect(sx,sy,sw2,sr);let v="";
    if(r[1]==="_s")v=sub>0?sub.toFixed(2):"";else if(r[1]==="_t")v=tax>0?tax.toFixed(2):"";else if(r[1]==="_tl")v=tl>0?tl.toFixed(2):"";else if(r[1]==="_c")v=cc>0?cc.toFixed(2):"";else if(r[1]==="_tot")v=tot>0?tot.toFixed(2):"";else{const sv2=parseFloat(svc[r[1]])||0;if(sv2>0)v=sv2.toFixed(2)}
    ck(sx+5,sy+5,!!v);const it=r[0]==="TOTAL DUE";doc.setFontSize(8);doc.setFont("helvetica",it?"bold":"normal");doc.setTextColor(...dk);doc.text(r[0],sx+20,sy+sr-6);
    if(v){doc.setFontSize(it?11:10);doc.setFont("helvetica","bold");doc.setTextColor(...bl);doc.text(v,sx+sw2-6,sy+sr-5,{align:"right"});doc.setTextColor(...dk)}sy+=sr});
  y+=hh+bh2+3;
  const lw=pw*.52,rw3=pw*.48,blh=52;doc.rect(m,y,lw,blh);doc.setFontSize(9);doc.setFont("helvetica","bold");doc.text("DAMAGE WAIVER",m+lw/2,y+12,{align:"center"});
  doc.setFontSize(5.5);doc.setFont("helvetica","normal");
  ["I acknowledge towing or servicing the above referenced vehicle may result","in damage or loss, including loss or theft of personal items. I assume","full responsibility and release United Towing & Transport LLC and it's","representatives from any liability."].forEach((l,i)=>doc.text(l,m+4,y+22+i*7));
  doc.rect(m+lw,y,rw3,blh);doc.setFontSize(8);let py2=y+14;
  ["CASH","CK#","CHARGE ACCOUNT"].forEach(pm=>{ck(m+lw+8,py2-3,pay.toUpperCase()===pm.split("#")[0].trim());doc.setFont("helvetica","normal");doc.text(pm,m+lw+20,py2+4);py2+=12});
  y+=blh+2;
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

/* ════════════════════════════════════════
   SHARED UI
   ════════════════════════════════════════ */
const inp = {width:"100%",padding:"11px 12px",fontSize:15,borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface,boxSizing:"border-box",fontFamily:T.font,outline:"none"};
const lbl = {fontSize:11,fontWeight:600,color:T.muted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.5};
const btnP = {padding:"12px 20px",borderRadius:10,border:"none",cursor:"pointer",fontSize:15,fontWeight:600,background:T.dark,color:"#fff",width:"100%"};
const btnS = {...btnP,background:T.bg,color:T.dark,border:`1.5px solid ${T.border}`};

function Section({title,children,style:s}){return(<div style={{background:T.bg,borderRadius:10,padding:"14px 16px",marginBottom:14,...s}}>{title&&<div style={{fontSize:13,fontWeight:700,color:T.dark,marginBottom:10}}>{title}</div>}{children}</div>)}
function Photo({label,icon,value,onChange}){const ref=useRef(null);const[prev,setPrev]=useState(value);return(<div><div style={lbl}>{label}</div>{prev?<div style={{position:"relative",borderRadius:8,overflow:"hidden",border:`1.5px solid ${T.border}`}}><img src={prev} alt={label} style={{width:"100%",height:100,objectFit:"cover",display:"block"}} /><button onClick={e=>{e.stopPropagation();setPrev(null);onChange(null);if(ref.current)ref.current.value=""}} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,.6)",color:"#fff",border:"none",borderRadius:"50%",width:24,height:24,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>&times;</button></div>:<div onClick={()=>ref.current?.click()} style={{border:`1.5px dashed ${T.border}`,borderRadius:8,padding:"18px 8px",textAlign:"center",color:T.muted,fontSize:11,cursor:"pointer",background:T.surface}}><div style={{fontSize:20,marginBottom:2}}>{icon}</div>Tap</div>}<input ref={ref} type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files[0];if(!f)return;const r2=new FileReader();r2.onloadend=()=>{setPrev(r2.result);onChange(r2.result)};r2.readAsDataURL(f)}} style={{display:"none"}} /></div>)}

function SvcPricing({services,onChange}){const s=services||{};return(<div style={{display:"grid",gap:2}}>{SVC.map(i=>{const v=s[i.k]||"";const on=parseFloat(v)>0;return(<div key={i.k} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0"}}><div style={{flex:1,fontSize:14,fontWeight:on?600:400,color:on?T.dark:T.muted}}>{i.l}</div><input value={v} onChange={e=>onChange({...s,[i.k]:e.target.value})} placeholder="$0" type="number" inputMode="decimal" style={{width:90,padding:"8px 10px",fontSize:15,borderRadius:8,fontWeight:on?700:400,border:`1.5px solid ${on?T.accent:T.border}`,background:on?"#f0fdf4":T.surface,textAlign:"right",boxSizing:"border-box",fontFamily:T.font,outline:"none"}} /></div>)})}</div>)}

function StatusToggle({status,onChange}){return(<div style={{display:"flex",borderRadius:10,overflow:"hidden",border:`1.5px solid ${T.border}`}}>{[{v:ST.PAID,l:"Paid",c:T.accent},{v:ST.UNPAID,l:"Unpaid",c:T.red},{v:ST.MISSING,l:"Missing info",c:T.amber}].map((o,i)=>(<div key={o.v} onClick={()=>onChange(o.v)} style={{flex:1,padding:"12px 0",textAlign:"center",fontSize:13,fontWeight:600,cursor:"pointer",background:status===o.v?o.c:T.surface,color:status===o.v?"#fff":T.muted,borderLeft:i>0?`1px solid ${T.border}`:"none"}}>{o.l}</div>))}</div>)}

function TaxToggle({taxMode,taxRate,onChange}){
  const mode=taxMode||"standard";
  const rate=taxRate!=null?taxRate:TAX;
  const set=(m,r)=>onChange(m,r);
  return(<div>
    <div style={{display:"flex",borderRadius:10,overflow:"hidden",border:`1.5px solid ${T.border}`,marginBottom:mode==="custom"?8:0}}>
      {[{v:"standard",l:`Tax ${(TAX*100).toFixed(3)}%`,c:T.accent},{v:"exempt",l:"Tax Exempt",c:T.muted},{v:"custom",l:"Custom Rate",c:T.blue}].map((o,i)=>(
        <div key={o.v} onClick={()=>{if(o.v==="standard")set("standard",TAX);else if(o.v==="exempt")set("exempt",0);else set("custom",rate||TAX)}} style={{flex:1,padding:"10px 0",textAlign:"center",fontSize:12,fontWeight:600,cursor:"pointer",background:mode===o.v?o.c:T.surface,color:mode===o.v?"#fff":T.muted,borderLeft:i>0?`1px solid ${T.border}`:"none"}}>{o.l}</div>
      ))}
    </div>
    {mode==="custom"&&<div style={{display:"flex",alignItems:"center",gap:8}}>
      <input value={rate?Math.round(rate*10000)/100:""} onChange={e=>{const v=parseFloat(e.target.value);set("custom",isNaN(v)?0:v/100)}} placeholder="8.375" type="number" inputMode="decimal" step="0.001" style={{...inp,flex:1,fontSize:14}} />
      <span style={{fontSize:13,color:T.muted,fontWeight:600}}>%</span>
    </div>}
  </div>);
}

/* ════════════════════════════════════════
   LOGIN
   ════════════════════════════════════════ */
function Login({onAuth}){const[pin,setPin]=useState("");const[err,setErr]=useState(false);const go=()=>{if(pin.toLowerCase()===PIN){localStorage.setItem("ut-auth","1");onAuth()}else{setErr(true);setTimeout(()=>setErr(false),2000)}};return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.dark,fontFamily:T.font}}><div onKeyDown={e=>e.key==="Enter"&&go()} style={{textAlign:"center",padding:40,width:280}}><div style={{fontSize:28,fontWeight:800,color:"#fff",letterSpacing:"-.5px"}}>United Towing</div><div style={{fontSize:13,color:"#666",marginTop:4,marginBottom:28}}>& Transport LLC</div><input value={pin} onChange={e=>{setPin(e.target.value);setErr(false)}} type="password" placeholder="Access code" autoFocus style={{...inp,background:"#1f2937",border:err?"2px solid #dc2626":"2px solid #374151",color:"#fff",textAlign:"center",fontSize:18,letterSpacing:4,marginBottom:14}} /><button onClick={go} style={{...btnP,background:"#fff",color:T.dark}}>Enter</button>{err&&<div style={{color:"#dc2626",fontSize:13,marginTop:12}}>Wrong code</div>}</div></div>)}

/* ════════════════════════════════════════
   CAPTURE FORM
   ════════════════════════════════════════ */
function Capture({onSubmit,onCancel}){
  const[j,setJ]=useState(freshJob());const[cc,setCC]=useState(false);
  const[done,setDone]=useState(false);const[busy,setBusy]=useState(false);
  const[test,setTest]=useState(false);const[more,setMore]=useState(false);
  const u=(p,v)=>setJ(prev=>{const c2=JSON.parse(JSON.stringify(prev));const k=p.split(".");let r=c2;for(let i=0;i<k.length-1;i++)r=r[k[i]];r[k[k.length-1]]=v;return c2});
  const{sub,tax,cc:ccFee,total,svcSum,tl,taxRate:effRate}=totals(j.services,j.tolls,j.paymentType,j.taxMode==="exempt"?0:j.taxRate);
  const go=async()=>{if(!j.customer.name&&!cc)return;const f={...j,price:svcSum||j.price,isTest:test};if(!svcSum&&(!f.price||isNaN(f.price)))f.status=ST.MISSING;setBusy(true);await syncJob(f,"add");if(!test)onSubmit(f);setBusy(false);setDone(true);setTimeout(()=>{setDone(false);setJ(freshJob());setCC(false)},1500)};
  if(done)return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.bg,fontFamily:T.font}}><div style={{textAlign:"center"}}><div style={{fontSize:52,marginBottom:12}}>{test?"\uD83E\uDDEA":"\u2713"}</div><div style={{fontSize:22,fontWeight:700,color:T.dark}}>{test?"Test sent":"Job logged"}</div><div style={{fontSize:14,color:T.muted,marginTop:6}}>{test?"Test tab only":"Synced to Sheets"}</div></div></div>);
  return(
    <div style={{minHeight:"100vh",background:test?"#fff7ed":T.bg,fontFamily:T.font}}>
      <div style={{background:test?"#c2410c":T.dark,color:"#fff",padding:"16px 20px",textAlign:"center"}}>
        <div style={{fontSize:18,fontWeight:700}}>Log new job</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:2}}>{test?"Test mode":new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</div>
      </div>
      <div style={{padding:"16px 20px",maxWidth:480,margin:"0 auto"}}>
        <div onClick={()=>setTest(!test)} style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,padding:"10px 14px",borderRadius:10,background:test?"#fff7ed":T.surface,border:`1.5px solid ${test?"#c2410c":T.border}`,cursor:"pointer"}}><div style={{width:44,height:24,borderRadius:12,background:test?"#c2410c":"#d1d5db",position:"relative"}}><div style={{width:20,height:20,borderRadius:10,background:"#fff",position:"absolute",top:2,left:test?22:2,transition:"all .2s"}} /></div><span style={{fontSize:13,fontWeight:600,color:test?"#c2410c":T.muted}}>Test mode {test?"ON":"off"}</span></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}><div><label style={lbl}>Date</label><input type="date" value={j.jobDate} onChange={e=>u("jobDate",e.target.value)} style={inp} /></div><div><label style={lbl}>Time</label><input type="time" value={j.jobTime} onChange={e=>u("jobTime",e.target.value)} style={inp} /></div></div>
        <div style={{marginBottom:14}}><label style={lbl}>Customer</label>{!cc?<select value={j.customer.name} onChange={e=>{if(e.target.value==="__new__"){setCC(true);u("customer.name","")}else u("customer.name",e.target.value)}} style={{...inp,appearance:"auto"}}><option value="">Select partner...</option>{PARTNERS.map(p=><option key={p}>{p}</option>)}<option value="__new__">+ New customer</option></select>:<div style={{display:"flex",gap:8}}><input value={j.customer.name} onChange={e=>u("customer.name",e.target.value)} placeholder="Name" style={{...inp,flex:1}} /><button onClick={()=>{setCC(false);u("customer.name","")}} style={{...btnS,width:"auto",padding:"10px 14px",fontSize:13}}>Back</button></div>}</div>
        <div style={{marginBottom:14}}><label style={lbl}>Phone</label><input value={j.customer.phone} onChange={e=>u("customer.phone",e.target.value)} placeholder="914-555-1234" type="tel" style={inp} /></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>{[["Color","vehicle.color","White"],["Make","vehicle.make","Ford"],["Model","vehicle.model","E350"]].map(([l2,p,ph])=><div key={p}><label style={lbl}>{l2}</label><input value={p.split(".").reduce((o,k)=>o[k],j)} onChange={e=>u(p,e.target.value)} placeholder={ph} style={inp} /></div>)}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}><div><label style={lbl}>Year</label><input value={j.vehicle.year} onChange={e=>u("vehicle.year",e.target.value)} placeholder="2021" inputMode="numeric" style={inp} /></div><div><label style={lbl}>VIN</label><input value={j.vehicle.vin} onChange={e=>u("vehicle.vin",e.target.value)} placeholder="VIN" style={inp} /></div><div><label style={lbl}>Plate</label><input value={j.vehicle.plate} onChange={e=>u("vehicle.plate",e.target.value)} placeholder="ABC 1234" style={inp} /></div></div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginBottom:8}}><div><label style={lbl}>Pickup</label><input value={j.pickup} onChange={e=>u("pickup",e.target.value)} placeholder="123 Main St" style={inp} /></div><div><label style={lbl}>City</label><input value={j.pickupCity} onChange={e=>u("pickupCity",e.target.value)} placeholder="Yonkers" style={inp} /></div></div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginBottom:16}}><div><label style={lbl}>Dropoff</label><input value={j.dropoff} onChange={e=>u("dropoff",e.target.value)} placeholder="JC Auto" style={inp} /></div><div><label style={lbl}>City</label><input value={j.dropoffCity} onChange={e=>u("dropoffCity",e.target.value)} placeholder="Scarsdale" style={inp} /></div></div>
        <Section title="Services & pricing"><SvcPricing services={j.services} onChange={s=>setJ(p=>({...p,services:s}))} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}><div><label style={lbl}>Tolls</label><input value={j.tolls} onChange={e=>u("tolls",e.target.value)} placeholder="$0" type="number" inputMode="decimal" style={inp} /></div><div><label style={lbl}>Payment</label><select value={j.paymentType} onChange={e=>u("paymentType",e.target.value)} style={{...inp,appearance:"auto"}}>{PAY.map(p=><option key={p}>{p}</option>)}</select></div></div>
          <div style={{marginTop:12}}><label style={lbl}>Tax</label><TaxToggle taxMode={j.taxMode} taxRate={j.taxRate} onChange={(m,r)=>setJ(p=>({...p,taxMode:m,taxRate:r}))} /></div>
          {total>0&&<div style={{borderTop:`1px solid ${T.border}`,marginTop:12,paddingTop:10,fontSize:14}}><div style={{display:"flex",justifyContent:"space-between",color:T.muted,marginBottom:3}}><span>Services</span><span>{money(svcSum)}</span></div>{tl>0&&<div style={{display:"flex",justifyContent:"space-between",color:T.muted,marginBottom:3}}><span>Tolls</span><span>{money(tl)}</span></div>}{tax>0&&<div style={{display:"flex",justifyContent:"space-between",color:T.muted,marginBottom:3}}><span>Tax ({(effRate*100).toFixed(3)}%)</span><span>{money(tax)}</span></div>}{j.taxMode==="exempt"&&svcSum>0&&<div style={{display:"flex",justifyContent:"space-between",color:T.accent,marginBottom:3,fontSize:12}}><span>Tax exempt</span><span>$0.00</span></div>}{ccFee>0&&<div style={{display:"flex",justifyContent:"space-between",color:T.muted,marginBottom:3}}><span>CC fee (4.5%)</span><span>{money(ccFee)}</span></div>}<div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:18,color:T.dark,marginTop:6}}><span>Total</span><span>{money(total)}</span></div></div>}</Section>
        <div style={{marginBottom:16}}><label style={lbl}>Status</label><StatusToggle status={j.status} onChange={v=>u("status",v)} /></div>
        <div onClick={()=>setMore(!more)} style={{textAlign:"center",padding:"8px 0",fontSize:13,fontWeight:600,color:T.blue,cursor:"pointer",marginBottom:more?8:16}}>{more?"\u25B2 Hide optional":"\u25BC Owner, PO#, photos"}</div>
        {more&&<><Section title="Owner (if different)"><div style={{marginBottom:8}}><label style={lbl}>Name</label><input value={j.owner.name} onChange={e=>u("owner.name",e.target.value)} style={inp} /></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><label style={lbl}>Home</label><input value={j.owner.homePhone} onChange={e=>u("owner.homePhone",e.target.value)} type="tel" style={inp} /></div><div><label style={lbl}>Work</label><input value={j.owner.workPhone} onChange={e=>u("owner.workPhone",e.target.value)} type="tel" style={inp} /></div></div></Section>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}><div><label style={lbl}>PO #</label><input value={j.poNumber} onChange={e=>u("poNumber",e.target.value)} style={inp} /></div><div><label style={lbl}>RA #</label><input value={j.raNumber} onChange={e=>u("raNumber",e.target.value)} style={inp} /></div></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}><Photo label="Vehicle" icon="\uD83D\uDCF7" value={j.vehiclePhoto} onChange={v=>setJ(p=>({...p,vehiclePhoto:v}))} /><Photo label="Registration" icon="\uD83D\uDCC4" value={j.registrationPhoto} onChange={v=>setJ(p=>({...p,registrationPhoto:v}))} /></div></>}
        <div style={{marginBottom:20}}><label style={lbl}>Notes</label><input value={j.notes} onChange={e=>u("notes",e.target.value)} placeholder="AAA referral, etc." style={inp} /></div>
        <button onClick={go} disabled={busy} style={{...btnP,background:busy?"#888":(test?"#c2410c":T.dark),opacity:busy?.7:1,fontSize:16,padding:14}}>{busy?"Syncing...":(test?"\uD83E\uDDEA Test":"Log job")}</button>
        <div style={{textAlign:"center",fontSize:11,color:T.muted,marginTop:8}}>{test?"Test tab only":"Syncs to Sheets"}</div>
        {onCancel&&<button onClick={onCancel} style={{...btnS,marginTop:8}}>Back to dashboard</button>}
      </div>
    </div>);
}

/* ════════════════════════════════════════
   EDIT PANEL
   ════════════════════════════════════════ */
function EditPanel({job,onSave,onClose}){
  const isM=job.source==="migrated";
  const[j,setJ]=useState(JSON.parse(JSON.stringify(job)));
  const[busy,setBusy]=useState(false);const[msg,setMsg]=useState("");const[pdfing,setPdfing]=useState(false);const[more,setMore]=useState(false);
  const u=(p,v)=>setJ(prev=>{const c2=JSON.parse(JSON.stringify(prev));const k=p.split(".");let r=c2;for(let i=0;i<k.length-1;i++)r=r[k[i]];r[k[k.length-1]]=v;return c2});
  const{sub,tax,cc,total,svcSum,tl,taxRate:effRate}=totals(j.services,j.tolls,j.paymentType,j.taxMode==="exempt"?0:j.taxRate);
  const save=async()=>{setBusy(true);const saved={...j,price:svcSum||j.price};await syncJob(saved,"update");onSave(saved);setMsg("Saved");setBusy(false);setTimeout(()=>setMsg(""),2000)};
  const pdf=async()=>{setPdfing(true);try{await makePDF(j)}catch{alert("PDF error")}setPdfing(false)};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:12,fontFamily:T.font}}>
      <div style={{background:T.surface,borderRadius:14,width:"100%",maxWidth:560,maxHeight:"92vh",overflow:"auto",padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div><div style={{fontSize:18,fontWeight:700,color:T.dark}}>{isM?`Job #${job.legacyNum}`:"Edit job"}</div>{isM&&<div style={{fontSize:12,color:T.muted,marginTop:3}}>Migrated — edits save directly</div>}</div>
          <button onClick={onClose} style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface,color:T.dark,fontSize:12,fontWeight:600,cursor:"pointer"}}>Close</button>
        </div>
        {isM&&job.title&&<div style={{background:"#eff6ff",borderRadius:10,padding:14,marginBottom:16,fontSize:13,lineHeight:1.7}}><div style={{color:T.muted}}>Original: {job.title}</div><div style={{color:T.muted}}>Migrated price: {job.price?money(job.price):"\u2014"} &middot; Payment: {job.paymentType||"\u2014"}</div></div>}
        <div style={{marginBottom:14}}><label style={lbl}>Description</label><input value={j.title||""} onChange={e=>setJ(p=>({...p,title:e.target.value}))} placeholder="e.g. Gray Tesla from Bronx to JC Auto" style={inp} /></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}><div><label style={lbl}>Date</label><input type="date" value={j.jobDate} onChange={e=>u("jobDate",e.target.value)} style={inp} /></div><div><label style={lbl}>Time</label><input type="time" value={j.jobTime} onChange={e=>u("jobTime",e.target.value)} style={inp} /></div></div>
        <Section title="Customer"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><label style={lbl}>Name</label><input value={j.customer.name} onChange={e=>u("customer.name",e.target.value)} style={inp} /></div><div><label style={lbl}>Phone</label><input value={j.customer.phone} onChange={e=>u("customer.phone",e.target.value)} style={inp} /></div></div></Section>
        <Section title="Vehicle"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:8}}>{[["Year","vehicle.year"],["Color","vehicle.color"],["Make","vehicle.make"],["Model","vehicle.model"]].map(([l2,p])=><div key={p}><label style={lbl}>{l2}</label><input value={p.split(".").reduce((o,k)=>o[k],j)} onChange={e=>u(p,e.target.value)} style={inp} /></div>)}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><label style={lbl}>VIN</label><input value={j.vehicle.vin} onChange={e=>u("vehicle.vin",e.target.value)} style={inp} /></div><div><label style={lbl}>Plate</label><input value={j.vehicle.plate} onChange={e=>u("vehicle.plate",e.target.value)} style={inp} /></div></div></Section>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginBottom:8}}><div><label style={lbl}>Pickup</label><input value={j.pickup} onChange={e=>u("pickup",e.target.value)} style={inp} /></div><div><label style={lbl}>City</label><input value={j.pickupCity} onChange={e=>u("pickupCity",e.target.value)} style={inp} /></div></div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginBottom:14}}><div><label style={lbl}>Dropoff</label><input value={j.dropoff} onChange={e=>u("dropoff",e.target.value)} style={inp} /></div><div><label style={lbl}>City</label><input value={j.dropoffCity} onChange={e=>u("dropoffCity",e.target.value)} style={inp} /></div></div>
        <Section title="Services & pricing"><SvcPricing services={j.services} onChange={s=>setJ(p=>({...p,services:s}))} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}><div><label style={lbl}>Tolls</label><input value={j.tolls} onChange={e=>u("tolls",e.target.value)} type="number" placeholder="0" style={inp} /></div><div><label style={lbl}>Payment</label><select value={j.paymentType} onChange={e=>u("paymentType",e.target.value)} style={{...inp,appearance:"auto"}}>{PAY.map(p=><option key={p}>{p}</option>)}</select></div></div>
          <div style={{marginTop:12}}><label style={lbl}>Tax</label><TaxToggle taxMode={j.taxMode} taxRate={j.taxRate} onChange={(m,r)=>setJ(p=>({...p,taxMode:m,taxRate:r}))} /></div>
          {svcSum>0&&<div style={{borderTop:`1px solid ${T.border}`,marginTop:12,paddingTop:10,fontSize:14}}><div style={{display:"flex",justifyContent:"space-between",color:T.muted}}><span>Services</span><span>{money(svcSum)}</span></div>{tl>0&&<div style={{display:"flex",justifyContent:"space-between",color:T.muted}}><span>Tolls</span><span>{money(tl)}</span></div>}{tax>0&&<div style={{display:"flex",justifyContent:"space-between",color:T.muted}}><span>Tax ({(effRate*100).toFixed(3)}%)</span><span>{money(tax)}</span></div>}{j.taxMode==="exempt"&&svcSum>0&&<div style={{display:"flex",justifyContent:"space-between",color:T.accent,fontSize:12}}><span>Tax exempt</span><span>$0.00</span></div>}{cc>0&&<div style={{display:"flex",justifyContent:"space-between",color:T.muted}}><span>CC fee (4.5%)</span><span>{money(cc)}</span></div>}<div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:18,color:T.dark,marginTop:6}}><span>Total</span><span>{money(total)}</span></div></div>}</Section>
        <div onClick={()=>setMore(!more)} style={{textAlign:"center",padding:"6px 0",fontSize:12,fontWeight:600,color:T.blue,cursor:"pointer",marginBottom:more?8:12}}>{more?"\u25B2 Less":"\u25BC Owner, PO#, photos"}</div>
        {more&&<><Section title="Owner / references"><div style={{marginBottom:8}}><label style={lbl}>Owner</label><input value={(j.owner||{}).name||""} onChange={e=>u("owner.name",e.target.value)} style={inp} /></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><div><label style={lbl}>Home</label><input value={(j.owner||{}).homePhone||""} onChange={e=>u("owner.homePhone",e.target.value)} style={inp} /></div><div><label style={lbl}>Work</label><input value={(j.owner||{}).workPhone||""} onChange={e=>u("owner.workPhone",e.target.value)} style={inp} /></div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><label style={lbl}>PO #</label><input value={j.poNumber||""} onChange={e=>u("poNumber",e.target.value)} style={inp} /></div><div><label style={lbl}>RA #</label><input value={j.raNumber||""} onChange={e=>u("raNumber",e.target.value)} style={inp} /></div></div></Section>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}><Photo label="Vehicle" icon="\uD83D\uDCF7" value={j.vehiclePhoto} onChange={v=>setJ(p=>({...p,vehiclePhoto:v}))} /><Photo label="Registration" icon="\uD83D\uDCC4" value={j.registrationPhoto} onChange={v=>setJ(p=>({...p,registrationPhoto:v}))} /></div></>}
        <div style={{marginBottom:14}}><label style={lbl}>Notes</label><textarea value={j.notes} onChange={e=>u("notes",e.target.value)} rows={2} style={{...inp,resize:"vertical"}} /></div>
        <div style={{marginBottom:16}}><StatusToggle status={j.status} onChange={v=>u("status",v)} /></div>
        <button onClick={save} disabled={busy} style={{...btnP,opacity:busy?.7:1,marginBottom:8}}>{busy?"Saving...":"Save changes"}</button>
        {msg&&<div style={{textAlign:"center",fontSize:13,color:T.accent,fontWeight:600,marginBottom:8}}>{msg}</div>}
        <button onClick={pdf} disabled={pdfing} style={{...btnP,background:pdfing?"#888":"#92400e"}}>{pdfing?"Generating...":"Generate Invoice PDF"}</button>
      </div></div>);
}

/* ════════════════════════════════════════
   DASHBOARD
   ════════════════════════════════════════ */
function MissingPills({job}){
  const m=getMissing(job);
  if(m.length===0)return null;
  return(<div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:3}}>{m.map(f=>{
    const isReceipt=f==="Receipt";
    return <span key={f} style={{padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600,background:isReceipt?"#eff6ff":"#fef3c7",color:isReceipt?"#1e40af":"#92400e",whiteSpace:"nowrap"}}>No {f.toLowerCase()}</span>;
  })}</div>);
}

function Dashboard({jobs,setJobs,onNew,onOut,loading,refresh}){
  const[edit,setEdit]=useState(null);const[filt,setFilt]=useState("action");
  const[q,setQ]=useState("");const[src,setSrc]=useState("all");const[show,setShow]=useState(50);
  let pool=jobs;if(src==="app")pool=jobs.filter(j=>j.source==="app");else if(src==="migrated")pool=jobs.filter(j=>j.source==="migrated");
  const unpaid=pool.filter(j=>j.status!==ST.PAID&&j.price&&!isNaN(j.price));
  const missing=pool.filter(j=>!j.price||isNaN(j.price));
  const paid=pool.filter(j=>j.status===ST.PAID);
  const needsInfo=pool.filter(j=>getMissing(j).length>0);
  const colAmt=paid.reduce((a,j)=>a+(parseFloat(j.price)||0),0);
  const unpAmt=unpaid.reduce((a,j)=>a+(parseFloat(j.price)||0),0);
  const aging={"0-30":0,"30-60":0,"60-90":0,"90+":0};
  unpaid.forEach(j=>{const d=ago(j.jobDate);if(d<=30)aging["0-30"]++;else if(d<=60)aging["30-60"]++;else if(d<=90)aging["60-90"]++;else aging["90+"]++});
  const maxA=Math.max(...Object.values(aging),1);
  const ar={};unpaid.forEach(j=>{const n=j.customer.name;if(!n)return;if(!ar[n])ar[n]={n2:0,t:0,old:j.jobDate};ar[n].n2++;ar[n].t+=parseFloat(j.price)||0;if(j.jobDate&&j.jobDate<(ar[n].old||"9"))ar[n].old=j.jobDate});
  const arList=Object.entries(ar).sort((a,b)=>b[1].t-a[1].t);
  const oneOff=unpaid.filter(j=>!j.customer.name);const oneOffAmt=oneOff.reduce((a,j)=>a+(parseFloat(j.price)||0),0);

  /* Count what's missing across all incomplete jobs */
  const missingBreakdown={Price:0,Customer:0,Pickup:0,Dropoff:0,Vehicle:0,Receipt:0};
  needsInfo.forEach(j=>getMissing(j).forEach(f=>{if(missingBreakdown[f]!==undefined)missingBreakdown[f]++}));

  let list=pool;if(filt==="action")list=pool.filter(j=>j.status!==ST.PAID);else if(filt==="unpaid")list=unpaid;else if(filt==="missing")list=missing;else if(filt==="needs_info")list=needsInfo;else if(filt==="paid")list=paid;
  if(q){const s=q.toLowerCase();list=list.filter(j=>(j.customer.name||"").toLowerCase().includes(s)||(j.title||"").toLowerCase().includes(s)||(j.vehicle.make||"").toLowerCase().includes(s)||(j.vehicle.model||"").toLowerCase().includes(s)||(j.notes||"").toLowerCase().includes(s)||(j.pickup||"").toLowerCase().includes(s)||(j.dropoff||"").toLowerCase().includes(s))}
  list=[...list].sort((a,b)=>(b.jobDate||"").localeCompare(a.jobDate||""));
  const legN=jobs.filter(j=>j.source==="migrated").length;const appN=jobs.filter(j=>j.source==="app").length;
  const handleSave=saved=>{setJobs(prev=>{const next=prev.map(j=>j.id===saved.id?saved:j);if(!prev.find(j=>j.id===saved.id))next.push(saved);cacheJobs(next);return next});setEdit(null)};
  return(
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:T.font}}>
      <div style={{background:T.dark,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:17,fontWeight:700,color:"#fff"}}>United Towing</div><div style={{fontSize:11,color:"#666"}}>{loading?"Loading...":jobs.length+" jobs"}</div></div>
        <div style={{display:"flex",gap:8}}><button onClick={refresh} style={{padding:"8px 12px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(255,255,255,.1)",color:"#fff",fontSize:14}}>{loading?"\u23F3":"\u21BB"}</button><button onClick={onNew} style={{padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",background:"#fff",color:T.dark,fontSize:13,fontWeight:600}}>+ Log job</button><button onClick={onOut} style={{padding:"8px 10px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(255,255,255,.08)",color:"#555",fontSize:11}}>Out</button></div>
      </div>
      <div style={{padding:"16px 18px",maxWidth:960,margin:"0 auto"}}>
        <div style={{display:"flex",gap:6,marginBottom:14}}>{[["all","All"],["migrated",`Migrated (${legN})`],["app",`New (${appN})`]].map(([k,l2])=><span key={k} onClick={()=>{setSrc(k);setShow(50)}} style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",background:src===k?T.dark:T.surface,color:src===k?"#fff":T.muted,border:`1.5px solid ${src===k?T.dark:T.border}`}}>{l2}</span>)}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:18}}>{[{l:"Jobs",v:pool.length,bg:T.bg,c:T.dark},{l:"Collected",v:"$"+Math.round(colAmt).toLocaleString(),bg:"#ecfdf5",c:T.accent},{l:"Unpaid",v:"$"+Math.round(unpAmt).toLocaleString(),bg:"#fef2f2",c:T.red},{l:"Needs Info",v:needsInfo.length,bg:"#fffbeb",c:T.amber}].map((m,i)=><div key={i} onClick={m.l==="Needs Info"?()=>{setFilt("needs_info");setShow(50)}:m.l==="Unpaid"?()=>{setFilt("unpaid");setShow(50)}:undefined} style={{background:m.bg,borderRadius:10,padding:"10px 12px",textAlign:"center",cursor:(m.l==="Needs Info"||m.l==="Unpaid")?"pointer":"default"}}><div style={{fontSize:10,fontWeight:700,color:m.c,textTransform:"uppercase",letterSpacing:.5}}>{m.l}</div><div style={{fontSize:19,fontWeight:700,color:m.c,marginTop:2}}>{m.v}</div></div>)}</div>

        {/* Needs Info breakdown card */}
        {needsInfo.length>0&&<div style={{background:T.surface,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow,marginBottom:18,border:"1.5px solid #fde68a"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:14,fontWeight:700,color:"#92400e"}}>{needsInfo.length} jobs need info</div>
            <span onClick={()=>{setFilt("needs_info");setShow(50)}} style={{fontSize:12,fontWeight:600,color:T.blue,cursor:"pointer"}}>View all &rarr;</span>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{Object.entries(missingBreakdown).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([k,v])=><div key={k} style={{background:"#fef3c7",borderRadius:8,padding:"6px 12px",fontSize:12}}><span style={{fontWeight:700,color:"#92400e"}}>{v}</span><span style={{color:"#78350f",marginLeft:4}}>no {k.toLowerCase()}</span></div>)}</div>
        </div>}

        <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:12,marginBottom:18}}>
          <div style={{background:T.surface,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow}}><div style={{fontSize:14,fontWeight:700,color:T.red,marginBottom:10}}>Unpaid partners</div>{arList.length===0&&<div style={{fontSize:12,color:T.muted,textAlign:"center",padding:10}}>None</div>}{arList.map(([n,d],i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:i<arList.length-1?`1px solid ${T.bg}`:""}}><div><div style={{fontSize:13,fontWeight:600,color:T.dark}}>{n}</div><div style={{fontSize:10,color:T.muted}}>{d.n2} jobs &middot; {ago(d.old)}d</div></div><div style={{fontSize:14,fontWeight:700,color:T.red}}>{money(d.t)}</div></div>)}{oneOff.length>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"7px 0",color:T.muted,fontSize:12}}><span>One-off ({oneOff.length})</span><span>{money(oneOffAmt)}</span></div>}<div style={{borderTop:`2px solid ${T.border}`,marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700}}><span>Total outstanding</span><span style={{color:T.red}}>{money(unpAmt)}</span></div></div>
          <div style={{background:T.surface,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow}}><div style={{fontSize:14,fontWeight:700,color:T.dark,marginBottom:10}}>Aging</div>{[{l:"0\u201330 days",n:aging["0-30"],c:T.accent},{l:"30\u201360 days",n:aging["30-60"],c:T.amber},{l:"60\u201390 days",n:aging["60-90"],c:"#ea580c"},{l:"90+ days",n:aging["90+"],c:T.red}].map((a,i)=><div key={i} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted,marginBottom:3}}><span>{a.l}</span><span style={{fontWeight:600}}>{a.n}</span></div><div style={{height:10,borderRadius:5,background:T.bg,overflow:"hidden"}}><div style={{width:`${Math.round((a.n/maxA)*100)}%`,height:"100%",background:a.c,borderRadius:5}} /></div></div>)}<div style={{fontSize:11,color:T.muted,marginTop:4,paddingTop:8,borderTop:`1px solid ${T.border}`}}>Goal: collect within 30 days</div></div>
        </div>
        <div style={{background:T.surface,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}><div style={{fontSize:15,fontWeight:700,color:T.dark}}>Jobs</div><div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}><input value={q} onChange={e=>{setQ(e.target.value);setShow(50)}} placeholder="Search..." style={{padding:"6px 10px",fontSize:12,borderRadius:8,border:`1.5px solid ${T.border}`,width:120,fontFamily:T.font,outline:"none"}} />{["action","unpaid","needs_info","paid","all"].map(f=><span key={f} onClick={()=>{setFilt(f);setShow(50)}} style={{padding:"5px 10px",borderRadius:14,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",background:filt===f?T.dark:T.bg,color:filt===f?"#fff":T.muted}}>{f==="action"?"Needs action":f==="needs_info"?"Needs info":f==="unpaid"?"Unpaid":f==="paid"?"Paid":"All"}</span>)}</div></div>
          {list.slice(0,show).map(j=>{const title=j.title||[j.vehicle.color,j.vehicle.make,j.vehicle.model].filter(Boolean).join(" ")||"No info";const mi=getMissing(j);const hasGaps=mi.length>0;const sc=j.status===ST.PAID?T.accent:(j.status===ST.UNPAID?T.red:T.amber);const sl=j.status===ST.PAID?"Paid":(j.status===ST.UNPAID?"Unpaid":(hasGaps?"Needs info":"Missing"));return(<div key={j.id} onClick={()=>setEdit(j)} style={{padding:"11px 0",borderBottom:`1px solid ${T.bg}`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:600,color:T.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}{j.source==="migrated"&&<span style={{padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:700,background:"#eff6ff",color:"#2563eb",marginLeft:6,verticalAlign:"middle"}}>M</span>}{j.receiptMissing&&<span style={{padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:700,background:"#fffbeb",color:T.amber,marginLeft:4,verticalAlign:"middle"}}>No rcpt</span>}</div><div style={{fontSize:12,color:T.muted,marginTop:2}}>{j.customer.name||""}{j.customer.name&&" \u00B7 "}{fmtDate(j.jobDate)}</div>{hasGaps&&<MissingPills job={j} />}</div><div style={{textAlign:"right",flexShrink:0,paddingTop:2}}><div style={{fontSize:14,fontWeight:700,color:(j.price&&!isNaN(j.price))?T.dark:T.amber}}>{(j.price&&!isNaN(j.price))?money(j.price):"No price"}</div><div style={{fontSize:11,fontWeight:600,color:sc,marginTop:2}}>{sl}</div></div></div>)})}
          {list.length>show&&<button onClick={()=>setShow(s=>s+50)} style={{...btnS,marginTop:12,fontSize:13}}>Show more ({list.length-show} remaining)</button>}
          {list.length===0&&<div style={{textAlign:"center",padding:24,fontSize:14,color:T.muted}}>No jobs match</div>}
        </div>
      </div>
      {edit&&<EditPanel job={edit} onSave={handleSave} onClose={()=>setEdit(null)} />}
    </div>);
}

/* ════════════════════════════════════════
   ROOT
   ════════════════════════════════════════ */
export default function App(){
  const[auth,setAuth]=useState(()=>localStorage.getItem("ut-auth")==="1");
  const[jobs,setJobs]=useState([]);const[view,setView]=useState("dash");const[loading,setLoading]=useState(false);
  const load=useCallback(async()=>{setLoading(true);const r=await fetchAll();if(r&&r.length>0){setJobs(r);cacheJobs(r)}else{const c=loadCached();if(c.length>0)setJobs(c)};setLoading(false)},[]);
  useEffect(()=>{if(auth)load()},[auth,load]);
  const add=useCallback(j=>{setJobs(p=>{const n=[...p,j];cacheJobs(n);return n});setView("dash")},[]);
  if(!auth)return<Login onAuth={()=>setAuth(true)} />;
  if(view==="log")return<Capture onSubmit={add} onCancel={()=>setView("dash")} />;
  return<Dashboard jobs={jobs} setJobs={setJobs} onNew={()=>setView("log")} onOut={()=>{localStorage.removeItem("ut-auth");setAuth(false)}} loading={loading} refresh={load} />;
}
