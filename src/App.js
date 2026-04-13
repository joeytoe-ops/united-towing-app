import React, { useState, useEffect, useCallback, useRef } from "react";

const APP_PIN = "united149";

const PARTNERS = [
  "JC Auto","Gabe Citgo","Karls Auto Body","Tasca Ford","Hartsdale Mobil",
  "RDI Property Group","NFA Towing","German Car","Mancuso Auto Body",
  "Cruz Control Auto","Vasco Tech Center","Performance Auto","Preferred Auto Service",
  "Sal's Auto","Ferry Auto","Yonkers Auto Gallery","Renzo Auto","Tierney Auto",
  "Caldarola Auto Body","Frank Donato Construction","Lenny's Auto"
];

// These match the PDF invoice line items exactly
const SERVICE_LINE_ITEMS = [
  { key:"towing", label:"Towing" },
  { key:"waiting", label:"Waiting Time" },
  { key:"winch", label:"Winch" },
  { key:"road_service", label:"Road Service" },
  { key:"gate_fee", label:"Gate Fee" },
  { key:"admin_fee", label:"Admin Fee" },
  { key:"storage", label:"Storage" }
];

const PAYMENT_TYPES = ["Cash","Zelle","Check","Credit Card","Invoice Later","Pending Insurance"];
const STATUSES = { PAID:"paid", UNPAID:"unpaid", MISSING:"missing" };
const TAX_RATE = 0.08375;
const CC_FEE_RATE = 0.045;

function generateId() { return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function formatDate(d) { if(!d) return "\u2014"; const dt=new Date(d); return isNaN(dt)? "\u2014" : `${dt.getMonth()+1}/${dt.getDate()}/${String(dt.getFullYear()).slice(2)}`; }
function formatMoney(n) { if(n==null||isNaN(n)) return "\u2014"; return "$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function daysSince(d) { if(!d) return 0; const ms = Date.now()-new Date(d).getTime(); return isNaN(ms) ? 0 : Math.floor(ms/86400000); }

// Calculate totals from services object
function calcTotals(services, tolls, paymentType) {
  const svc = services || {};
  const subtotal = SERVICE_LINE_ITEMS.reduce((sum, item) => sum + (parseFloat(svc[item.key]) || 0), 0) + (parseFloat(tolls) || 0);
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const ccFee = paymentType === "Credit Card" ? Math.round(subtotal * CC_FEE_RATE * 100) / 100 : 0;
  const total = Math.round((subtotal + tax + ccFee) * 100) / 100;
  // "price" = sum of just the service items (no tolls/tax/cc) for backward compat
  const serviceTotal = SERVICE_LINE_ITEMS.reduce((sum, item) => sum + (parseFloat(svc[item.key]) || 0), 0);
  return { subtotal, tax, ccFee, total, serviceTotal };
}

const emptyJob = () => ({
  id:generateId(), createdAt:new Date().toISOString(),
  jobDate:new Date().toISOString().split("T")[0],
  jobTime:new Date().toTimeString().slice(0,5),
  vehicle:{color:"",make:"",model:"",year:"",vin:"",plate:""},
  customer:{name:"",phone:"",isPartner:false},
  owner:{name:"",homePhone:"",workPhone:""},
  pickup:"", pickupCity:"", dropoff:"", dropoffCity:"",
  services:{}, // { towing: "150", winch: "75", etc }
  price:"", // legacy single-price field, also used as display total
  paymentType:"Cash",
  tolls:"",
  poNumber:"", raNumber:"",
  status:STATUSES.UNPAID, notes:"",
  vehiclePhoto:null, registrationPhoto:null,
  receiptGenerated:false, paidDate:null,
  source:"app"
});

// --- DATA LAYER ---
const CACHE_KEY = "ut-jobs-v3";
function cacheJobs(jobs) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(jobs)); } catch {} }
function loadCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)||"[]"); } catch { return []; } }

function rowToJob(row) {
  const id = row[0] || generateId();
  const rawDate = row[1] || "";
  const jobDate = rawDate ? new Date(rawDate).toISOString().split("T")[0] : "";
  const rawTime = row[2] || "";
  let jobTime = "";
  if (rawTime) {
    try { const td = new Date(rawTime); jobTime = td.getUTCHours().toString().padStart(2,"0") + ":" + td.getUTCMinutes().toString().padStart(2,"0"); }
    catch { jobTime = String(rawTime).slice(0,5); }
  }
  const status = (row[16]||"").toLowerCase();
  // Try to parse services from the "service" column (could be JSON or legacy single value)
  let services = {};
  const svcRaw = row[13] || "";
  try { services = JSON.parse(svcRaw); } catch { if (svcRaw) services = { towing: row[14] || "" }; }
  // Parse extended fields from notes JSON if present
  let extra = {};
  const notesRaw = row[17] || "";
  try {
    if (notesRaw.startsWith("{")) { extra = JSON.parse(notesRaw); }
  } catch {}

  return {
    id, createdAt: jobDate ? new Date(jobDate + "T12:00:00").toISOString() : new Date().toISOString(),
    jobDate, jobTime,
    vehicle: { color: row[3]||"", make: row[4]||"", model: row[5]||"", year: row[6]||"", vin: row[7]||"", plate: row[8]||"" },
    customer: { name: row[9]||"", phone: row[10]||"", isPartner: PARTNERS.includes(row[9]||"") },
    owner: extra.owner || {name:"",homePhone:"",workPhone:""},
    pickup: row[11]||"", pickupCity: extra.pickupCity || "",
    dropoff: row[12]||"", dropoffCity: extra.dropoffCity || "",
    services, price: row[14]||"", paymentType: row[15]||"Cash",
    tolls: extra.tolls || "", poNumber: extra.poNumber || "", raNumber: extra.raNumber || "",
    status: status === "paid" ? STATUSES.PAID : ((!row[14] || row[14]==="") ? STATUSES.MISSING : STATUSES.UNPAID),
    notes: extra.notes != null ? extra.notes : (notesRaw.startsWith("{") ? "" : notesRaw),
    vehiclePhoto: null, registrationPhoto: null,
    receiptGenerated: false,
    paidDate: status === "paid" ? (jobDate ? new Date(jobDate+"T12:00:00").toISOString() : null) : null,
    source: "app"
  };
}

function legacyToJob(row) {
  const jobNum = String(row.jobNumber || "");
  const jobName = String(row.jobName || "");
  const rawDate = row.date || "";
  let jobDate = "";
  if (rawDate) { try { jobDate = new Date(rawDate).toISOString().split("T")[0]; } catch {} }
  const payout = row.payout;
  const payType = String(row.paymentType || "");
  const receipt = String(row.receiptStatus || "").toLowerCase();
  const notes = String(row.notes || "");
  const parts = jobName.trim().split(/\s+/);
  let color = "", make = "", model = "";
  if (parts.length >= 3) { color = parts[0]; make = parts[1]; model = parts.slice(2).join(" "); }
  else if (parts.length === 2) { make = parts[0]; model = parts[1]; }
  else if (parts.length === 1) { make = parts[0]; }
  const isPaid = receipt.includes("paid") || receipt === "yes" || receipt === "y" || (payType && payType !== "" && !receipt.includes("missing") && !receipt.includes("needs") && !receipt.includes("unpaid") && !receipt.includes("no"));
  const hasPrice = payout && !isNaN(parseFloat(payout)) && parseFloat(payout) > 0;
  const needsPay = receipt.includes("needs") || receipt.includes("unpaid") || receipt.includes("no");
  let status = STATUSES.MISSING;
  if (hasPrice && isPaid && !needsPay) status = STATUSES.PAID;
  else if (hasPrice) status = STATUSES.UNPAID;
  let customerName = "";
  const combined = (jobName + " " + notes).toLowerCase();
  for (const p of PARTNERS) { if (combined.includes(p.toLowerCase())) { customerName = p; break; } }
  return {
    id: "legacy-" + jobNum, createdAt: jobDate ? new Date(jobDate + "T12:00:00").toISOString() : new Date().toISOString(),
    jobDate, jobTime: "",
    vehicle: { color, make, model, year: "", vin: "", plate: "" },
    customer: { name: customerName, phone: "", isPartner: !!customerName },
    owner:{name:"",homePhone:"",workPhone:""},
    pickup: "", pickupCity: "", dropoff: "", dropoffCity: "",
    services: hasPrice ? { towing: parseFloat(payout) } : {},
    price: hasPrice ? parseFloat(payout) : "", paymentType: payType || "Cash",
    tolls:"", poNumber:"", raNumber:"",
    status, notes: notes + (jobName && !customerName ? " [" + jobName + "]" : ""),
    vehiclePhoto: null, registrationPhoto: null, receiptGenerated: false,
    paidDate: status === STATUSES.PAID ? (jobDate ? new Date(jobDate+"T12:00:00").toISOString() : null) : null,
    source: "legacy", legacyJobNumber: jobNum,
    legacyRaw: { jobName, receiptStatus: row.receiptStatus, paymentType: row.paymentType }
  };
}

function jobToPayload(job, action) {
  // Store extended fields as JSON in the notes column
  const extendedNotes = JSON.stringify({
    notes: job.notes || "",
    owner: job.owner || {},
    pickupCity: job.pickupCity || "",
    dropoffCity: job.dropoffCity || "",
    tolls: job.tolls || "",
    poNumber: job.poNumber || "",
    raNumber: job.raNumber || ""
  });
  const svcTotal = SERVICE_LINE_ITEMS.reduce((sum, item) => sum + (parseFloat((job.services||{})[item.key]) || 0), 0);
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
    service: JSON.stringify(job.services || {}),
    price: svcTotal || job.price || "",
    payment: job.paymentType || "",
    status: job.status || "",
    notes: extendedNotes,
    test: job.isTest || false
  };
}

async function fetchJobsFromSheets() {
  try {
    const response = await fetch("/api/sync");
    const data = await response.json();
    const result = { appJobs: [], legacyJobs: [] };
    if (data.appJobs && Array.isArray(data.appJobs)) result.appJobs = data.appJobs.map(rowToJob);
    if (data.legacyJobs && Array.isArray(data.legacyJobs)) result.legacyJobs = data.legacyJobs.map(legacyToJob);
    if (data.jobs && Array.isArray(data.jobs) && !data.appJobs) result.appJobs = data.jobs.map(rowToJob);
    return result;
  } catch (err) { console.error("Failed to fetch:", err); return null; }
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
      s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const w = 612, m = 36, pw = w - 2 * m;
  let y = m;
  const dark = [26, 26, 46], blue = [26, 10, 110], wh = [255, 255, 255];
  const svc = job.services || {};
  const tollsAmt = parseFloat(job.tolls) || 0;
  const svcTotal = SERVICE_LINE_ITEMS.reduce((sum, item) => sum + (parseFloat(svc[item.key]) || 0), 0);
  const subtotal = svcTotal + tollsAmt;
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const ccf = job.paymentType === "Credit Card" ? Math.round(subtotal * CC_FEE_RATE * 100) / 100 : 0;
  const tot = Math.round((subtotal + tax + ccf) * 100) / 100;

  function box(x, by, bw, bh, label, value, vs) {
    vs = vs || 10;
    doc.setDrawColor(51); doc.setLineWidth(0.5); doc.rect(x, by, bw, bh);
    doc.setFontSize(6); doc.setFont("helvetica","normal"); doc.setTextColor(...dark);
    doc.text(label, x+3, by+8);
    if (value) { doc.setFontSize(vs); doc.setFont("helvetica","bold"); doc.setTextColor(...blue); doc.text(String(value), x+4, by+bh-4); doc.setTextColor(...dark); }
  }
  function cb(x, cy, checked) {
    doc.rect(x, cy, 9, 9);
    if (checked) { doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.text("X", x+2, cy+7.5); }
  }

  // Header
  doc.setFillColor(...dark); doc.rect(m, y, pw, 32, "F");
  doc.setTextColor(...wh); doc.setFontSize(22); doc.setFont("helvetica","bold");
  doc.text("24 HOUR TOWING", w/2, y+24, {align:"center"}); y += 38;
  doc.setTextColor(...dark); doc.setFontSize(20); doc.text("UNITED", w/2, y+14, {align:"center"}); y += 18;
  doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.text("TOWING & TRANSPORT", w/2, y+9, {align:"center"}); y += 14;
  doc.setFontSize(8); doc.text('"Local & Long Distance"     "Flatbed Specialists"', w/2, y+8, {align:"center"}); y += 12;
  doc.setFontSize(7);
  doc.text("Towing \u2022 Emergency Starting \u2022 Battery Service \u2022 Flat Tire Service", w/2, y+7, {align:"center"}); y += 9;
  doc.text("Vehicle Locksmith Services \u2022 Unauthorized Tows \u2022 Fuel Delivery", w/2, y+7, {align:"center"}); y += 14;
  doc.setFillColor(232,232,224); doc.rect(m, y, pw, 24, "FD");
  doc.setTextColor(...dark); doc.setFontSize(16); doc.setFont("helvetica","bold");
  doc.text("914-500-5570", w/2, y+18, {align:"center"}); y += 25;

  // Date / Time
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

  // Customer / phone
  box(m, y, dw, rh, "CUSTOMER:", job.customer?.name||"");
  box(m+dw, y, tw, rh, "PHONE:", job.customer?.phone||""); y += rh;
  // Pickup
  box(m, y, dw, rh, "PICKUP LOCATION:", job.pickup||"");
  box(m+dw, y, tw, rh, "CITY:", job.pickupCity||""); y += rh;
  // Dropoff
  box(m, y, dw, rh, "DELIVERY LOCATION:", job.dropoff||"");
  box(m+dw, y, tw, rh, "CITY:", job.dropoffCity||""); y += rh;
  // Vehicle row
  var vc = [["YR:",job.vehicle?.year,0.10],["MAKE:",job.vehicle?.make,0.14],["MODEL:",job.vehicle?.model,0.14],["COLOR:",job.vehicle?.color,0.14],["VIN:",job.vehicle?.vin,0.48]];
  var vx = m; vc.forEach(function(v){box(vx, y, pw*v[2], rh, v[0], v[1]||"", 9); vx += pw*v[2];}); y += rh;
  // Owner row
  var oc = [["VEHICLE OWNER:",job.owner?.name||"",0.30],["HOME PHONE:",job.owner?.homePhone||"",0.22],["WORK PHONE:",job.owner?.workPhone||"",0.22],["LIC. NO.:",job.vehicle?.plate,0.26]];
  var ox = m; oc.forEach(function(o){box(ox, y, pw*o[2], rh, o[0], o[1]||"", 9); ox += pw*o[2];}); y += rh+3;

  // Remarks + Services side by side
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

  var pdfRows = [["TOWING","towing"],["WAITING TIME","waiting"],["WINCH","winch"],["ROAD SERVICE","road_service"],["GATE FEE","gate_fee"],["ADMIN FEE","admin_fee"],["STORAGE","storage"],["SUBTOTAL","_sub"],["TAX","_tax"],["TOLLS","_tolls"],["CC PROCESS FEE (4.5%)","_cc"],["TOTAL DUE","_total"]];
  var sy2 = y+hh;
  pdfRows.forEach(function(r) {
    doc.setDrawColor(51); doc.setLineWidth(0.5); doc.rect(sx, sy2, sw, sr);
    var val = "";
    if (r[1]==="_sub") val = subtotal>0?subtotal.toFixed(2):"";
    else if (r[1]==="_tax") val = tax>0?tax.toFixed(2):"";
    else if (r[1]==="_tolls") val = tollsAmt>0?tollsAmt.toFixed(2):"";
    else if (r[1]==="_cc") val = ccf>0?ccf.toFixed(2):"";
    else if (r[1]==="_total") val = tot>0?tot.toFixed(2):"";
    else { var sv = parseFloat(svc[r[1]])||0; if (sv>0) val = sv.toFixed(2); }
    cb(sx+5, sy2+5, !!val);
    var it = r[0]==="TOTAL DUE";
    doc.setFontSize(8); doc.setFont("helvetica", it?"bold":"normal"); doc.setTextColor(...dark);
    doc.text(r[0], sx+20, sy2+sr-6);
    if (val) { doc.setFontSize(it?11:10); doc.setFont("helvetica","bold"); doc.setTextColor(...blue); doc.text(val, sx+sw-6, sy2+sr-5, {align:"right"}); doc.setTextColor(...dark); }
    sy2 += sr;
  });
  y += hh+bh+3;

  // Damage waiver + payment method
  var lw = pw*0.52, rw2 = pw*0.48, blh = 52;
  doc.rect(m, y, lw, blh);
  doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.text("DAMAGE WAIVER", m+lw/2, y+12, {align:"center"});
  doc.setFontSize(5.5); doc.setFont("helvetica","normal");
  ["I acknowledge towing or servicing the above referenced vehicle may result","in damage or loss, including loss or theft of personal items. I assume","full responsibility and release United Towing & Transport LLC and it's","representatives from any liability."].forEach(function(l,i){doc.text(l, m+4, y+22+i*7);});
  doc.rect(m+lw, y, rw2, blh);
  doc.setFontSize(8); var py2 = y+14;
  ["CASH","CK#","CHARGE ACCOUNT"].forEach(function(pm){
    cb(m+lw+8, py2-3, pay.toUpperCase()===pm.split("#")[0].trim());
    doc.setFont("helvetica","normal"); doc.text(pm, m+lw+20, py2+4); py2 += 12;
  });
  y += blh+2;

  // PO# / RA#
  var hw = pw*0.50;
  box(m, y, hw, 20, "P.O.#", job.poNumber||"");
  box(m+hw, y, hw, 20, "R.A.#", job.raNumber||"");
  y += 23;

  doc.setFontSize(7); doc.text("x ___________________________________", m, y+8);
  doc.text("OWNER / AGENT", m+20, y+16); y += 22;

  // Acknowledgment
  doc.rect(m, y, lw, 36);
  doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.text("ACKNOWLEDGMENT", m+lw/2, y+10, {align:"center"});
  doc.setFontSize(5.5); doc.setFont("helvetica","normal");
  doc.text("I acknowledge receipt of the above referenced vehicle and hereby", m+4, y+20);
  doc.text("release United Towing & Transport LLC from all liability.", m+4, y+27);
  y += 38;
  doc.setFontSize(7); doc.text("x ___________________________________", m, y+8);
  doc.text("OWNER / AGENT", m+20, y+16); y += 22;

  // Total bar
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
  lightYellow:"#fff8e7",lightBlue:"#e3f2fd",cardShadow:"0 1px 3px rgba(0,0,0,0.06)"
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
    if (e) e.preventDefault();
    if (pin.toLowerCase()===APP_PIN) { localStorage.setItem("ut-auth","1"); onAuth(); }
    else { setError(true); setTimeout(()=>setError(false),2000); }
  };
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.dark}}>
      <div onKeyDown={e=>{if(e.key==="Enter")handleSubmit()}} style={{textAlign:"center",padding:40}}>
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

// --- SERVICE PRICING COMPONENT ---
function ServicePricing({ services, onChange, compact }) {
  const svc = services || {};
  const updateSvc = (key, val) => onChange({...svc, [key]: val});
  const activeCount = SERVICE_LINE_ITEMS.filter(i => parseFloat(svc[i.key]) > 0).length;
  return (
    <div>
      <div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>
        Services {activeCount > 0 && `(${activeCount} selected)`}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:4}}>
        {SERVICE_LINE_ITEMS.map(item => {
          const val = svc[item.key] || "";
          const active = parseFloat(val) > 0;
          return (
            <div key={item.key} style={{display:"flex",alignItems:"center",gap:8,padding:compact?"6px 0":"8px 0"}}>
              <div onClick={()=>{if(!active)updateSvc(item.key,"");else updateSvc(item.key,"");}}
                style={{flex:1,fontSize:compact?13:14,fontWeight:active?600:400,color:active?C.dark:C.muted}}>
                {item.label}
              </div>
              <input
                value={val}
                onChange={e=>updateSvc(item.key,e.target.value)}
                placeholder="$"
                type="number" inputMode="decimal"
                style={{width:90,padding:"7px 8px",fontSize:14,borderRadius:6,border:`1.5px solid ${active?C.accent:C.border}`,background:active?"#f0faf4":C.white,textAlign:"right",boxSizing:"border-box",fontFamily:"inherit",fontWeight:active?600:400}}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CaptureForm({ onSubmit, onCancel }) {
  const [job, setJob] = useState(emptyJob());
  const [customCustomer, setCustomCustomer] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [expanded, setExpanded] = useState(false); // show optional fields
  const update = (path,val) => {
    setJob(j => { const c=JSON.parse(JSON.stringify(j)); const k=path.split("."); let r=c; for(let i=0;i<k.length-1;i++) r=r[k[i]]; r[k[k.length-1]]=val; return c; });
  };
  const { subtotal, tax, ccFee, total, serviceTotal } = calcTotals(job.services, job.tolls, job.paymentType);

  const handleSubmit = async () => {
    if (!job.customer.name && !customCustomer) return;
    const final={...job, price: serviceTotal || job.price, isTest: testMode};
    if(!serviceTotal && (!final.price||isNaN(final.price))) final.status=STATUSES.MISSING;
    if(final.status===STATUSES.PAID) final.paidDate=new Date().toISOString();
    setSyncing(true);
    await syncToSheets(final, "add");
    if (!testMode) onSubmit(final);
    setSyncing(false);
    setSubmitted(true);
    setTimeout(()=>{setSubmitted(false);setJob(emptyJob());setCustomCustomer(false);},1800);
  };
  if (submitted) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:48,marginBottom:12,color:testMode?"#666":C.success}}>{testMode?"\uD83E\uDDEA":"\u2713"}</div>
      <div style={{fontSize:22,fontWeight:700,color:C.dark}}>{testMode?"Test job sent":"Job logged & synced"}</div>
      <div style={{fontSize:14,color:C.muted,marginTop:4}}>{testMode?"Saved to Test Jobs tab":"Saved to Google Sheets"}</div></div>
    </div>
  );
  const inputStyle={width:"100%",padding:"11px 12px",fontSize:15,borderRadius:8,border:`1.5px solid ${C.border}`,background:C.white,boxSizing:"border-box",outline:"none",fontFamily:"inherit"};
  const labelStyle={fontSize:12,fontWeight:600,color:C.muted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:0.5};
  return (
    <div style={{minHeight:"100vh",background:testMode?"#fff3e0":C.bg}}>
      <div style={{background:testMode?"#e65100":C.dark,color:"#fff",padding:"16px 20px",textAlign:"center"}}>
        <div style={{fontSize:11,color:"#ddd",marginBottom:2}}>{new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
        <div style={{fontSize:18,fontWeight:700}}>United Towing</div>
        <div style={{fontSize:12,color:"#ccc",marginTop:2}}>{testMode ? "\uD83E\uDDEA Test mode" : "Quick job capture"}</div>
      </div>
      <div style={{padding:"16px 20px",maxWidth:420,margin:"0 auto"}}>
        {/* Test mode toggle */}
        <div onClick={()=>setTestMode(!testMode)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,padding:"10px 14px",borderRadius:8,background:testMode?"#fff3e0":C.white,border:`1.5px solid ${testMode?"#e65100":C.border}`,cursor:"pointer"}}>
          <div style={{width:40,height:22,borderRadius:11,background:testMode?"#e65100":"#ccc",position:"relative",transition:"all 0.2s"}}>
            <div style={{width:18,height:18,borderRadius:9,background:"#fff",position:"absolute",top:2,left:testMode?20:2,transition:"all 0.2s"}} />
          </div>
          <span style={{fontSize:13,fontWeight:600,color:testMode?"#e65100":C.muted}}>Test mode {testMode?"ON":"off"}</span>
        </div>

        {/* Date / Time */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          <div><label style={labelStyle}>Date</label>
          <input type="date" value={job.jobDate} onChange={e=>update("jobDate",e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Time</label>
          <input type="time" value={job.jobTime} onChange={e=>update("jobTime",e.target.value)} style={inputStyle} /></div>
        </div>

        {/* Customer */}
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
        <div style={{marginBottom:14}}>
          <label style={labelStyle}>Customer phone</label>
          <input value={job.customer.phone} onChange={e=>update("customer.phone",e.target.value)} placeholder="914-555-1234" type="tel" style={inputStyle} />
        </div>

        {/* Vehicle */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
          {[["Color","vehicle.color","White"],["Make","vehicle.make","Ford"],["Model","vehicle.model","E350"]].map(([l,p,ph])=>(
            <div key={p}><label style={labelStyle}>{l}</label>
            <input value={p.split(".").reduce((o,k)=>o[k],job)} onChange={e=>update(p,e.target.value)} placeholder={ph} style={inputStyle} /></div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
          <div><label style={labelStyle}>Year</label>
          <input value={job.vehicle.year} onChange={e=>update("vehicle.year",e.target.value)} placeholder="2021" type="number" inputMode="numeric" style={inputStyle} /></div>
          <div><label style={labelStyle}>VIN</label>
          <input value={job.vehicle.vin} onChange={e=>update("vehicle.vin",e.target.value)} placeholder="VIN #" style={inputStyle} /></div>
          <div><label style={labelStyle}>Plate</label>
          <input value={job.vehicle.plate} onChange={e=>update("vehicle.plate",e.target.value)} placeholder="ABC 1234" style={inputStyle} /></div>
        </div>

        {/* Pickup / Dropoff */}
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginBottom:8}}>
          <div><label style={labelStyle}>Pickup</label>
          <input value={job.pickup} onChange={e=>update("pickup",e.target.value)} placeholder="123 Main St" style={inputStyle} /></div>
          <div><label style={labelStyle}>City</label>
          <input value={job.pickupCity} onChange={e=>update("pickupCity",e.target.value)} placeholder="Yonkers" style={inputStyle} /></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginBottom:14}}>
          <div><label style={labelStyle}>Dropoff</label>
          <input value={job.dropoff} onChange={e=>update("dropoff",e.target.value)} placeholder="JC Auto, Scarsdale" style={inputStyle} /></div>
          <div><label style={labelStyle}>City</label>
          <input value={job.dropoffCity} onChange={e=>update("dropoffCity",e.target.value)} placeholder="Scarsdale" style={inputStyle} /></div>
        </div>

        {/* Services with individual pricing */}
        <div style={{background:C.white,borderRadius:10,border:`1.5px solid ${C.border}`,padding:14,marginBottom:14}}>
          <ServicePricing services={job.services} onChange={s=>setJob(j=>({...j,services:s}))} compact />
          <div style={{borderTop:`1px solid ${C.border}`,marginTop:10,paddingTop:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div><label style={labelStyle}>Tolls</label>
              <input value={job.tolls} onChange={e=>update("tolls",e.target.value)} placeholder="$0" type="number" inputMode="decimal" style={inputStyle} /></div>
              <div><label style={labelStyle}>Payment</label>
              <select value={job.paymentType} onChange={e=>update("paymentType",e.target.value)} style={{...inputStyle,appearance:"auto"}}>
                {PAYMENT_TYPES.map(p=><option key={p} value={p}>{p}</option>)}
              </select></div>
            </div>
            {/* Totals */}
            <div style={{fontSize:13,color:C.muted}}>
              {subtotal>0 && <div style={{display:"flex",justifyContent:"space-between"}}><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>}
              {tax>0 && <div style={{display:"flex",justifyContent:"space-between"}}><span>Tax (8.375%)</span><span>{formatMoney(tax)}</span></div>}
              {ccFee>0 && <div style={{display:"flex",justifyContent:"space-between"}}><span>CC fee (4.5%)</span><span>{formatMoney(ccFee)}</span></div>}
              {total>0 && <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:16,color:C.dark,marginTop:4}}><span>Total</span><span>{formatMoney(total)}</span></div>}
            </div>
          </div>
        </div>

        {/* Payment status */}
        <div style={{marginBottom:14}}>
          <label style={labelStyle}>Payment status</label>
          <div style={{display:"flex",gap:0,borderRadius:8,overflow:"hidden",border:`1.5px solid ${C.border}`}}>
            <div onClick={()=>update("status",STATUSES.PAID)} style={{flex:1,padding:"11px 0",textAlign:"center",fontSize:14,fontWeight:600,cursor:"pointer",background:job.status===STATUSES.PAID?C.success:C.white,color:job.status===STATUSES.PAID?"#fff":C.muted,transition:"all 0.15s"}}>Paid</div>
            <div onClick={()=>update("status",STATUSES.UNPAID)} style={{flex:1,padding:"11px 0",textAlign:"center",fontSize:14,fontWeight:600,cursor:"pointer",background:job.status===STATUSES.UNPAID?C.danger:C.white,color:job.status===STATUSES.UNPAID?"#fff":C.muted,borderLeft:`1px solid ${C.border}`,transition:"all 0.15s"}}>Needs Payment</div>
          </div>
        </div>

        {/* Optional fields toggle */}
        <div onClick={()=>setExpanded(!expanded)} style={{textAlign:"center",padding:"8px 0",fontSize:13,fontWeight:600,color:C.accent,cursor:"pointer",marginBottom:expanded?8:14}}>
          {expanded ? "\u25B2 Hide optional fields" : "\u25BC Owner, PO#, photos & more"}
        </div>

        {expanded && <>
          {/* Owner info */}
          <div style={{background:C.bg,borderRadius:8,padding:14,marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:C.dark,marginBottom:8}}>Vehicle owner (if different from customer)</div>
            <div style={{marginBottom:8}}><label style={labelStyle}>Owner name</label>
            <input value={job.owner.name} onChange={e=>update("owner.name",e.target.value)} placeholder="Owner name" style={inputStyle} /></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div><label style={labelStyle}>Home phone</label><input value={job.owner.homePhone} onChange={e=>update("owner.homePhone",e.target.value)} type="tel" style={inputStyle} /></div>
              <div><label style={labelStyle}>Work phone</label><input value={job.owner.workPhone} onChange={e=>update("owner.workPhone",e.target.value)} type="tel" style={inputStyle} /></div>
            </div>
          </div>
          {/* PO / RA */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
            <div><label style={labelStyle}>PO #</label><input value={job.poNumber} onChange={e=>update("poNumber",e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>RA #</label><input value={job.raNumber} onChange={e=>update("raNumber",e.target.value)} style={inputStyle} /></div>
          </div>
          {/* Photos */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
            <PhotoCapture label="Vehicle photo" icon="&#128247;" value={job.vehiclePhoto} onChange={v=>setJob(j=>({...j,vehiclePhoto:v}))} />
            <PhotoCapture label="Registration" icon="&#128196;" value={job.registrationPhoto} onChange={v=>setJob(j=>({...j,registrationPhoto:v}))} />
          </div>
        </>}

        {/* Notes */}
        <div style={{marginBottom:16}}>
          <label style={labelStyle}>Notes</label>
          <input value={job.notes} onChange={e=>update("notes",e.target.value)} placeholder="AAA referral, paid tip, etc." style={inputStyle} />
        </div>

        <button onClick={handleSubmit} disabled={syncing} style={{...baseBtn,width:"100%",padding:14,fontSize:16,background:syncing?"#666":(testMode?"#e65100":C.dark),color:"#fff",borderRadius:10}}>
          {syncing ? "Syncing..." : (testMode ? "\uD83E\uDDEA Log test job" : "Log job")}
        </button>
        <p style={{textAlign:"center",fontSize:11,color:C.muted,marginTop:8}}>{testMode?"Goes to Test Jobs tab only":"Syncs to Google Sheets"}</p>
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
function SourceBadge({source}) {
  if (source==="legacy") return <span style={{padding:"2px 6px",borderRadius:8,fontSize:9,fontWeight:600,background:C.lightBlue,color:"#1565c0",marginLeft:6}}>LEGACY</span>;
  return null;
}

function InvoicePanel({ job, onSave, onClose }) {
  const isLegacy = job.source === "legacy";
  const [j, setJ] = useState(JSON.parse(JSON.stringify(job)));
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const update = (path,val) => {
    setJ(prev => { const c=JSON.parse(JSON.stringify(prev)); const k=path.split("."); let r=c; for(let i=0;i<k.length-1;i++) r=r[k[i]]; r[k[k.length-1]]=val; return c; });
  };
  const { subtotal, tax, ccFee, total, serviceTotal } = calcTotals(j.services, j.tolls, j.paymentType);

  const handleSave = async () => {
    setSaving(true);
    const saved={...j, price: serviceTotal || j.price, receiptGenerated:true};
    const ok = await syncToSheets(saved, "update");
    onSave(saved);
    setSaveMsg(ok ? "Saved & synced" : "Saved locally");
    setSaving(false);
    setTimeout(()=>setSaveMsg(""),2000);
  };
  const handleGeneratePDF = async () => {
    setGenerating(true);
    try { await generateInvoicePDF(j); }
    catch(err) { console.error("PDF error:", err); alert("Error generating PDF"); }
    setGenerating(false);
  };

  const labelStyle={fontSize:11,fontWeight:600,color:C.muted,display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:0.5};
  const inputStyle={width:"100%",padding:"9px 10px",fontSize:14,borderRadius:6,border:`1.5px solid ${C.border}`,background:C.white,boxSizing:"border-box",fontFamily:"inherit"};
  const roStyle={...inputStyle,background:"#f0f0f0",color:"#666"};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.white,borderRadius:12,width:"100%",maxWidth:600,maxHeight:"90vh",overflow:"auto",padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div>
            <h3 style={{margin:0,fontSize:18,fontWeight:700,color:C.dark}}>{isLegacy ? "Job details" : "Edit job / invoice"}</h3>
            {isLegacy && <div style={{fontSize:12,color:"#1565c0",marginTop:4}}>Legacy job #{j.legacyJobNumber} \u2014 view only</div>}
          </div>
          <button onClick={onClose} style={{...baseBtn,padding:"6px 12px",background:C.border,color:C.dark,fontSize:12}}>Close</button>
        </div>

        {isLegacy && j.legacyRaw && (
          <div style={{background:C.lightBlue,borderRadius:8,padding:12,marginBottom:14,fontSize:13}}>
            <div><strong>Original:</strong> {j.legacyRaw.jobName}</div>
            <div><strong>Receipt:</strong> {j.legacyRaw.receiptStatus || "\u2014"} &middot; <strong>Payment:</strong> {j.legacyRaw.paymentType || "\u2014"}</div>
          </div>
        )}

        {/* Date/Time */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          <div><label style={labelStyle}>Date</label><input type={isLegacy?"text":"date"} value={j.jobDate} onChange={e=>!isLegacy&&update("jobDate",e.target.value)} readOnly={isLegacy} style={isLegacy?roStyle:inputStyle} /></div>
          <div><label style={labelStyle}>Time</label><input type={isLegacy?"text":"time"} value={j.jobTime} onChange={e=>!isLegacy&&update("jobTime",e.target.value)} readOnly={isLegacy} style={isLegacy?roStyle:inputStyle} /></div>
        </div>

        {/* Vehicle */}
        <div style={{background:C.bg,borderRadius:8,padding:14,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700,color:C.dark,marginBottom:10}}>Vehicle</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
            {[["Year","vehicle.year"],["Color","vehicle.color"],["Make","vehicle.make"],["Model","vehicle.model"]].map(([l,p])=>(
              <div key={p}><label style={labelStyle}>{l}</label><input value={p.split(".").reduce((o,k)=>o[k],j)} onChange={e=>!isLegacy&&update(p,e.target.value)} readOnly={isLegacy} style={isLegacy?roStyle:inputStyle} /></div>
            ))}
          </div>
          {!isLegacy && <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
            <div><label style={labelStyle}>VIN</label><input value={j.vehicle.vin} onChange={e=>update("vehicle.vin",e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Plate</label><input value={j.vehicle.plate} onChange={e=>update("vehicle.plate",e.target.value)} style={inputStyle} /></div>
          </div>}
        </div>

        {/* Customer */}
        <div style={{background:C.bg,borderRadius:8,padding:14,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700,color:C.dark,marginBottom:10}}>Customer</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><label style={labelStyle}>Name</label><input value={j.customer.name} onChange={e=>!isLegacy&&update("customer.name",e.target.value)} readOnly={isLegacy} style={isLegacy?roStyle:inputStyle} /></div>
            <div><label style={labelStyle}>Phone</label><input value={j.customer.phone} onChange={e=>!isLegacy&&update("customer.phone",e.target.value)} readOnly={isLegacy} style={isLegacy?roStyle:inputStyle} /></div>
          </div>
        </div>

        {/* Locations */}
        {!isLegacy && <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginBottom:8}}>
          <div><label style={labelStyle}>Pickup</label><input value={j.pickup} onChange={e=>update("pickup",e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>City</label><input value={j.pickupCity} onChange={e=>update("pickupCity",e.target.value)} style={inputStyle} /></div>
        </div>}
        {!isLegacy && <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginBottom:14}}>
          <div><label style={labelStyle}>Dropoff</label><input value={j.dropoff} onChange={e=>update("dropoff",e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>City</label><input value={j.dropoffCity} onChange={e=>update("dropoffCity",e.target.value)} style={inputStyle} /></div>
        </div>}

        {/* Services + Pricing */}
        <div style={{background:C.bg,borderRadius:8,padding:14,marginBottom:14}}>
          {!isLegacy ? (
            <>
              <ServicePricing services={j.services} onChange={s=>setJ(prev=>({...prev,services:s}))} />
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
                <div><label style={labelStyle}>Tolls</label><input value={j.tolls} onChange={e=>update("tolls",e.target.value)} type="number" placeholder="0" style={inputStyle} /></div>
                <div><label style={labelStyle}>Payment type</label><select value={j.paymentType} onChange={e=>update("paymentType",e.target.value)} style={{...inputStyle,appearance:"auto"}}>{PAYMENT_TYPES.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
              </div>
              <div style={{borderTop:`1px solid ${C.border}`,marginTop:10,paddingTop:10,fontSize:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.muted}}>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.muted}}>Tax (8.375%)</span><span>{formatMoney(tax)}</span></div>
                {ccFee>0&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.muted}}>CC fee (4.5%)</span><span>{formatMoney(ccFee)}</span></div>}
                <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:16,marginTop:6}}><span>Total due</span><span style={{color:C.accent}}>{formatMoney(total)}</span></div>
              </div>
            </>
          ) : (
            <div>
              <div style={{fontSize:13,fontWeight:700,color:C.dark,marginBottom:8}}>Pricing</div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:16}}><span>Price</span><span style={{fontWeight:700}}>{formatMoney(j.price)}</span></div>
            </div>
          )}
        </div>

        {/* Owner / PO / RA */}
        {!isLegacy && <div style={{background:C.bg,borderRadius:8,padding:14,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700,color:C.dark,marginBottom:10}}>Owner / references</div>
          <div style={{marginBottom:8}}><label style={labelStyle}>Owner name</label><input value={(j.owner||{}).name||""} onChange={e=>update("owner.name",e.target.value)} style={inputStyle} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><label style={labelStyle}>Home phone</label><input value={(j.owner||{}).homePhone||""} onChange={e=>update("owner.homePhone",e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Work phone</label><input value={(j.owner||{}).workPhone||""} onChange={e=>update("owner.workPhone",e.target.value)} style={inputStyle} /></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><label style={labelStyle}>PO #</label><input value={j.poNumber||""} onChange={e=>update("poNumber",e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>RA #</label><input value={j.raNumber||""} onChange={e=>update("raNumber",e.target.value)} style={inputStyle} /></div>
          </div>
        </div>}

        <div style={{marginBottom:14}}><label style={labelStyle}>Notes</label><textarea value={j.notes} onChange={e=>!isLegacy&&update("notes",e.target.value)} readOnly={isLegacy} rows={2} style={{...(isLegacy?roStyle:inputStyle),resize:"vertical"}} /></div>

        {/* Status */}
        {!isLegacy && <div style={{marginBottom:14}}>
          <div style={{display:"flex",gap:0,borderRadius:8,overflow:"hidden",border:`1.5px solid ${C.border}`}}>
            <div onClick={()=>{update("status",STATUSES.PAID);update("paidDate",new Date().toISOString());}} style={{flex:1,padding:"11px 0",textAlign:"center",fontSize:14,fontWeight:600,cursor:"pointer",background:j.status===STATUSES.PAID?C.success:C.white,color:j.status===STATUSES.PAID?"#fff":C.muted}}>Paid</div>
            <div onClick={()=>{update("status",STATUSES.UNPAID);update("paidDate",null);}} style={{flex:1,padding:"11px 0",textAlign:"center",fontSize:14,fontWeight:600,cursor:"pointer",background:j.status===STATUSES.UNPAID?C.danger:C.white,color:j.status===STATUSES.UNPAID?"#fff":C.muted,borderLeft:`1px solid ${C.border}`}}>Unpaid</div>
          </div>
        </div>}
        {isLegacy && <div style={{padding:"12px 14px",borderRadius:8,background:j.status===STATUSES.PAID?C.lightGreen:C.lightRed,textAlign:"center",fontSize:14,fontWeight:600,color:j.status===STATUSES.PAID?C.success:C.danger,marginBottom:14}}>{j.status===STATUSES.PAID?"Paid":"Unpaid"}</div>}

        {!isLegacy && <div style={{display:"flex",gap:8,marginBottom:8}}>
          <button onClick={handleSave} disabled={saving} style={{...baseBtn,flex:1,background:saving?"#666":C.dark,color:"#fff"}}>{saving ? "Saving..." : "Save changes"}</button>
        </div>}
        {saveMsg && <div style={{textAlign:"center",fontSize:13,color:C.success,fontWeight:600,marginBottom:8}}>{saveMsg}</div>}
        {!isLegacy && <button onClick={handleGeneratePDF} disabled={generating} style={{...baseBtn,width:"100%",padding:12,fontSize:14,background:generating?"#666":"#b35900",color:"#fff",borderRadius:8}}>{generating ? "Generating..." : "Generate Invoice PDF"}</button>}
      </div>
    </div>
  );
}

function Dashboard({ jobs, setJobs, onNewJob, onLogout, loading, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("action");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");

  let sourceFiltered = jobs;
  if (sourceFilter === "app") sourceFiltered = jobs.filter(j => j.source === "app");
  else if (sourceFilter === "legacy") sourceFiltered = jobs.filter(j => j.source === "legacy");

  const unpaidJobs=sourceFiltered.filter(j=>j.status!==STATUSES.PAID&&j.price&&!isNaN(j.price));
  const missingJobs=sourceFiltered.filter(j=>!j.price||isNaN(j.price));
  const paidJobs=sourceFiltered.filter(j=>j.status===STATUSES.PAID);
  const totalCollected=paidJobs.reduce((s,j)=>s+(parseFloat(j.price)||0),0);
  const totalUnpaid=unpaidJobs.reduce((s,j)=>s+(parseFloat(j.price)||0),0);
  const aging={"0-30":0,"30-60":0,"60-90":0,"90+":0};
  unpaidJobs.forEach(j=>{const d=daysSince(j.createdAt);if(d<=30)aging["0-30"]++;else if(d<=60)aging["30-60"]++;else if(d<=90)aging["60-90"]++;else aging["90+"]++;});
  const accountMap={};
  unpaidJobs.forEach(j=>{const name=j.customer.name||"Unknown";if(!accountMap[name])accountMap[name]={count:0,total:0,oldest:j.createdAt};accountMap[name].count++;accountMap[name].total+=parseFloat(j.price)||0;if(new Date(j.createdAt)<new Date(accountMap[name].oldest))accountMap[name].oldest=j.createdAt;});
  const topAccounts=Object.entries(accountMap).sort((a,b)=>b[1].total-a[1].total).slice(0,8);

  let filtered=sourceFiltered;
  if(filter==="action") filtered=sourceFiltered.filter(j=>j.status!==STATUSES.PAID);
  else if(filter==="unpaid") filtered=unpaidJobs;
  else if(filter==="missing") filtered=missingJobs;
  else if(filter==="paid") filtered=paidJobs;
  if(search){const s=search.toLowerCase();filtered=filtered.filter(j=>(j.customer.name||"").toLowerCase().includes(s)||(j.vehicle.make||"").toLowerCase().includes(s)||(j.vehicle.model||"").toLowerCase().includes(s)||(j.vehicle.color||"").toLowerCase().includes(s)||(j.pickup||"").toLowerCase().includes(s)||(j.dropoff||"").toLowerCase().includes(s)||(j.notes||"").toLowerCase().includes(s));}
  filtered=[...filtered].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  const handleSave = async (updated) => {
    setJobs(prev => { const next = prev.map(j => j.id === updated.id ? updated : j); cacheJobs(next); return next; });
    setEditing(null);
  };
  const maxAging=Math.max(...Object.values(aging),1);
  const legacyCount = jobs.filter(j=>j.source==="legacy").length;
  const appCount = jobs.filter(j=>j.source==="app").length;

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div><div style={{fontSize:18,fontWeight:700,color:C.dark}}>United Towing</div><div style={{fontSize:12,color:C.muted}}>{loading?"Loading...":`${jobs.length} jobs`}</div></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onRefresh} style={{...baseBtn,background:C.bg,color:C.muted,fontSize:12,padding:"8px 12px"}}>{loading?"\u23F3":"\u21BB"}</button>
          <button onClick={onNewJob} style={{...baseBtn,background:C.dark,color:"#fff",fontSize:13}}>+ Log job</button>
          <button onClick={onLogout} style={{...baseBtn,background:C.border,color:C.muted,fontSize:12}}>Out</button>
        </div>
      </div>
      <div style={{padding:"20px 24px",maxWidth:1200,margin:"0 auto"}}>
        <div style={{display:"flex",gap:6,marginBottom:16}}>
          {[["all","All"],["legacy","Legacy ("+legacyCount+")"],["app","App ("+appCount+")"]].map(([k,label])=>(
            <span key={k} onClick={()=>setSourceFilter(k)} style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",background:sourceFilter===k?C.dark:C.white,color:sourceFilter===k?"#fff":C.muted,border:`1.5px solid ${sourceFilter===k?C.dark:C.border}`}}>{label}</span>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:20}}>
          {[{label:"Total jobs",val:sourceFiltered.length,sub:"filtered",bg:C.bg,color:C.dark},{label:"Collected",val:"$"+Math.round(totalCollected).toLocaleString(),sub:`${paidJobs.length} paid`,bg:C.lightGreen,color:C.success},{label:"Unpaid",val:"$"+Math.round(totalUnpaid).toLocaleString(),sub:`${unpaidJobs.length} jobs`,bg:C.lightRed,color:C.danger},{label:"Missing info",val:missingJobs.length,sub:"no price",bg:C.lightYellow,color:C.warning}].map((mt,i)=>(
            <div key={i} style={{background:mt.bg,borderRadius:10,padding:"12px 14px"}}>
              <div style={{fontSize:11,fontWeight:600,color:mt.color,textTransform:"uppercase",letterSpacing:0.5}}>{mt.label}</div>
              <div style={{fontSize:22,fontWeight:700,color:mt.color,marginTop:2}}>{mt.val}</div>
              <div style={{fontSize:11,color:mt.color,opacity:0.7}}>{mt.sub}</div>
            </div>
          ))}
        </div>
        <div style={{background:C.white,borderRadius:10,padding:"16px 20px",boxShadow:C.cardShadow,marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:700,color:C.danger,marginBottom:12}}>{"\u26A0\uFE0F"} Unpaid \u2014 chase these</div>
          {topAccounts.length===0?<div style={{fontSize:13,color:C.muted,padding:16,textAlign:"center"}}>No unpaid accounts</div>:
          topAccounts.map(([name,data],i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<topAccounts.length-1?`1px solid ${C.border}`:"none"}}>
              <div><div style={{fontSize:14,fontWeight:600,color:C.dark}}>{name||"Unknown"}</div><div style={{fontSize:11,color:C.muted}}>{data.count} unpaid &middot; {daysSince(data.oldest)}d</div></div>
              <div style={{fontSize:16,fontWeight:700,color:C.danger}}>{formatMoney(data.total)}</div>
            </div>
          ))}
          {topAccounts.length>0 && <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700}}><span>Total outstanding</span><span style={{color:C.danger}}>{formatMoney(totalUnpaid)}</span></div>}
        </div>
        <div style={{background:C.white,borderRadius:10,padding:"16px 20px",boxShadow:C.cardShadow,marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:700,color:C.dark,marginBottom:12}}>Aging</div>
          {[{label:"0-30d",count:aging["0-30"],color:C.success},{label:"30-60d",count:aging["30-60"],color:C.warning},{label:"60-90d",count:aging["60-90"],color:"#D85A30"},{label:"90+d",count:aging["90+"],color:C.danger}].map((a,i)=>(
            <div key={i} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted,marginBottom:3}}><span>{a.label}</span><span>{a.count}</span></div>
              <div style={{height:12,borderRadius:4,background:C.bg,overflow:"hidden"}}><div style={{width:`${Math.round((a.count/maxAging)*100)}%`,height:"100%",background:a.color,borderRadius:4}} /></div>
            </div>
          ))}
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
            {filtered.slice(0,80).map(j=>(
              <div key={j.id} onClick={()=>setEditing(j)} style={{padding:"12px 0",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:C.dark}}>{[j.vehicle.color,j.vehicle.make,j.vehicle.model].filter(Boolean).join(" ")||"No vehicle info"}<SourceBadge source={j.source} /></div>
                    <div style={{fontSize:13,color:C.muted,marginTop:2}}>{j.customer.name||"No customer"} &middot; {formatDate(j.jobDate||j.createdAt)}</div>
                  </div>
                  <div style={{textAlign:"right",marginLeft:12}}>
                    <div style={{fontSize:15,fontWeight:700}}>{j.price&&!isNaN(j.price)?formatMoney(j.price):<span style={{color:C.warning,fontSize:13}}>No price</span>}</div>
                    <StatusBadge status={j.status} price={j.price} />
                  </div>
                </div>
                {(j.pickup||j.dropoff)&&<div style={{fontSize:12,color:C.muted}}>{[j.pickup,j.dropoff].filter(Boolean).join(" \u2192 ")}</div>}
              </div>
            ))}
          </div>
          {filtered.length>80&&<div style={{textAlign:"center",padding:12,fontSize:12,color:C.muted}}>Showing 80 of {filtered.length}</div>}
          {filtered.length===0&&<div style={{textAlign:"center",padding:24,fontSize:14,color:C.muted}}>No jobs match</div>}
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

  const loadFromSheets = useCallback(async () => {
    setLoading(true);
    const result = await fetchJobsFromSheets();
    if (result) {
      const all = [...(result.legacyJobs || []), ...(result.appJobs || [])];
      if (all.length > 0) { setJobs(all); cacheJobs(all); }
      else { const cached = loadCache(); if (cached.length > 0) setJobs(cached); }
    } else { const cached = loadCache(); if (cached.length > 0) setJobs(cached); }
    setLoading(false);
  }, []);

  useEffect(() => { if (authed) loadFromSheets(); }, [authed, loadFromSheets]);

  const addJob = useCallback((job) => {
    setJobs(prev => { const next = [...prev, job]; cacheJobs(next); return next; });
    setView("dashboard");
  }, []);

  if (!authed) return <PasswordGate onAuth={()=>setAuthed(true)} />;
  if (view==="capture") return <CaptureForm onSubmit={addJob} onCancel={()=>setView("dashboard")} />;
  return <Dashboard jobs={jobs} setJobs={setJobs} onNewJob={()=>setView("capture")} onLogout={()=>{localStorage.removeItem("ut-auth");setAuthed(false);}} loading={loading} onRefresh={loadFromSheets} />;
}
