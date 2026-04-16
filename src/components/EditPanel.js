import React, { useState } from "react";
import { T, inp, lbl, btnP, btnS } from "../styles/theme";
import { PAY } from "../lib/constants";
import { money } from "../lib/format";
import { totals } from "../lib/math";
import { syncJob, deleteJob } from "../lib/sync";
import { makePDF } from "../lib/pdf";
import { lookupZip } from "../lib/zip";
import Section from "./Section";
import Photo from "./Photo";
import SvcPricing from "./SvcPricing";
import StatusToggle from "./StatusToggle";
import TaxToggle from "./TaxToggle";

export default function EditPanel({job,onSave,onClose,onDelete}){
  const isM=job.source==="migrated";
  const[j,setJ]=useState(JSON.parse(JSON.stringify(job)));
  const[busy,setBusy]=useState(false);const[msg,setMsg]=useState("");const[pdfing,setPdfing]=useState(false);const[more,setMore]=useState(false);
  const[confirmDel,setConfirmDel]=useState(false);const[deleting,setDeleting]=useState(false);
  const u=(p,v)=>setJ(prev=>{const c2=JSON.parse(JSON.stringify(prev));const k=p.split(".");let r=c2;for(let i=0;i<k.length-1;i++)r=r[k[i]];r[k[k.length-1]]=v;return c2});
  const{tax,cc,total,svcSum,tl,taxRate:effRate}=totals(j.services,j.tolls,j.paymentType,j.taxMode==="exempt"?0:j.taxRate);
  const save=async()=>{setBusy(true);const saved={...j,price:total||svcSum||j.price};await syncJob(saved,"update");onSave(saved);setMsg("Saved");setBusy(false);setTimeout(()=>setMsg(""),2000)};
  const pdf=async()=>{setPdfing(true);try{await makePDF(j)}catch{alert("PDF error")}setPdfing(false)};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:12,fontFamily:T.font}}>
      <div style={{background:T.surface,borderRadius:14,width:"100%",maxWidth:560,maxHeight:"92vh",overflow:"auto",padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div><div style={{fontSize:18,fontWeight:700,color:T.dark}}>{isM?`Job #${job.legacyNum}`:"Edit job"}</div>{isM&&<div style={{fontSize:12,color:T.muted,marginTop:3}}>Migrated &mdash; edits save directly</div>}</div>
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
