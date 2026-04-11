import React, { useState, useEffect, useCallback, useRef } from "react";

const APP_PIN = "united149";
const SHEETS_URL = "https://script.google.com/macros/s/AKfycbxn1SFWfILSu-JGrAd9pYAuEgS6HG3rPpMlSS8s-ExPH2BnJTkJKTX42-yNo57B-G7RAw/exec";

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
function formatDate(d) { if(!d) return "\u2014"; const dt=new Date(d); return `${dt.getMonth()+1}/${dt.getDate()}/${String(dt.getFullYear()).slice(2)}`; }
function formatMoney(n) { if(n==null||isNaN(n)) return "\u2014"; return "$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function daysSince(d) { return Math.floor((Date.now()-new Date(d).getTime())/86400000); }

const emptyJob = () => ({
  id:generateId(), createdAt:new Date().toISOString(),
  vehicle:{color:"",make:"",model:"",year:"",vin:"",plate:""},
  customer:{name:"",phone:"",isPartner:false},
  pickup:"", dropoff:"", serviceType:"Tow", price:"", paymentType:"Cash",
  status:STATUSES.UNPAID, notes:"",
  vehiclePhoto:null, registrationPhoto:null,
  receiptGenerated:false, paidDate:null,
  invoiceDetails:{subtotal:"",tax:"",total:"",tolls:"",ccFee:""}
});

const STORAGE_KEY = "ut-jobs-v2";
function loadJobs() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); } catch { return []; } }
function saveJobs(jobs) { localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs)); }

async function syncToSheets(job) {
  try {
    const dt = new Date(job.createdAt);
    await fetch(SHEETS_URL, {
      method:"POST", mode:"no-cors",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        id: job.id,
        date: `${dt.getMonth()+1}/${dt.getDate()}/${dt.getFullYear()}`,
        time: dt.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
        vehicleColor: job.vehicle.color,
        vehicleMake: job.vehicle.make,
        vehicleModel: job.vehicle.model,
        vehicleYear: job.vehicle.year,
        vin: job.vehicle.vin,
        plate: job.vehicle.plate,
        customerName: job.customer.name,
        customerPhone: job.customer.phone,
        pickup: job.pickup,
        dropoff: job.dropoff,
        serviceType: job.serviceType,
        price: job.price,
        paymentType: job.paymentType,
        status: job.status,
        notes: job.notes,
        vehiclePhoto: job.vehiclePhoto ? "Yes" : "",
        registrationPhoto: job.registrationPhoto ? "Yes" : ""
      })
    });
  } catch(err) { console.error("Sheets sync error:", err); }
}

const C = {
  bg:"#f7f6f3",white:"#ffffff",dark:"#1a1a2e",accent:"#2d6a4f",
  danger:"#c1292e",warning:"#e8871e",success:"#2d6a4f",muted:"#8a8a8a",
  border:"#e2e0db",lightGreen:"#e8f5e9",lightRed:"#fce8e8",
  lightYellow:"#fff8e7",cardShadow:"0 1px 3px rgba(0,0,0,0.06)"
};
const baseBtn = {padding:"10px 20px",borderRadius:8,border:"none",cursor:"pointer",fontSize:14,fontWeight:600,transition:"all 0.15s"};

function PhotoCapture({ label, icon, value, onChange }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(value);
  const handleCapture = (e) => {
    const file = e.target.files[0];
    if (!file) return;
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
          <div style={{fontSize:22,marginBottom:2}}>{icon}</div>
          Tap to capture
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
      <form onSubmit={handleSubmit} style={{textAlign:"center",padding:40}}>
        <div style={{fontSize:24,fontWeight:700,color:"#fff",marginBottom:4}}>United Towing</div>
        <div style={{fontSize:13,color:"#aaa",marginBottom:24}}>Enter access code</div>
        <input value={pin} onChange={e=>{setPin(e.target.value);setError(false);}} type="password" placeholder="Access code" autoFocus
          style={{padding:"12px 16px",fontSize:16,borderRadius:8,border:error?"2px solid #c1292e":"2px solid #444",background:"#2a2a3e",color:"#fff",width:220,textAlign:"center",outline:"none",display:"block",margin:"0 auto 12px"}} />
        <button type="submit" style={{...baseBtn,background:"#fff",color:C.dark,width:220}}>Enter</button>
        {error && <div style={{color:"#c1292e",fontSize:13,marginTop:10}}>Wrong code</div>}
      </form>
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
    setSyncing(true);
    await syncToSheets(final);
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

function InvoicePanel({ job, onSave, onClose }) {
  const [j, setJ] = useState(JSON.parse(JSON.stringify(job)));
  const update = (path,val) => {
    setJ(prev => { const c=JSON.parse(JSON.stringify(prev)); const k=path.split("."); let r=c; for(let i=0;i<k.length-1;i++) r=r[k[i]]; r[k[k.length-1]]=val; return c; });
  };
  const price=parseFloat(j.price)||0, tolls=parseFloat(j.invoiceDetails.tolls)||0;
  const subtotal=price+tolls, tax=Math.round(subtotal*TAX_RATE*100)/100;
  const ccFee=j.paymentType==="Credit Card"?Math.round(subtotal*0.045*100)/100:0;
  const total=Math.round((subtotal+tax+ccFee)*100)/100;
  const markPaid=()=>{update("status",STATUSES.PAID);update("paidDate",new Date().toISOString());};
  const labelStyle={fontSize:11,fontWeight:600,color:C.muted,display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:0.5};
  const inputStyle={width:"100%",padding:"9px 10px",fontSize:14,borderRadius:6,border:`1.5px solid ${C.border}`,background:C.white,boxSizing:"border-box",fontFamily:"inherit"};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.white,borderRadius:12,width:"100%",maxWidth:600,maxHeight:"90vh",overflow:"auto",padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h3 style={{margin:0,fontSize:18,fontWeight:700,color:C.dark}}>Complete invoice</h3>
          <button onClick={onClose} style={{...baseBtn,padding:"6px 12px",background:C.border,color:C.dark,fontSize:12}}>Close</button>
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
        <div style={{display:"flex",gap:8}}>
          {j.status!==STATUSES.PAID&&<button onClick={markPaid} style={{...baseBtn,flex:1,background:C.success,color:"#fff"}}>Mark as paid</button>}
          <button onClick={()=>{const saved={...j,invoiceDetails:{...j.invoiceDetails,subtotal,tax,total,ccFee},receiptGenerated:true};onSave(saved);}} style={{...baseBtn,flex:1,background:C.dark,color:"#fff"}}>Save invoice</button>
        </div>
        {j.status===STATUSES.PAID&&<div style={{textAlign:"center",marginTop:10,fontSize:13,color:C.success,fontWeight:600}}>Paid on {formatDate(j.paidDate)}</div>}
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

function Dashboard({ jobs, setJobs, onNewJob, onLogout }) {
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

  const handleSave=(updated)=>{setJobs(prev=>{const next=prev.map(j=>j.id===updated.id?updated:j);saveJobs(next);return next;});setEditing(null);syncToSheets(updated);};
  const maxAging=Math.max(...Object.values(aging),1);

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div><div style={{fontSize:18,fontWeight:700,color:C.dark}}>United Towing &amp; Transport</div><div style={{fontSize:12,color:C.muted}}>Invoicing dashboard</div></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onNewJob} style={{...baseBtn,background:C.dark,color:"#fff",fontSize:13}}>+ Log new job</button>
          <button onClick={onLogout} style={{...baseBtn,background:C.border,color:C.muted,fontSize:12}}>Logout</button>
        </div>
      </div>
      <div style={{padding:"20px 24px",maxWidth:1200,margin:"0 auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginBottom:20}}>
          {[
            {label:"Total jobs",val:jobs.length,sub:"all time",bg:C.bg,color:C.dark},
            {label:"Collected",val:formatMoney(totalCollected),sub:`${paidJobs.length} paid`,bg:C.lightGreen,color:C.success},
            {label:"Unpaid",val:formatMoney(totalUnpaid),sub:`${unpaidJobs.length} jobs`,bg:C.lightRed,color:C.danger},
            {label:"Missing info",val:missingJobs.length,sub:"no price",bg:C.lightYellow,color:C.warning}
          ].map((m,i)=>(
            <div key={i} style={{background:m.bg,borderRadius:10,padding:"14px 16px",overflow:"hidden"}}>
              <div style={{fontSize:11,fontWeight:600,color:m.color,textTransform:"uppercase",letterSpacing:0.5}}>{m.label}</div>
              <div style={{fontSize:20,fontWeight:700,color:m.color,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.val}</div>
              <div style={{fontSize:11,color:m.color,opacity:0.7}}>{m.sub}</div>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
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
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,tableLayout:"fixed"}}>
              <thead><tr style={{borderBottom:`1.5px solid ${C.border}`}}>
                {[{h:"Date",w:"11%"},{h:"Vehicle",w:"20%"},{h:"Customer",w:"16%"},{h:"Route",w:"22%"},{h:"Amount",w:"11%"},{h:"Status",w:"10%"},{h:"",w:"10%"}].map((col,i)=>(
                  <th key={i} style={{textAlign:i===4?"right":i===5?"center":"left",padding:"8px 4px",fontWeight:600,color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:0.5,width:col.w}}>{col.h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.slice(0,50).map(j=>(
                  <tr key={j.id} style={{borderBottom:`1px solid ${C.border}`,cursor:"pointer"}} onClick={()=>setEditing(j)} onMouseEnter={e=>e.currentTarget.style.background=C.bg} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"10px 4px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{formatDate(j.createdAt)}</td>
                    <td style={{padding:"10px 4px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{[j.vehicle.color,j.vehicle.make,j.vehicle.model].filter(Boolean).join(" ")||"\u2014"}</td>
                    <td style={{padding:"10px 4px",fontWeight:j.customer.name?500:400,color:j.customer.name?C.dark:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{j.customer.name||"\u2014"}</td>
                    <td style={{padding:"10px 4px",color:C.muted,fontSize:12,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{[j.pickup,j.dropoff].filter(Boolean).join(" \u2192 ")||"\u2014"}</td>
                    <td style={{padding:"10px 4px",textAlign:"right",fontWeight:600,whiteSpace:"nowrap"}}>{j.price&&!isNaN(j.price)?formatMoney(j.price):<span style={{color:C.warning}}>{"\u2014"}</span>}</td>
                    <td style={{padding:"10px 4px",textAlign:"center",whiteSpace:"nowrap"}}><StatusBadge status={j.status} price={j.price} /></td>
                    <td style={{padding:"10px 4px",textAlign:"center",whiteSpace:"nowrap"}}><span style={{color:"#5588cc",fontSize:12,fontWeight:600}}>Edit</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
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
  useEffect(()=>{ if(authed) setJobs(loadJobs()); },[authed]);
  const addJob = useCallback((job)=>{setJobs(prev=>{const next=[...prev,job];saveJobs(next);return next;});setView("dashboard");},[]);
  const handleLogout = ()=>{ localStorage.removeItem("ut-auth"); setAuthed(false); };
  if (!authed) return <PasswordGate onAuth={()=>setAuthed(true)} />;
  if (view==="capture") return <CaptureForm onSubmit={addJob} onCancel={()=>setView("dashboard")} />;
  return <Dashboard jobs={jobs} setJobs={setJobs} onNewJob={()=>setView("capture")} onLogout={handleLogout} />;
}
