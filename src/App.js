import React, { useState, useEffect, useCallback, useRef } from "react";

/* ════════════════════════════════════════
   CONFIG
   ════════════════════════════════════════ */
const PIN = "united149";
const TAX = 0.08375;
const CC_FEE = 0.045;
const LOGO_B64 = "data:image/png;base64,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";
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
  { k:"storage", l:"Storage" },{ k:"mileage", l:"Mileage" },
  { k:"special_equip", l:"Special Equipment" },{ k:"cleanup", l:"Clean Up" },
  { k:"speedy_dry", l:"Speedy Dry" },{ k:"goa", l:"GOA" }
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
  const svcSum = SVC.reduce((a,i) => a + (parseFloat(s[i.k])||0), 0)
    + (parseFloat(s.custom1)||0) + (parseFloat(s.custom2)||0) + (parseFloat(s.custom3)||0);
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

/* Free zip code lookup using nominatim (OpenStreetMap) - no API key */
const lookupZip = async (address, city, state) => {
  if (!address && !city) return "";
  const q = [address, city, state].filter(Boolean).join(", ");
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=1&countrycodes=us`);
    const d = await r.json();
    if (d && d[0] && d[0].address && d[0].address.postcode) return d[0].address.postcode;
  } catch {}
  return "";
};

const freshJob = () => ({
  id:uid(), jobDate:new Date().toISOString().split("T")[0],
  jobTime:new Date().toTimeString().slice(0,5),
  vehicle:{color:"",make:"",model:"",year:"",vin:"",plate:""},
  customer:{name:"",phone:""}, owner:{name:"",homePhone:"",workPhone:""},
  pickup:"",pickupCity:"",pickupState:"",pickupZip:"",dropoff:"",dropoffCity:"",dropoffState:"",dropoffZip:"",
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
    pickup:row[COL.PICKUP]||"", pickupCity:ext.pickupCity||"", pickupState:ext.pickupState||"", pickupZip:ext.pickupZip||"",
    dropoff:row[COL.DROPOFF]||"", dropoffCity:ext.dropoffCity||"", dropoffState:ext.dropoffState||"", dropoffZip:ext.dropoffZip||"",
    services:svc, price:price||"", paymentType:row[COL.PAYMENT]||"Cash",
    tolls:ext.tolls||"", poNumber:ext.poNumber||"", raNumber:ext.raNumber||"",
    taxMode:ext.taxMode||"standard", taxRate:ext.taxRate!=null?ext.taxRate:TAX,
    status: st==="deleted"?"deleted" : (st==="paid"?ST.PAID : (st==="unpaid"?ST.UNPAID : ((!price||price==="")?ST.MISSING:ST.UNPAID))),
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
    owner:job.owner||{}, pickupCity:job.pickupCity||"", pickupState:job.pickupState||"", pickupZip:job.pickupZip||"",
    dropoffCity:job.dropoffCity||"", dropoffState:job.dropoffState||"", dropoffZip:job.dropoffZip||"",
    tolls:job.tolls||"", poNumber:job.poNumber||"", raNumber:job.raNumber||"",
    legacyNum:job.legacyNum||"", legacyTitle:job.title||"",
    receiptMissing:job.receiptMissing||false,
    taxMode:job.taxMode||"standard", taxRate:job.taxRate!=null?job.taxRate:TAX
  });
  const sv = SVC.reduce((a,i) => a + (parseFloat((job.services||{})[i.k])||0), 0)
    + (parseFloat((job.services||{}).custom1)||0) + (parseFloat((job.services||{}).custom2)||0) + (parseFloat((job.services||{}).custom3)||0);
  const txRate = job.taxMode==="exempt"?0:(job.taxRate!=null?parseFloat(job.taxRate):TAX);
  const txAmt = Math.round(sv*txRate*100)/100;
  const tlAmt = parseFloat(job.tolls)||0;
  const ccAmt = job.paymentType==="Credit Card"?Math.round((sv+txAmt+tlAmt)*CC_FEE*100)/100:0;
  const fullTotal = sv>0 ? Math.round((sv+txAmt+tlAmt+ccAmt)*100)/100 : "";
  return {
    action, id:job.id, date:job.jobDate||"", time:job.jobTime||"",
    desc: desc,
    customer:job.customer?.name||"", phone:job.customer?.phone||"",
    pickup:job.pickup||"", dropoff:job.dropoff||"",
    color:job.vehicle?.color||"", make:job.vehicle?.make||"",
    model:job.vehicle?.model||"", year:job.vehicle?.year||"",
    plate:job.vehicle?.plate||"",
    price:fullTotal||job.price||"", payment:job.paymentType||"", status:job.status||"",
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
    pickup:"",pickupCity:"",pickupState:"",pickupZip:"",dropoff:"",dropoffCity:"",dropoffState:"",dropoffZip:"",
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
    const appJobs = (d.jobs||[]).map(parseRow).filter(j=>j.status!=="deleted");

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

async function deleteJob(job) {
  const marked = {...job, status:"deleted"};
  return await syncJob(marked, "update");
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
  const sv=SVC.reduce((a,i)=>a+(parseFloat(svc[i.k])||0),0)+(parseFloat(svc.custom1)||0)+(parseFloat(svc.custom2)||0)+(parseFloat(svc.custom3)||0);
  const pdfTaxRate=job.taxMode==="exempt"?0:(job.taxRate!=null?parseFloat(job.taxRate):TAX);
  const sub=sv+tl, tax=Math.round(sv*pdfTaxRate*100)/100;
  const chargeBase=sv+tax+tl;
  const cc=job.paymentType==="Credit Card"?Math.round(chargeBase*CC_FEE*100)/100:0;
  const tot=Math.round((chargeBase+cc)*100)/100;
  const bx=(x,by,bw,bh,lb,vl,vs)=>{vs=vs||10;doc.setDrawColor(51);doc.setLineWidth(.5);doc.rect(x,by,bw,bh);doc.setFontSize(6);doc.setFont("helvetica","normal");doc.setTextColor(...dk);doc.text(lb,x+3,by+8);if(vl){doc.setFontSize(vs);doc.setFont("helvetica","bold");doc.setTextColor(...bl);doc.text(String(vl),x+4,by+bh-4);doc.setTextColor(...dk)}};
  const ck=(x,cy,on)=>{doc.rect(x,cy,9,9);if(on){doc.setFontSize(7);doc.setFont("helvetica","bold");doc.text("X",x+2,cy+7.5)}};
  doc.setFillColor(...dk);doc.rect(m,y,pw,32,"F");doc.setTextColor(...wt);doc.setFontSize(22);doc.setFont("helvetica","bold");doc.text("24 HOUR TOWING",w/2,y+24,{align:"center"});y+=36;
  /* Logos on left and right, text in center */
  const logoW=55,logoH=Math.round(55*119/150);
  try{doc.addImage(LOGO_B64,"PNG",m+4,y,logoW,logoH)}catch{};
  try{doc.addImage(LOGO_B64,"PNG",m+pw-logoW-4,y,logoW,logoH)}catch{};
  doc.setTextColor(...dk);doc.setFontSize(18);doc.setFont("helvetica","bold");doc.text("UNITED",w/2,y+16,{align:"center"});
  doc.setFontSize(8);doc.setFont("helvetica","normal");doc.text("TOWING & TRANSPORT",w/2,y+26,{align:"center"});
  doc.setFontSize(7);doc.text('"Local & Long Distance"     "Flatbed Specialists"',w/2,y+35,{align:"center"});
  doc.setFontSize(6);doc.text("Towing \u2022 Emergency Starting \u2022 Battery Service \u2022 Flat Tire Service",w/2,y+43,{align:"center"});
  doc.text("Vehicle Locksmith Services \u2022 Unauthorized Tows \u2022 Fuel Delivery",w/2,y+50,{align:"center"});
  y+=Math.max(logoH,52)+6;
  doc.setFillColor(30,58,95);doc.rect(m,y,pw,30,"F");doc.setTextColor(255,255,255);doc.setFontSize(24);doc.setFont("helvetica","bold");doc.text("914-500-5570",w/2,y+22,{align:"center"});doc.setTextColor(...dk);y+=32;
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
  /* Build PDF service rows - standard + custom + totals */
  const pdfR=[["TOWING","towing"],["WAITING TIME","waiting"],["WINCH","winch"],["ROAD SERVICE","road_service"],["GATE FEE","gate_fee"],["ADMIN FEE","admin_fee"],["STORAGE","storage"],["MILEAGE","mileage"],["SPECIAL EQUIP","special_equip"],["CLEAN UP","cleanup"],["SPEEDY DRY","speedy_dry"],["GOA","goa"]];
  /* Add custom fees if they have names */
  if(svc.custom1_name)pdfR.push([svc.custom1_name.toUpperCase(),"custom1"]);
  if(svc.custom2_name)pdfR.push([svc.custom2_name.toUpperCase(),"custom2"]);
  if(svc.custom3_name)pdfR.push([svc.custom3_name.toUpperCase(),"custom3"]);
  pdfR.push(["SUBTOTAL","_s"],["TAX","_t"],["TOLLS","_tl"],["CC PROCESS FEE (4.5%)","_c"],["TOTAL DUE","_tot"]);
  const sr2=Math.min(sr,Math.floor(bh2/pdfR.length));
  let sy=y+hh;pdfR.forEach(r=>{doc.setDrawColor(51);doc.setLineWidth(.5);doc.rect(sx,sy,sw2,sr2);let v="";
    if(r[1]==="_s")v=sv>0?sv.toFixed(2):"";else if(r[1]==="_t")v=tax>0?tax.toFixed(2):"";else if(r[1]==="_tl")v=tl>0?tl.toFixed(2):"";else if(r[1]==="_c")v=cc>0?cc.toFixed(2):"";else if(r[1]==="_tot")v=tot>0?tot.toFixed(2):"";else{const sv2=parseFloat(svc[r[1]])||0;if(sv2>0)v=sv2.toFixed(2)}
    ck(sx+5,sy+Math.max(2,(sr2-9)/2),!!v);const it=r[0]==="TOTAL DUE";doc.setFontSize(it?8:7);doc.setFont("helvetica",it?"bold":"normal");doc.setTextColor(...dk);doc.text(r[0],sx+20,sy+sr2-Math.max(4,sr2*.25));
    if(v){doc.setFontSize(it?10:9);doc.setFont("helvetica","bold");doc.setTextColor(...bl);doc.text(v,sx+sw2-6,sy+sr2-Math.max(4,sr2*.25),{align:"right"});doc.setTextColor(...dk)}sy+=sr2});
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

function SvcPricing({services,onChange}){const s=services||{};
  const customs=[{nk:"custom1_name",vk:"custom1"},{nk:"custom2_name",vk:"custom2"},{nk:"custom3_name",vk:"custom3"}];
  return(<div style={{display:"grid",gap:2}}>
    {SVC.map(i=>{const v=s[i.k]||"";const on=parseFloat(v)>0;return(<div key={i.k} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0"}}><div style={{flex:1,fontSize:14,fontWeight:on?600:400,color:on?T.dark:T.muted}}>{i.l}</div><input value={v} onChange={e=>onChange({...s,[i.k]:e.target.value})} placeholder="$0" type="number" inputMode="decimal" style={{width:90,padding:"8px 10px",fontSize:15,borderRadius:8,fontWeight:on?700:400,border:`1.5px solid ${on?T.accent:T.border}`,background:on?"#f0fdf4":T.surface,textAlign:"right",boxSizing:"border-box",fontFamily:T.font,outline:"none"}} /></div>)})}
    <div style={{borderTop:`1px solid ${T.border}`,marginTop:6,paddingTop:8}}>
      <div style={{fontSize:11,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>Custom fees</div>
      {customs.map(c=>{const nm=s[c.nk]||"";const v=s[c.vk]||"";const on=parseFloat(v)>0;return(<div key={c.vk} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0"}}><input value={nm} onChange={e=>onChange({...s,[c.nk]:e.target.value})} placeholder="Fee name" style={{flex:1,padding:"8px 10px",fontSize:14,borderRadius:8,border:`1.5px solid ${on?"#3b82f6":T.border}`,background:on?"#eff6ff":T.surface,boxSizing:"border-box",fontFamily:T.font,outline:"none",fontWeight:on?600:400,color:on?T.dark:T.muted}} /><input value={v} onChange={e=>onChange({...s,[c.vk]:e.target.value})} placeholder="$0" type="number" inputMode="decimal" style={{width:90,padding:"8px 10px",fontSize:15,borderRadius:8,fontWeight:on?700:400,border:`1.5px solid ${on?"#3b82f6":T.border}`,background:on?"#eff6ff":T.surface,textAlign:"right",boxSizing:"border-box",fontFamily:T.font,outline:"none"}} /></div>)})}
    </div>
  </div>);
}

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
  const go=async()=>{if(!j.customer.name&&!cc)return;const f={...j,price:total||svcSum||j.price,isTest:test};if(!svcSum&&(!f.price||isNaN(f.price)))f.status=ST.MISSING;setBusy(true);await syncJob(f,"add");if(!test)onSubmit(f);setBusy(false);setDone(true);setTimeout(()=>{setDone(false);setJ(freshJob());setCC(false)},1500)};
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
        <div style={{marginBottom:14}}><label style={lbl}>Job Name</label><input value={j.title||""} onChange={e=>setJ(p=>({...p,title:e.target.value}))} placeholder="e.g. Toby Buchanan BMW X5 to Mamaroneck" style={inp} /></div>
        <div style={{marginBottom:14}}><label style={lbl}>Customer</label>{!cc?<select value={j.customer.name} onChange={e=>{if(e.target.value==="__new__"){setCC(true);u("customer.name","")}else u("customer.name",e.target.value)}} style={{...inp,appearance:"auto"}}><option value="">Select partner...</option>{PARTNERS.map(p=><option key={p}>{p}</option>)}<option value="__new__">+ New customer</option></select>:<div style={{display:"flex",gap:8}}><input value={j.customer.name} onChange={e=>u("customer.name",e.target.value)} placeholder="Name" style={{...inp,flex:1}} /><button onClick={()=>{setCC(false);u("customer.name","")}} style={{...btnS,width:"auto",padding:"10px 14px",fontSize:13}}>Back</button></div>}</div>
        <div style={{marginBottom:14}}><label style={lbl}>Phone</label><input value={j.customer.phone} onChange={e=>u("customer.phone",e.target.value)} placeholder="914-555-1234" type="tel" style={inp} /></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>{[["Color","vehicle.color","White"],["Make","vehicle.make","Ford"],["Model","vehicle.model","E350"]].map(([l2,p,ph])=><div key={p}><label style={lbl}>{l2}</label><input value={p.split(".").reduce((o,k)=>o[k],j)} onChange={e=>u(p,e.target.value)} placeholder={ph} style={inp} /></div>)}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}><div><label style={lbl}>Year</label><input value={j.vehicle.year} onChange={e=>u("vehicle.year",e.target.value)} placeholder="2021" inputMode="numeric" style={inp} /></div><div><label style={lbl}>VIN</label><input value={j.vehicle.vin} onChange={e=>u("vehicle.vin",e.target.value)} placeholder="VIN" style={inp} /></div><div><label style={lbl}>Plate</label><input value={j.vehicle.plate} onChange={e=>u("vehicle.plate",e.target.value)} placeholder="ABC 1234" style={inp} /></div></div>
        <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:8,marginBottom:8}}><div><label style={lbl}>Pickup</label><input value={j.pickup} onChange={e=>u("pickup",e.target.value)} placeholder="1 Melrose Dr" style={inp} /></div><div><label style={lbl}>City / State / Zip</label><input value={j.pickupCity} onChange={e=>u("pickupCity",e.target.value)} placeholder="New Rochelle, NY 10801" style={inp} onBlur={async()=>{const v=j.pickupCity||"";if(v&&!j.pickupZip){const parts=v.split(/[,\s]+/).filter(Boolean);const hasZip=parts.some(p=>/^\d{5}/.test(p));if(!hasZip){const z=await lookupZip(j.pickup,v,"");if(z){u("pickupCity",v.replace(/,?\s*$/,"")+", "+z);u("pickupZip",z)}}}}} /></div></div>
        <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:8,marginBottom:16}}><div><label style={lbl}>Dropoff</label><input value={j.dropoff} onChange={e=>u("dropoff",e.target.value)} placeholder="760 Old White Plains Rd" style={inp} /></div><div><label style={lbl}>City / State / Zip</label><input value={j.dropoffCity} onChange={e=>u("dropoffCity",e.target.value)} placeholder="Mamaroneck, NY 10543" style={inp} onBlur={async()=>{const v=j.dropoffCity||"";if(v&&!j.dropoffZip){const parts=v.split(/[,\s]+/).filter(Boolean);const hasZip=parts.some(p=>/^\d{5}/.test(p));if(!hasZip){const z=await lookupZip(j.dropoff,v,"");if(z){u("dropoffCity",v.replace(/,?\s*$/,"")+", "+z);u("dropoffZip",z)}}}}} /></div></div>
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
function EditPanel({job,onSave,onClose,onDelete}){
  const isM=job.source==="migrated";
  const[j,setJ]=useState(JSON.parse(JSON.stringify(job)));
  const[busy,setBusy]=useState(false);const[msg,setMsg]=useState("");const[pdfing,setPdfing]=useState(false);const[more,setMore]=useState(false);
  const[confirmDel,setConfirmDel]=useState(false);const[deleting,setDeleting]=useState(false);
  const u=(p,v)=>setJ(prev=>{const c2=JSON.parse(JSON.stringify(prev));const k=p.split(".");let r=c2;for(let i=0;i<k.length-1;i++)r=r[k[i]];r[k[k.length-1]]=v;return c2});
  const{sub,tax,cc,total,svcSum,tl,taxRate:effRate}=totals(j.services,j.tolls,j.paymentType,j.taxMode==="exempt"?0:j.taxRate);
  const save=async()=>{setBusy(true);const saved={...j,price:total||svcSum||j.price};await syncJob(saved,"update");onSave(saved);setMsg("Saved");setBusy(false);setTimeout(()=>setMsg(""),2000)};
  const pdf=async()=>{setPdfing(true);try{await makePDF(j)}catch{alert("PDF error")}setPdfing(false)};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:12,fontFamily:T.font}}>
      <div style={{background:T.surface,borderRadius:14,width:"100%",maxWidth:560,maxHeight:"92vh",overflow:"auto",padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div><div style={{fontSize:18,fontWeight:700,color:T.dark}}>{isM?`Job #${job.legacyNum}`:"Edit job"}</div>{isM&&<div style={{fontSize:12,color:T.muted,marginTop:3}}>Migrated — edits save directly</div>}</div>
          <button onClick={onClose} style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface,color:T.dark,fontSize:12,fontWeight:600,cursor:"pointer"}}>Close</button>
        </div>
        {isM&&job.title&&<div style={{background:"#eff6ff",borderRadius:10,padding:14,marginBottom:16,fontSize:13,lineHeight:1.7}}><div style={{color:T.muted}}>Original: {job.title}</div><div style={{color:T.muted}}>Migrated price: {job.price?money(job.price):"\u2014"} &middot; Payment: {job.paymentType||"\u2014"}</div></div>}
        <div style={{marginBottom:14}}><label style={lbl}>Job Name</label><input value={j.title||""} onChange={e=>setJ(p=>({...p,title:e.target.value}))} placeholder="e.g. Toby Buchanan BMW X5 to Mamaroneck" style={inp} /></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}><div><label style={lbl}>Date</label><input type="date" value={j.jobDate} onChange={e=>u("jobDate",e.target.value)} style={inp} /></div><div><label style={lbl}>Time</label><input type="time" value={j.jobTime} onChange={e=>u("jobTime",e.target.value)} style={inp} /></div></div>
        <Section title="Customer"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><label style={lbl}>Name</label><input value={j.customer.name} onChange={e=>u("customer.name",e.target.value)} style={inp} /></div><div><label style={lbl}>Phone</label><input value={j.customer.phone} onChange={e=>u("customer.phone",e.target.value)} style={inp} /></div></div></Section>
        <Section title="Vehicle"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:8}}>{[["Year","vehicle.year"],["Color","vehicle.color"],["Make","vehicle.make"],["Model","vehicle.model"]].map(([l2,p])=><div key={p}><label style={lbl}>{l2}</label><input value={p.split(".").reduce((o,k)=>o[k],j)} onChange={e=>u(p,e.target.value)} style={inp} /></div>)}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><label style={lbl}>VIN</label><input value={j.vehicle.vin} onChange={e=>u("vehicle.vin",e.target.value)} style={inp} /></div><div><label style={lbl}>Plate</label><input value={j.vehicle.plate} onChange={e=>u("vehicle.plate",e.target.value)} style={inp} /></div></div></Section>
        <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:8,marginBottom:8}}><div><label style={lbl}>Pickup</label><input value={j.pickup} onChange={e=>u("pickup",e.target.value)} style={inp} /></div><div><label style={lbl}>City / State / Zip</label><input value={j.pickupCity} onChange={e=>u("pickupCity",e.target.value)} placeholder="New Rochelle, NY 10801" style={inp} onBlur={async()=>{const v=j.pickupCity||"";if(v&&!j.pickupZip){const parts=v.split(/[,\s]+/).filter(Boolean);const hasZip=parts.some(p=>/^\d{5}/.test(p));if(!hasZip){const z=await lookupZip(j.pickup,v,"");if(z){u("pickupCity",v.replace(/,?\s*$/,"")+", "+z);u("pickupZip",z)}}}}} /></div></div>
        <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:8,marginBottom:14}}><div><label style={lbl}>Dropoff</label><input value={j.dropoff} onChange={e=>u("dropoff",e.target.value)} style={inp} /></div><div><label style={lbl}>City / State / Zip</label><input value={j.dropoffCity} onChange={e=>u("dropoffCity",e.target.value)} placeholder="Mamaroneck, NY 10543" style={inp} onBlur={async()=>{const v=j.dropoffCity||"";if(v&&!j.dropoffZip){const parts=v.split(/[,\s]+/).filter(Boolean);const hasZip=parts.some(p=>/^\d{5}/.test(p));if(!hasZip){const z=await lookupZip(j.dropoff,v,"");if(z){u("dropoffCity",v.replace(/,?\s*$/,"")+", "+z);u("dropoffZip",z)}}}}} /></div></div>
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
        <div style={{borderTop:`1px solid ${T.border}`,marginTop:16,paddingTop:12}}>
          {!confirmDel?<div onClick={()=>setConfirmDel(true)} style={{textAlign:"center",fontSize:13,fontWeight:600,color:T.red,cursor:"pointer",padding:"8px 0"}}>Delete this job</div>
          :<div style={{background:"#fef2f2",borderRadius:10,padding:14,textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:600,color:T.red,marginBottom:10}}>Are you sure? This will permanently remove the job from the app and Google Sheet.</div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <button onClick={()=>setConfirmDel(false)} style={{...btnS,width:"auto",padding:"8px 20px",fontSize:13}}>Cancel</button>
              <button onClick={async()=>{setDeleting(true);await deleteJob(job);onDelete(job.id);setDeleting(false)}} disabled={deleting} style={{padding:"8px 20px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:T.red,color:"#fff",opacity:deleting?.7:1}}>{deleting?"Deleting...":"Yes, delete"}</button>
            </div>
          </div>}
        </div>
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

  let list=pool;if(!q){if(filt==="action")list=pool.filter(j=>j.status!==ST.PAID);else if(filt==="unpaid")list=unpaid;else if(filt==="missing")list=missing;else if(filt==="needs_info")list=needsInfo;else if(filt==="paid")list=paid;}
  if(q){const s=q.toLowerCase();list=list.filter(j=>{const dateStr=fmtDate(j.jobDate).toLowerCase();const isoDate=(j.jobDate||"").toLowerCase();return (j.customer.name||"").toLowerCase().includes(s)||(j.title||"").toLowerCase().includes(s)||(j.vehicle.make||"").toLowerCase().includes(s)||(j.vehicle.model||"").toLowerCase().includes(s)||(j.vehicle.color||"").toLowerCase().includes(s)||(j.vehicle.plate||"").toLowerCase().includes(s)||(j.vehicle.vin||"").toLowerCase().includes(s)||(j.vehicle.year||"").toLowerCase().includes(s)||(j.notes||"").toLowerCase().includes(s)||(j.pickup||"").toLowerCase().includes(s)||(j.pickupCity||"").toLowerCase().includes(s)||(j.dropoff||"").toLowerCase().includes(s)||(j.dropoffCity||"").toLowerCase().includes(s)||(j.paymentType||"").toLowerCase().includes(s)||dateStr.includes(s)||isoDate.includes(s)||(j.id||"").toLowerCase().includes(s)})}
  list=[...list].sort((a,b)=>(b.jobDate||"").localeCompare(a.jobDate||""));
  const legN=jobs.filter(j=>j.source==="migrated").length;const appN=jobs.filter(j=>j.source==="app").length;
  const handleSave=saved=>{setJobs(prev=>{const next=prev.map(j=>j.id===saved.id?saved:j);if(!prev.find(j=>j.id===saved.id))next.push(saved);cacheJobs(next);return next});setEdit(null)};
  const handleDelete=id=>{setJobs(prev=>{const next=prev.filter(j=>j.id!==id);cacheJobs(next);return next});setEdit(null)};
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
      {edit&&<EditPanel job={edit} onSave={handleSave} onClose={()=>setEdit(null)} onDelete={handleDelete} />}
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
