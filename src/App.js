import React, { useState, useEffect, useCallback, useRef } from "react";

const APP_PIN = "united149";

const PARTNERS = [
  "JC Auto","Gabe Citgo","Karls Auto Body","Tasca Ford","Hartsdale Mobil",
  "RDI Property Group","NFA Towing","German Car","Mancuso Auto Body",
  "Cruz Control Auto","Vasco Tech Center","Performance Auto","Preferred Auto Service",
  "Sal's Auto","Ferry Auto","Yonkers Auto Gallery","Renzo Auto","Tierney Auto",
  "Caldarola Auto Body","Frank Donato Construction","Lenny's Auto"
];
const SERVICE_TYPES = ["Tow","Jump Start","Tire Change","Winch","Transport","Storage","Impound","Road Service"];
const PAYMENT_TYPES = ["Cash","Zelle","Check","Credit Card","Invoice Later","Pending Insurance"];
const STATUSES = { PAID:"paid", UNPAID:"unpaid", MISSING:"missing" };
const TAX_RATE = 0.08375;

function generateId() { return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function formatDate(d) { if(!d) return "\u2014"; const dt=new Date(d); return isNaN(dt)? "\u2014" : `${dt.getMonth()+1}/${dt.getDate()}/${String(dt.getFullYear()).slice(2)}`; }
function formatMoney(n) { if(n==null||isNaN(n)) return "\u2014"; return "$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function daysSince(d) { if(!d) return 0; return Math.floor((Date.now()-new Date(d).getTime())/86400000); }

const emptyJob = () => ({
  id:generateId(), createdAt:new Date().toISOString(),
  jobDate:new Date().toISOString().split("T")[0],
  jobTime:new Date().toTimeString().slice(0,5),
  vehicle:{color:"",make:"",model:"",year:"",vin:"",plate:""},
  customer:{name:"",phone:"",isPartner:false},
  pickup:"", dropoff:"", serviceType:"Tow", price:"", paymentType:"Cash",
  status:STATUSES.UNPAID, notes:"",
  vehiclePhoto:null, registrationPhoto:null,
  receiptGenerated:false, paidDate:null,
  invoiceDetails:{subtotal:"",tax:"",total:"",tolls:"",ccFee:""}
});

// --- SHEETS SYNC LAYER ---
// This is the single source of truth. localStorage is just offline cache.

const CACHE_KEY = "ut-jobs-v2";
function cacheJobs(jobs) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(jobs)); } catch {} }
function loadCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)||"[]"); } catch { return []; } }

// Convert a sheet row array into our job object
function rowToJob(row) {
  // Columns: 0=id, 1=date, 2=time, 3=color, 4=make, 5=model, 6=year, 7=vin, 8=plate,
  //          9=customer, 10=phone, 11=pickup, 12=dropoff, 13=service, 14=price,
  //          15=payment, 16=status, 17=notes
  const id = row[0] || generateId();
  // Google Sheets returns dates as ISO strings like "2026-04-13T04:00:00.000Z"
  const rawDate = row[1] || "";
  const jobDate = rawDate ? new Date(rawDate).toISOString().split("T")[0] : "";
  // Times come back as "1899-12-31T01:03:00.000Z" - extract just HH:MM
  const rawTime = row[2] || "";
  let jobTime = "";
  if (rawTime) {
    try { const td = new Date(rawTime); jobTime = td.getUTCHours().toString().padStart(2,"0") + ":" + td.getUTCMinutes().toString().padStart(2,"0"); }
    catch { jobTime = String(rawTime).slice(0,5); }
  }
  const status = (row[16]||"").toLowerCase();
  return {
    id,
    createdAt: jobDate ? new Date(jobDate + "T12:00:00").toISOString() : new Date().toISOString(),
    jobDate,
    jobTime,
    vehicle: { color: row[3]||"", make: row[4]||"", model: row[5]||"", year: row[6]||"", vin: row[7]||"", plate: row[8]||"" },
    customer: { name: row[9]||"", phone: row[10]||"", isPartner: PARTNERS.includes(row[9]||"") },
    pickup: row[11]||"",
    dropoff: row[12]||"",
    serviceType: row[13]||"Tow",
    price: row[14]||"",
    paymentType: row[15]||"Cash",
    status: status === "paid" ? STATUSES.PAID : ((!row[14] || row[14]==="") ? STATUSES.MISSING : STATUSES.UNPAID),
    notes: row[17]||"",
    vehiclePhoto: null,
    registrationPhoto: null,
    receiptGenerated: false,
    paidDate: status === "paid" ? (jobDate ? new Date(jobDate+"T12:00:00").toISOString() : null) : null,
    invoiceDetails: { subtotal:"", tax:"", total:"", tolls:"", ccFee:"" }
  };
}

// Convert job object to flat payload for sheets
function jobToPayload(job, action) {
  return {
    action,
    id: job.id,
    date: job.jobDate || new Date().toISOString().split("T")[0],
    time: job.jobTime || new Date().toTimeString().slice(0,5),
    color: job.vehicle?.color || "",
    make: job.vehicle?.make || "",
    model: job.vehicle?.model || "",
    year: job.vehicle?.year || "",
    vin: job.vehicle?.vin || "",
    plate: job.vehicle?.plate || "",
    customer: job.customer?.name || "",
    phone: job.customer?.phone || "",
    pickup: job.pickup || "",
    dropoff: job.dropoff || "",
    service: job.serviceType || "",
    price: job.price || "",
    payment: job.paymentType || "",
    status: job.status || "",
    notes: job.notes || ""
  };
}

async function fetchJobsFromSheets() {
  try {
    const response = await fetch("/api/sync");
    const data = await response.json();
    if (data.jobs && Array.isArray(data.jobs)) {
      return data.jobs.map(rowToJob);
    }
    // If raw text came back, sheet might not have list support yet
    console.warn("Sheets returned unexpected format:", data);
    return null;
  } catch (err) {
    console.error("Failed to fetch from sheets:", err);
    return null;
  }
}

async function syncToSheets(job, action = "add") {
  try {
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jobToPayload(job, action))
    });
    const data = await response.json();
    console.log("Sheets sync:", action, data);
    return true;
  } catch(err) { console.error("Sheets sync error:", err); return false; }
}

// --- PDF GENERATION ---
async function generateInvoicePDF(job) {
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const w = 612, h = 792, m = 36, pw = w - 2 * m;
  let y = m;
  const dark = [26, 26, 46], blue = [26, 10, 110], wh = [255, 255, 255];

  function box(x, by, bw, bh, label, value, vs) {
    vs = vs || 10;
    doc.setDrawColor(51); doc.setLineWidth(0.5); doc.rect(x, by, bw, bh);
    doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.setTextColor(...dark);
    doc.text(label, x + 3, by + 8);
    if (value) {
      doc.setFontSize(vs); doc.setFont("helvetica", "bold"); doc.setTextColor(...blue);
      doc.text(String(value), x + 4, by + bh - 4); doc.setTextColor(...dark);
    }
  }
  function cb(x, cy, checked) {
    doc.rect(x, cy, 9, 9);
    if (checked) { doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.text("X", x + 2, cy + 7.5); }
  }

  doc.setFillColor(...dark); doc.rect(m, y, pw, 32, "F");
  doc.setTextColor(...wh); doc.setFontSize(22); doc.setFont("helvetica", "bold");
  doc.text("24 HOUR TOWING", w/2, y+24, {align:"center"}); y += 38;

  doc.setTextColor(...dark); doc.setFontSize(20); doc.text("UNITED", w/2, y+14, {align:"center"}); y += 18;
  doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.text("TOWING & TRANSPORT", w/2, y+9, {align:"center"}); y += 14;
  doc.setFontSize(8); doc.text("\"Local & Long Distance\"     \"Flatbed Specialists\"", w/2, y+8, {align:"center"}); y += 12;
  doc.setFontSize(7);
  doc.text("Towing \u2022 Emergency Starting \u2022 Battery Service \u2022 Flat Tire Service", w/2, y+7, {align:"center"}); y += 9;
  doc.text("Vehicle Locksmith Services \u2022 Unauthorized Tows \u2022 Fuel Delivery", w/2, y+7, {align:"center"}); y += 14;

  doc.setFillColor(232,232,224); doc.rect(m, y, pw, 24, "FD");
  doc.setTextColor(...dark); doc.setFontSize(16); doc.setFont("helvetica","bold");
  doc.text("914-500-5570", w/2, y+18, {align:"center"}); y += 25;

  var rh = 26, dw = pw*0.60, tw = pw*0.40;
  var timeStr = job.jobTime || "";
  var hr = parseInt(timeStr.split(":")[0]||"12");
  var ap = hr >= 12 ? "PM" : "AM";
  var dh = hr > 12 ? hr-12 : (hr===0?12:hr);
  var dt = dh + ":" + (timeStr.split(":")[1]||"00");
  var ds = job.jobDate ? new Date(job.jobDate+"T12:00:00").toLocaleDateString("en-US") : "";

  box(m, y, dw, rh, "DATE:", ds);
  doc.rect(m+dw, y, tw, rh);
  doc.setFontSize(6); doc.setFont("helvetica","normal"); doc.setTextColor(...dark);
  doc.text("TIME:", m+dw+3, y+8);
  if (timeStr) { doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(...blue); doc.text(dt, m+dw+4, y+rh-4); doc.setTextColor(...dark); }
  var ax = m+dw+tw-62, px = m+dw+tw-30, cy2 = y+8;
  cb(ax, cy2, ap==="AM"); doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.text("AM", ax+11, cy2+7);
  cb(px, cy2, ap==="PM"); doc.text("PM", px+11, cy2+7); y += rh;

  box(m, y, dw, rh, "CUSTOMER:", job.customer?.name||"");
  box(m+dw, y, tw, rh, "PHONE:", job.customer?.phone||""); y += rh;
  box(m, y, dw, rh, "PICKUP LOCATION:", job.pickup||"");
  box(m+dw, y, tw, rh, "CITY:", ""); y += rh;
  box(m, y, dw, rh, "DELIVERY LOCATION:", job.dropoff||"");
  box(m+dw, y, tw, rh, "CITY:", ""); y += rh;

  var vc = [["YR:",job.vehicle?.year,0.10],["MAKE:",job.vehicle?.make,0.14],["MODEL:",job.vehicle?.model,0.14],["COLOR:",job.vehicle?.color,0.14],["VIN:",job.vehicle?.vin,0.48]];
  var vx = m; vc.forEach(function(v){box(vx, y, pw*v[2], rh, v[0], v[1]||"", 9); vx += pw*v[2];}); y += rh;

  var oc = [["VEHICLE OWNER:","",0.30],["HOME PHONE:","",0.22],["WORK PHONE:","",0.22],["LIC. NO.:",job.vehicle?.plate,0.26]];
  var ox = m; oc.forEach(function(o){box(ox, y, pw*o[2], rh, o[0], o[1]||"", 9); ox += pw*o[2];}); y += rh+3;

  var rw = pw*0.52, sw = pw*0.48, sx = m+rw, hh = 16, sr = 19, nr = 12, bh = sr*nr;
  doc.rect(m, y, rw, hh); doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(...dark);
  doc.text("REMARKS", m+rw/2, y+12, {align:"center"});
  doc.rect(m, y+hh, rw, bh);
  var rem = job.notes||"";
  if (rem) { doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(...blue); doc.text(rem, m+8, y+hh+14); doc.setTextColor(...dark); }
  var pay = job.paymentType||"";
  if (pay) { doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(...blue); doc.text("PAID "+pay.toUpperCase(), m+8, y+hh+bh-8); doc.setTextColor(...dark); }

  doc.rect(sx, y, sw, hh); doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(...dark);
  doc.text("SERVICES PERFORMED", sx+sw/2, y+12, {align:"center"});

  var price = parseFloat(job.price)||0, tolls = parseFloat(job.invoiceDetails?.tolls)||0;
  var sub = price+tolls, tax = Math.round(sub*TAX_RATE*100)/100;
  var ccf = job.paymentType==="Credit Card"?Math.round(sub*0.045*100)/100:0;
  var tot = Math.round((sub+tax+ccf)*100)/100;
  var sm = {"Tow":"towing","Jump Start":"road_service","Tire Change":"road_service","Winch":"winch","Transport":"towing","Storage":"storage","Impound":"towing","Road Service":"road_service"};
  var ak = sm[job.serviceType]||"towing";

  var rows = [["TOWING","towing"],["WAITING TIME","waiting"],["WINCH","winch"],["ROAD SERVICE","road_service"],["GATE FEE","gate_fee"],["ADMIN FEE","admin_fee"],["STORAGE","storage"],["SUBTOTAL","_sub"],["TAX","_tax"],["TOLLS","_tolls"],["CC PROCESS FEE (4.5%)","_cc"],["TOTAL DUE","_total"]];
  var sy2 = y+hh;
  rows.forEach(function(r) {
    doc.setDrawColor(51); doc.setLineWidth(0.5); doc.rect(sx, sy2, sw, sr);
    var val = "";
    if (r[1]==="_sub") val = sub>0?sub.toFixed(2):"";
    else if (r[1]==="_tax") val = tax>0?tax.toFixed(2):"";
    else if (r[1]==="_tolls") val = tolls>0?tolls.toFixed(2):"";
    else if (r[1]==="_cc") val = ccf>0?ccf.toFixed(2):"";
    else if (r[1]==="_total") val = tot>0?tot.toFixed(2):"";
    else if (r[1]===ak) val = price>0?price.toFixed(2):"";
    cb(sx+5, sy2+5, !!val);
    var it = r[0]==="TOTAL DUE";
    doc.setFontSize(8); doc.setFont("helvetica", it?"bold":"normal"); doc.setTextColor(...dark);
    doc.text(r[0], sx+20, sy2+sr-6);
    if (val) { doc.setFontSize(it?11:10); doc.setFont("helvetica","bold"); doc.setTextColor(...blue); doc.text(val, sx+sw-6, sy2+sr-5, {align:"right"}); doc.setTextColor(...dark); }
    sy2 += sr;
  });
  y += hh+bh+3;

  var lw = pw*0.52, rw2 = pw*0.48, blh = 52;
  doc.rect(m, y, lw, blh);
  doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.text("DAMAGE WAIVER", m+lw/2, y+12, {align:"center"});
  doc.setFontSize(5.5); doc.setFont("helvetica","normal");
  var wv = ["I acknowledge towing or servicing the above referenced vehicle may result","in damage or loss, including loss or theft of personal items. I assume","full responsibility and release United Towing & Transport LLC and it's","representatives from any liability."];
  var wy2 = y+22; wv.forEach(function(l){doc.text(l, m+4, wy2); wy2 += 7;});

  doc.rect(m+lw, y, rw2, blh);
  doc.setFontSize(8); var py2 = y+14;
  ["CASH","CK#","CHARGE ACCOUNT"].forEach(function(pm){
    var cx2 = m+lw+8;
    cb(cx2, py2-3, pay.toUpperCase()===pm.split("#")[0].trim());
    doc.setFont("helvetica","normal"); doc.text(pm, cx2+12, py2+4); py2 += 12;
  });
  y += blh+2;

  var ph2 = 20, hw = pw*0.50;
  doc.rect(m, y, hw, ph2); doc.setFontSize(6); doc.text("P.O.#", m+3, y+8);
  doc.rect(m+hw, y, hw, ph2); doc.text("R.A.#", m+hw+3, y+8); y += ph2+3;

  doc.setFontSize(7); doc.text("x ___________________________________", m, y+8);
  doc.text("OWNER / AGENT", m+20, y+16); y += 22;

  var ah = 36;
  doc.rect(m, y, lw, ah);
  doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.text("ACKNOWLEDGMENT", m+lw/2, y+10, {align:"center"});
  doc.setFontSize(5.5); doc.setFont("helvetica","normal");
  doc.text("I acknowledge receipt of the above referenced vehicle and hereby", m+4, y+20);
  doc.text("release United Towing & Transport LLC from all liability.", m+4, y+27);
  y += ah+2;
  doc.setFontSize(7); doc.text("x ___________________________________", m, y+8);
  doc.text("OWNER / AGENT", m+20, y+16); y += 22;

  var bh2 = 26;
  doc.setFontSize(18); doc.setFont("helvetica","bold"); doc.setTextColor(...dark);
  doc.text("No. "+(job.id||"").slice(-6).toUpperCase(), m+4, y+18);
  var tw2 = pw*0.42, tx2 = m+pw-tw2;
  doc.setFillColor(...dark); doc.rect(tx2, y, tw2*0.55, bh2, "F");
  doc.setTextColor(...wh); doc.setFontSize(14); doc.text("TOTAL", tx2+tw2*0.275, y+18, {align:"center"});
  doc.setTextColor(...dark); doc.rect(tx2+tw2*0.55, y, tw2*0.45, bh2);
  if (tot>0) { doc.setFontSize(15); doc.setFont("helvetica","bold"); doc.setTextColor(...blue); doc.text(tot.toFixed(2), tx2+tw2-6, y+18, {align:"right"}); }
  y += bh2+3;
  doc.setTextColor(...dark); doc.setFontSize(7); doc.setFont("helvetica","normal");
  doc.text("Thank You For Your Business", w-m, y+6, {align:"right"});

  var cn = (job.customer?.name||"job").replace(/[^a-zA-Z0-9]/g,"_").slice(0,20);
  doc.save("UnitedTowing_"+cn+"_"+(job.jobDate||"").replace(/-/g,"")+".pdf");
}

// --- STYLES ---
const C = {
  bg:"#f7f6f3",white:"#ffffff",dark:"#1a1a2e",accent:"#2d6a4f",
  danger:"#c1292e",warning:"#e8871e",success:"#2d6a4f",muted:"#8a8a8a",
  border:"#e2e0db",lightGreen:"#e8f5e9",lightRed:"#fce8e8",
  lightYellow:"#fff8e7",cardShadow:"0 1px 3px rgba(0,0,0,0.06)"
};
const baseBtn = {padding:"10px 20px",borderRadius:8,border:"none",cursor:"pointer",fontSize:14,fontWeight:600,transition:"all 0.15s"};

// --- COMPONENTS ---
function PhotoCapture({ label, icon, value, onChange }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(value);
  const handleCapture = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => { setPreview(reader.result); onChange(reader.result); };
    reader.readAsDataURL(file);
  };
  const handleClear = (e) => { e.stopPropagation(); setPreview(null); onChange(null); if(inputRef.current) inputRef.current.value=""; };
  return (
    <div>
      <div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}}>{label}</div>
      {preview ? (
        <div style={{position:"relative",borderRadius:8,overflow:"hidden",border:`1.5px solid ${C.border}`}}>
          <img src={preview} alt={label} style={{width:"100%",height:120,objectFit:"cover",display:"block"}} />
          <button onClick={handleClear} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.6)",color:"#fff",border:"none",borderRadius:"50%",width:24,height:24,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>&times;</button>
        </div>
      ) : (
        <div onClick={()=>inputRef.current?.click()} style={{border:`1.5px dashed ${C.border}`,borderRadius:8,padding:"20px 8px",textAlign:"center",color:C.muted,fontSize:12,cursor:"pointer",background:C.white}}>
          <div style={{fontSize:22,marginBottom:2}}>{icon}</div>Tap to capture
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleCapture} style={{display:"none"}} />
    </div>
  );
}

function PasswordGate({ onAuth }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin.toLowerCase()===APP_PIN) { localStorage.setItem("ut-auth","1"); onAuth(); }
    else { setError(true); setTimeout(()=>setError(false),2000); }
  };
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.dark}}>
      <div onKeyDown={e=>{if(e.key==="Enter")handleSubmit(e)}} style={{textAlign:"center",padding:40}}>
        <div style={{fontSize:24,fontWeight:700,color:"#fff",marginBottom:4}}>United Towing</div>
        <div style={{fontSize:13,color:"#aaa",marginBottom:24}}>Enter access code</div>
        <input value={pin} onChange={e=>{setPin(e.target.value);setError(false);}} type="password" placeholder="Access code" autoFocus
          style={{padding:"12px 16px",fontSize:16,borderRadius:8,border:error?"2px solid #c1292e":"2px solid #444",background:"#2a2a3e",color:"#fff",width:220,textAlign:"center",outline:"none",display:"block",margin:"0 auto 12px"}} />
        <button onClick={handleSubmit} style={{...baseBtn,background:"#fff",color:C.dark,width:220}}>Enter</button>
        {error && <div style={{color:"#c1292e",fontSize:13,marginTop:10}}>Wrong code</div>}
      </div>
    </div>
  );
}

function CaptureForm({ onSubmit, onCancel }) {
  const [job, setJob] = useState(emptyJob());
  const [customCustomer, setCustomCustomer] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const update = (path,val) => {
    setJob(j => { const c=JSON.parse(JSON.stringify(j)); const k=path.split("."); let r=c; for(let i=0;i<k.length-1;i++) r=r[k[i]]; r[k[k.length-1]]=val; return c; });
  };
  const handleSubmit = async () => {
    if (!job.customer.name && !customCustomer) return;
    const final={...job};
    if(!final.price||isNaN(final.price)) final.status=STATUSES.MISSING;
    if(final.status===STATUSES.PAID) final.paidDate=new Date().toISOString();
    setSyncing(true);
    await syncToSheets(final, "add");
    onSubmit(final);
    setSyncing(false);
    setSubmitted(true);
    setTimeout(()=>{setSubmitted(false);setJob(emptyJob());setCustomCustomer(false);},1800);
  };
  if (submitted) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:48,marginBottom:12,color:C.success}}>&#10003;</div>
      <div style={{fontSize:22,fontWeight:700,color:C.dark}}>Job logged &amp; synced</div>
      <div style={{fontSize:14,color:C.muted,marginTop:4}}>Saved to Google Sheets</div></div>
    </div>
  );
  const inputStyle={width:"100%",padding:"11px 12px",fontSize:15,borderRadius:8,border:`1.5px solid ${C.border}`,background:C.white,boxSizing:"border-box",outline:"none",fontFamily:"inherit"};
  const labelStyle={fontSize:12,fontWeight:600,color:C.muted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:0.5};
  return (
    <div style={{minHeight:"100vh",background:C.bg}}>
      <div style={{background:C.dark,color:"#fff",padding:"16px 20px",textAlign:"center"}}>
        <div style={{fontSize:11,color:"#aaa",marginBottom:2}}>{new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
        <div style={{fontSize:18,fontWeight:700}}>United Towing</div>
        <div style={{fontSize:12,color:"#ccc",marginTop:2}}>Quick job capture</div>
      </div>
      <div style={{padding:"16px 20px",maxWidth:420,margin:"0 auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          <div><label style={labelStyle}>Date</label>
          <input type="date" value={job.jobDate||new Date().toISOString().split("T")[0]} onChange={e=>update("jobDate",e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Time</label>
          <input type="time" value={job.jobTime||new Date().toTimeString().slice(0,5)} onChange={e=>update("jobTime",e.target.value)} style={inputStyle} /></div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={labelStyle}>Customer / business</label>
          {!customCustomer ? (
            <select value={job.customer.name} onChange={e=>{if(e.target.value==="__new__"){setCustomCustomer(true);update("customer.name","");} else{update("customer.name",e.target.value);update("customer.isPartner",true);}}} style={{...inputStyle,appearance:"auto"}}>
              <option value="">Select partner...</option>
              {PARTNERS.map(p=><option key={p} value={p}>{p}</option>)}
              <option value="__new__">+ New customer</option>
            </select>
          ) : (
            <div style={{display:"flex",gap:6}}>
              <input value={job.customer.name} onChange={e=>update("customer.name",e.target.value)} placeholder="Customer name" style={{...inputStyle,flex:1}} />
              <button onClick={()=>{setCustomCustomer(false);update("customer.name","")}} style={{...baseBtn,padding:"8px 12px",background:C.border,color:C.dark,fontSize:12}}>Back</button>
            </div>
          )}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
          {[["Color","vehicle.color","White"],["Make","vehicle.make","Ford"],["Model","vehicle.model","E350"]].map(([l,p,ph])=>(
            <div key={p}><label style={labelStyle}>{l}</label>
            <input value={p.split(".").reduce((o,k)=>o[k],job)} onChange={e=>update(p,e.target.value)} placeholder={ph} style={inputStyle} /></div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          {[["Pickup","pickup","Bronx, NY"],["Dropoff","dropoff","JC Auto, Scarsdale"]].map(([l,k,ph])=>(
            <div key={k}><label style={labelStyle}>{l}</label>
            <input value={job[k]} onChange={e=>update(k,e.target.value)} placeholder={ph} style={inputStyle} /></div>
          ))}
        </div>
        <div style={{marginBottom:14}}>
          <label style={labelStyle}>Service type</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {SERVICE_TYPES.map(s=>(
              <span key={s} onClick={()=>update("serviceType",s)} style={{padding:"8px 14px",borderRadius:20,fontSize:13,fontWeight:600,cursor:"pointer",background:job.serviceType===s?C.dark:C.white,color:job.serviceType===s?"#fff":C.muted,border:`1.5px solid ${job.serviceType===s?C.dark:C.border}`}}>{s}</span>
            ))}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          <div><label style={labelStyle}>Price</label>
          <input value={job.price} onChange={e=>update("price",e.target.value)} placeholder="$125" type="number" inputMode="decimal" style={inputStyle} /></div>
          <div><label style={labelStyle}>Payment</label>
          <select value={job.paymentType} onChange={e=>update("paymentType",e.target.value)} style={{...inputStyle,appearance:"auto"}}>
            {PAYMENT_TYPES.map(p=><option key={p} value={p}>{p}</option>)}
          </select></div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={labelStyle}>Payment status</label>
          <div style={{display:"flex",gap:0,borderRadius:8,overflow:"hidden",border:`1.5px solid ${C.border}`}}>
            <div onClick={()=>update("status",STATUSES.PAID)}
              style={{flex:1,padding:"11px 0",textAlign:"center",fontSize:14,fontWeight:600,cursor:"pointer",
                background:job.status===STATUSES.PAID?C.success:C.white,color:job.status===STATUSES.PAID?"#fff":C.muted,transition:"all 0.15s"}}>
              Paid
            </div>
            <div onClick={()=>update("status",STATUSES.UNPAID)}
              style={{flex:1,padding:"11px 0",textAlign:"center",fontSize:14,fontWeight:600,cursor:"pointer",
                background:job.status===STATUSES.UNPAID?C.danger:C.white,color:job.status===STATUSES.UNPAID?"#fff":C.muted,
                borderLeft:`1px solid ${C.border}`,transition:"all 0.15s"}}>
              Needs Payment
            </div>
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={labelStyle}>License plate (optional)</label>
          <input value={job.vehicle.plate} onChange={e=>update("vehicle.plate",e.target.value)} placeholder="e.g. ABC 1234" style={inputStyle} />
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          <PhotoCapture label="Vehicle photo" icon="&#128247;" value={job.vehiclePhoto} onChange={v=>setJob(j=>({...j,vehiclePhoto:v}))} />
          <PhotoCapture label="Registration photo" icon="&#128196;" value={job.registrationPhoto} onChange={v=>setJob(j=>({...j,registrationPhoto:v}))} />
        </div>
        <div style={{marginBottom:16}}>
          <label style={labelStyle}>Notes (optional)</label>
          <input value={job.notes} onChange={e=>update("notes",e.target.value)} placeholder="AAA referral, paid tip, etc." style={inputStyle} />
        </div>
        <button onClick={handleSubmit} disabled={syncing} style={{...baseBtn,width:"100%",padding:14,fontSize:16,background:syncing?"#666":C.dark,color:"#fff",borderRadius:10}}>
          {syncing ? "Syncing..." : "Log job"}
        </button>
        <p style={{textAlign:"center",fontSize:11,color:C.muted,marginTop:8}}>Syncs to Google Sheets automatically</p>
        {onCancel && <button onClick={onCancel} style={{...baseBtn,width:"100%",marginTop:8,background:"transparent",color:C.muted,fontSize:13,border:`1px solid ${C.border}`}}>Back to dashboard</button>}
      </div>
    </div>
  );
}

function StatusBadge({status,price}) {
  const noPrice=!price||isNaN(price);
  const s={padding:"3px 8px",borderRadius:12,fontSize:11,fontWeight:600,whiteSpace:"nowrap",display:"inline-block"};
  if(status===STATUSES.PAID) return <span style={{...s,background:C.lightGreen,color:C.success}}>Paid</span>;
  if(noPrice) return <span style={{...s,background:C.lightYellow,color:C.warning}}>No price</span>;
  return <span style={{...s,background:C.lightRed,color:C.danger}}>Unpaid</span>;
}

function InvoicePanel({ job, onSave, onClose }) {
  const [j, setJ] = useState(JSON.parse(JSON.stringify(job)));
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const update = (path,val) => {
    setJ(prev => { const c=JSON.parse(JSON.stringify(prev)); const k=path.split("."); let r=c; for(let i=0;i<k.length-1;i++) r=r[k[i]]; r[k[k.length-1]]=val; return c; });
  };
  const price=parseFloat(j.price)||0, tolls=parseFloat(j.invoiceDetails.tolls)||0;
  const subtotal=price+tolls, tax=Math.round(subtotal*TAX_RATE*100)/100;
  const ccFee=j.paymentType==="Credit Card"?Math.round(subtotal*0.045*100)/100:0;
  const total=Math.round((subtotal+tax+ccFee)*100)/100;

  const markPaid=()=>{update("status",STATUSES.PAID);update("paidDate",new Date().toISOString());};
  const markUnpaid=()=>{update("status",STATUSES.UNPAID);update("paidDate",null);};

  const handleSave = async () => {
    setSaving(true);
    const saved={...j,invoiceDetails:{...j.invoiceDetails,subtotal,tax,total,ccFee},receiptGenerated:true};
    // Send update to sheets (overwrites the row with this ID)
    const ok = await syncToSheets(saved, "update");
    onSave(saved);
    setSaveMsg(ok ? "Saved & synced" : "Saved locally (sync failed)");
    setSaving(false);
    setTimeout(()=>setSaveMsg(""),2000);
  };

  const handleGeneratePDF = async () => {
    setGenerating(true);
    try { await generateInvoicePDF({...j, invoiceDetails:{...j.invoiceDetails, subtotal, tax, total, ccFee, tolls}}); }
    catch(err) { console.error("PDF error:", err); alert("Error generating PDF"); }
    setGenerating(false);
  };

  const labelStyle={fontSize:11,fontWeight:600,color:C.muted,display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:0.5};
  const inputStyle={width:"100%",padding:"9px 10px",fontSize:14,borderRadius:6,border:`1.5px solid ${C.border}`,background:C.white,boxSizing:"border-box",fontFamily:"inherit"};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.white,borderRadius:12,width:"100%",maxWidth:600,maxHeight:"90vh",overflow:"auto",padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h3 style={{margin:0,fontSize:18,fontWeight:700,color:C.dark}}>Edit job / invoice</h3>
          <button onClick={onClose} style={{...baseBtn,padding:"6px 12px",background:C.border,color:C.dark,fontSize:12}}>Close</button>
        </div>

        {/* Date & Time - editable */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          <div><label style={labelStyle}>Date</label>
          <input type="date" value={j.jobDate} onChange={e=>update("jobDate",e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Time</label>
          <input type="time" value={j.jobTime} onChange={e=>update("jobTime",e.target.value)} style={inputStyle} /></div>
        </div>

        {(j.vehiclePhoto||j.registrationPhoto)&&(
          <div style={{display:"grid",gridTemplateColumns:j.vehiclePhoto&&j.registrationPhoto?"1fr 1fr":"1fr",gap:8,marginBottom:14}}>
            {j.vehiclePhoto&&<div><div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Vehicle photo</div><img src={j.vehiclePhoto} alt="Vehicle" style={{width:"100%",height:120,objectFit:"cover",borderRadius:6}} /></div>}
            {j.registrationPhoto&&<div><div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Registration</div><img src={j.registrationPhoto} alt="Registration" style={{width:"100%",height:120,objectFit:"cover",borderRadius:6}} /></div>}
          </div>
        )}

        <div style={{background:C.bg,borderRadius:8,padding:14,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700,color:C.dark,marginBottom:10}}>Vehicle details</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
            {[["Year","vehicle.year"],["Color","vehicle.color"],["Make","vehicle.make"],["Model","vehicle.model"]].map(([l,p])=>(
              <div key={p}><label style={labelStyle}>{l}</label>
              <input value={p.split(".").reduce((o,k)=>o[k],j)} onChange={e=>update(p,e.target.value)} style={inputStyle} /></div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
            <div><label style={labelStyle}>VIN</label><input value={j.vehicle.vin} onChange={e=>update("vehicle.vin",e.target.value)} placeholder="From registration photo" style={inputStyle} /></div>
            <div><label style={labelStyle}>Plate</label><input value={j.vehicle.plate} onChange={e=>update("vehicle.plate",e.target.value)} style={inputStyle} /></div>
          </div>
        </div>

        <div style={{background:C.bg,borderRadius:8,padding:14,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700,color:C.dark,marginBottom:10}}>Customer</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><label style={labelStyle}>Name</label><input value={j.customer.name} onChange={e=>update("customer.name",e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Phone</label><input value={j.customer.phone} onChange={e=>update("customer.phone",e.target.value)} placeholder="347-722-0502" style={inputStyle} /></div>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          <div><label style={labelStyle}>Pickup</label><input value={j.pickup} onChange={e=>update("pickup",e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Dropoff</label><input value={j.dropoff} onChange={e=>update("dropoff",e.target.value)} style={inputStyle} /></div>
        </div>

        <div style={{marginBottom:14}}>
          <label style={labelStyle}>Service type</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {SERVICE_TYPES.map(s=>(
              <span key={s} onClick={()=>update("serviceType",s)} style={{padding:"6px 12px",borderRadius:16,fontSize:12,fontWeight:600,cursor:"pointer",background:j.serviceType===s?C.dark:C.white,color:j.serviceType===s?"#fff":C.muted,border:`1.5px solid ${j.serviceType===s?C.dark:C.border}`}}>{s}</span>
            ))}
          </div>
        </div>

        <div style={{background:C.bg,borderRadius:8,padding:14,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700,color:C.dark,marginBottom:10}}>Pricing</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
            <div><label style={labelStyle}>Service price</label><input value={j.price} onChange={e=>update("price",e.target.value)} type="number" style={inputStyle} /></div>
            <div><label style={labelStyle}>Tolls</label><input value={j.invoiceDetails.tolls} onChange={e=>update("invoiceDetails.tolls",e.target.value)} type="number" placeholder="0" style={inputStyle} /></div>
            <div><label style={labelStyle}>Payment type</label><select value={j.paymentType} onChange={e=>update("paymentType",e.target.value)} style={{...inputStyle,appearance:"auto"}}>{PAYMENT_TYPES.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
          </div>
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10,fontSize:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.muted}}>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.muted}}>Tax (8.375%)</span><span>{formatMoney(tax)}</span></div>
            {ccFee>0&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.muted}}>CC fee (4.5%)</span><span>{formatMoney(ccFee)}</span></div>}
            <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:16,marginTop:6}}><span>Total due</span><span style={{color:C.accent}}>{formatMoney(total)}</span></div>
          </div>
        </div>

        <div style={{marginBottom:14}}><label style={labelStyle}>Notes</label><textarea value={j.notes} onChange={e=>update("notes",e.target.value)} rows={2} style={{...inputStyle,resize:"vertical"}} /></div>

        {/* Payment status toggle */}
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",gap:0,borderRadius:8,overflow:"hidden",border:`1.5px solid ${C.border}`}}>
            <div onClick={markPaid}
              style={{flex:1,padding:"11px 0",textAlign:"center",fontSize:14,fontWeight:600,cursor:"pointer",
                background:j.status===STATUSES.PAID?C.success:C.white,color:j.status===STATUSES.PAID?"#fff":C.muted,transition:"all 0.15s"}}>
              Paid
            </div>
            <div onClick={markUnpaid}
              style={{flex:1,padding:"11px 0",textAlign:"center",fontSize:14,fontWeight:600,cursor:"pointer",
                background:j.status===STATUSES.UNPAID?C.danger:C.white,color:j.status===STATUSES.UNPAID?"#fff":C.muted,
                borderLeft:`1px solid ${C.border}`,transition:"all 0.15s"}}>
              Unpaid
            </div>
          </div>
        </div>

        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <button onClick={handleSave} disabled={saving}
            style={{...baseBtn,flex:1,background:saving?"#666":C.dark,color:"#fff"}}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
        {saveMsg && <div style={{textAlign:"center",fontSize:13,color:C.success,fontWeight:600,marginBottom:8}}>{saveMsg}</div>}

        <button onClick={handleGeneratePDF} disabled={generating}
          style={{...baseBtn,width:"100%",padding:12,fontSize:14,background:generating?"#666":"#b35900",color:"#fff",borderRadius:8}}>
          {generating ? "Generating..." : "Generate Invoice PDF"}
        </button>

        {j.status===STATUSES.PAID&&j.paidDate&&<div style={{textAlign:"center",marginTop:10,fontSize:13,color:C.success,fontWeight:600}}>Paid on {formatDate(j.paidDate)}</div>}
      </div>
    </div>
  );
}

function Dashboard({ jobs, setJobs, onNewJob, onLogout, loading, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("action");
  const [search, setSearch] = useState("");
  const unpaidJobs=jobs.filter(j=>j.status!==STATUSES.PAID&&j.price&&!isNaN(j.price));
  const missingJobs=jobs.filter(j=>!j.price||isNaN(j.price));
  const paidJobs=jobs.filter(j=>j.status===STATUSES.PAID);
  const totalCollected=paidJobs.reduce((s,j)=>s+(parseFloat(j.price)||0),0);
  const totalUnpaid=unpaidJobs.reduce((s,j)=>s+(parseFloat(j.price)||0),0);
  const aging={"0-30":0,"30-60":0,"60-90":0,"90+":0};
  unpaidJobs.forEach(j=>{const d=daysSince(j.createdAt);if(d<=30)aging["0-30"]++;else if(d<=60)aging["30-60"]++;else if(d<=90)aging["60-90"]++;else aging["90+"]++;});
  const accountMap={};
  unpaidJobs.forEach(j=>{const name=j.customer.name||"Unknown";if(!accountMap[name])accountMap[name]={count:0,total:0,oldest:j.createdAt};accountMap[name].count++;accountMap[name].total+=parseFloat(j.price)||0;if(new Date(j.createdAt)<new Date(accountMap[name].oldest))accountMap[name].oldest=j.createdAt;});
  const topAccounts=Object.entries(accountMap).sort((a,b)=>b[1].total-a[1].total).slice(0,6);
  let filtered=jobs;
  if(filter==="action") filtered=jobs.filter(j=>j.status!==STATUSES.PAID);
  else if(filter==="unpaid") filtered=unpaidJobs;
  else if(filter==="missing") filtered=missingJobs;
  else if(filter==="paid") filtered=paidJobs;
  if(search){const s=search.toLowerCase();filtered=filtered.filter(j=>(j.customer.name||"").toLowerCase().includes(s)||(j.vehicle.make||"").toLowerCase().includes(s)||(j.vehicle.model||"").toLowerCase().includes(s)||(j.vehicle.color||"").toLowerCase().includes(s)||(j.pickup||"").toLowerCase().includes(s)||(j.dropoff||"").toLowerCase().includes(s));}
  filtered=[...filtered].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  const handleSave = async (updated) => {
    setJobs(prev => {
      const next = prev.map(j => j.id === updated.id ? updated : j);
      cacheJobs(next);
      return next;
    });
    setEditing(null);
  };

  const maxAging=Math.max(...Object.values(aging),1);
  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div><div style={{fontSize:18,fontWeight:700,color:C.dark}}>United Towing &amp; Transport</div><div style={{fontSize:12,color:C.muted}}>Invoicing dashboard {loading && " \u2014 loading..."}</div></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onRefresh} style={{...baseBtn,background:C.bg,color:C.muted,fontSize:12,padding:"8px 12px"}} title="Refresh from Google Sheets">{loading ? "\u23F3" : "\u21BB"}</button>
          <button onClick={onNewJob} style={{...baseBtn,background:C.dark,color:"#fff",fontSize:13}}>+ Log new job</button>
          <button onClick={onLogout} style={{...baseBtn,background:C.border,color:C.muted,fontSize:12}}>Logout</button>
        </div>
      </div>
      <div style={{padding:"20px 24px",maxWidth:1200,margin:"0 auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:20}}>
          {[{label:"Total jobs",val:jobs.length,sub:"all time",bg:C.bg,color:C.dark},{label:"Collected",val:"$"+Math.round(totalCollected).toLocaleString(),sub:`${paidJobs.length} paid`,bg:C.lightGreen,color:C.success},{label:"Unpaid",val:"$"+Math.round(totalUnpaid).toLocaleString(),sub:`${unpaidJobs.length} jobs`,bg:C.lightRed,color:C.danger},{label:"Missing info",val:missingJobs.length,sub:"no price",bg:C.lightYellow,color:C.warning}].map((mt,i)=>(
            <div key={i} style={{background:mt.bg,borderRadius:10,padding:"12px 14px",overflow:"hidden"}}>
              <div style={{fontSize:11,fontWeight:600,color:mt.color,textTransform:"uppercase",letterSpacing:0.5}}>{mt.label}</div>
              <div style={{fontSize:22,fontWeight:700,color:mt.color,marginTop:2}}>{mt.val}</div>
              <div style={{fontSize:11,color:mt.color,opacity:0.7}}>{mt.sub}</div>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr",gap:16,marginBottom:20}}>
          <div style={{background:C.white,borderRadius:10,padding:"16px 20px",boxShadow:C.cardShadow}}>
            <div style={{fontSize:15,fontWeight:700,color:C.dark,marginBottom:12}}>Top unpaid accounts</div>
            {topAccounts.length===0?<div style={{fontSize:13,color:C.muted,padding:16,textAlign:"center"}}>No unpaid accounts</div>:
            topAccounts.map(([name,data],i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<topAccounts.length-1?`1px solid ${C.border}`:"none"}}>
                <div><div style={{fontSize:14,fontWeight:600,color:C.dark}}>{name}</div><div style={{fontSize:11,color:C.muted}}>{data.count} unpaid</div></div>
                <div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:600,color:C.danger}}>{formatMoney(data.total)}</div><div style={{fontSize:11,color:C.danger}}>{daysSince(data.oldest)}d</div></div>
              </div>
            ))}
          </div>
          <div style={{background:C.white,borderRadius:10,padding:"16px 20px",boxShadow:C.cardShadow}}>
            <div style={{fontSize:15,fontWeight:700,color:C.dark,marginBottom:12}}>Aging receivables</div>
            {[{label:"0-30 days",count:aging["0-30"],color:C.success},{label:"30-60 days",count:aging["30-60"],color:C.warning},{label:"60-90 days",count:aging["60-90"],color:"#D85A30"},{label:"90+ days",count:aging["90+"],color:C.danger}].map((a,i)=>(
              <div key={i} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted,marginBottom:4}}><span>{a.label}</span><span>{a.count} job{a.count!==1?"s":""}</span></div>
                <div style={{height:14,borderRadius:4,background:C.bg,overflow:"hidden"}}><div style={{width:`${Math.round((a.count/maxAging)*100)}%`,height:"100%",background:a.color,borderRadius:4}} /></div>
              </div>
            ))}
            <div style={{fontSize:12,color:C.muted,marginTop:8,paddingTop:10,borderTop:`1px solid ${C.border}`}}>Target: collect within 30 days</div>
          </div>
        </div>
        <div style={{background:C.white,borderRadius:10,padding:"16px 20px",boxShadow:C.cardShadow}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
            <div style={{fontSize:15,fontWeight:700,color:C.dark}}>Jobs</div>
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{padding:"6px 10px",fontSize:13,borderRadius:6,border:`1px solid ${C.border}`,width:140}} />
              {["action","unpaid","missing","paid","all"].map(f=>(
                <span key={f} onClick={()=>setFilter(f)} style={{padding:"4px 10px",borderRadius:14,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",background:filter===f?C.dark:C.bg,color:filter===f?"#fff":C.muted}}>{f==="action"?"Action":f.charAt(0).toUpperCase()+f.slice(1)}</span>
              ))}
            </div>
          </div>
          <div>
            {filtered.slice(0,50).map(j=>(
              <div key={j.id} onClick={()=>setEditing(j)} style={{padding:"12px 0",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:C.dark}}>{[j.vehicle.color,j.vehicle.make,j.vehicle.model].filter(Boolean).join(" ")||"No vehicle info"}</div>
                    <div style={{fontSize:13,color:C.muted,marginTop:2}}>{j.customer.name||"No customer"} &middot; {formatDate(j.jobDate||j.createdAt)}</div>
                  </div>
                  <div style={{textAlign:"right",marginLeft:12}}>
                    <div style={{fontSize:15,fontWeight:700}}>{j.price&&!isNaN(j.price)?formatMoney(j.price):<span style={{color:C.warning,fontSize:13}}>No price</span>}</div>
                    <div style={{marginTop:4}}><StatusBadge status={j.status} price={j.price} /></div>
                  </div>
                </div>
                {(j.pickup||j.dropoff)&&<div style={{fontSize:12,color:C.muted}}>{[j.pickup,j.dropoff].filter(Boolean).join(" \u2192 ")}</div>}
              </div>
            ))}
          </div>
          {filtered.length>50&&<div style={{textAlign:"center",padding:12,fontSize:12,color:C.muted}}>Showing 50 of {filtered.length}</div>}
          {filtered.length===0&&<div style={{textAlign:"center",padding:24,fontSize:14,color:C.muted}}>No jobs match this filter</div>}
        </div>
      </div>
      {editing&&<InvoicePanel job={editing} onSave={handleSave} onClose={()=>setEditing(null)} />}
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(()=>localStorage.getItem("ut-auth")==="1");
  const [jobs, setJobs] = useState([]);
  const [view, setView] = useState("dashboard");
  const [loading, setLoading] = useState(false);

  // Load jobs: try sheets first, fall back to cache
  const loadFromSheets = useCallback(async () => {
    setLoading(true);
    const sheetJobs = await fetchJobsFromSheets();
    if (sheetJobs && sheetJobs.length > 0) {
      setJobs(sheetJobs);
      cacheJobs(sheetJobs);
    } else {
      // Fall back to local cache
      const cached = loadCache();
      if (cached.length > 0) setJobs(cached);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authed) loadFromSheets();
  }, [authed, loadFromSheets]);

  const addJob = useCallback((job) => {
    setJobs(prev => {
      const next = [...prev, job];
      cacheJobs(next);
      return next;
    });
    setView("dashboard");
  }, []);

  const handleLogout = () => { localStorage.removeItem("ut-auth"); setAuthed(false); };

  if (!authed) return <PasswordGate onAuth={()=>setAuthed(true)} />;
  if (view==="capture") return <CaptureForm onSubmit={addJob} onCancel={()=>setView("dashboard")} />;
  return <Dashboard jobs={jobs} setJobs={setJobs} onNewJob={()=>setView("capture")} onLogout={handleLogout} loading={loading} onRefresh={loadFromSheets} />;
}
