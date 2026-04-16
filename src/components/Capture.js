import React, { useState } from "react";
import { T, inp, lbl, btnP, btnS } from "../styles/theme";
import { PARTNERS, PAY, ST } from "../lib/constants";
import { money } from "../lib/format";
import { totals } from "../lib/math";
import { freshJob } from "../lib/parse";
import { syncJob } from "../lib/sync";
import { lookupZip } from "../lib/zip";
import Section from "./Section";
import Photo from "./Photo";
import SvcPricing from "./SvcPricing";
import StatusToggle from "./StatusToggle";
import TaxToggle from "./TaxToggle";

export default function Capture({testMode=false,onSubmit,onCancel}){
  const[j,setJ]=useState(freshJob());const[cc,setCC]=useState(false);
  const[done,setDone]=useState(false);const[busy,setBusy]=useState(false);
  const[more,setMore]=useState(false);
  const test=!!testMode;
  const u=(p,v)=>setJ(prev=>{const c2=JSON.parse(JSON.stringify(prev));const k=p.split(".");let r=c2;for(let i=0;i<k.length-1;i++)r=r[k[i]];r[k[k.length-1]]=v;return c2});
  const{tax,cc:ccFee,total,svcSum,tl,taxRate:effRate}=totals(j.services,j.tolls,j.paymentType,j.taxMode==="exempt"?0:j.taxRate);
  const go=async()=>{if(!j.customer.name&&!cc)return;const f={...j,price:total||svcSum||j.price,isTest:test};if(!svcSum&&(!f.price||isNaN(f.price)))f.status=ST.MISSING;setBusy(true);await syncJob(f,"add");if(!test)onSubmit(f);setBusy(false);setDone(true);setTimeout(()=>{setDone(false);setJ(freshJob());setCC(false)},1500)};
  if(done)return(<div style={{position:"fixed",inset:0,zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",background:T.bg,fontFamily:T.font}}><div style={{textAlign:"center"}}><div style={{fontSize:52,marginBottom:12}}>{test?"\uD83E\uDDEA":"\u2713"}</div><div style={{fontSize:22,fontWeight:700,color:T.dark}}>{test?"Test sent":"Job logged"}</div><div style={{fontSize:14,color:T.muted,marginTop:6}}>{test?"Test tab only":"Synced to Sheets"}</div></div></div>);
  return(
    <div style={{position:"fixed",inset:0,zIndex:1100,overflow:"auto",background:test?"#fff7ed":T.bg,fontFamily:T.font}}>
      <div style={{background:test?"#c2410c":T.dark,color:"#fff",padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
        <button onClick={onCancel} aria-label="Close" style={{background:"rgba(255,255,255,.12)",border:"none",color:"#fff",width:36,height:36,borderRadius:8,cursor:"pointer",fontSize:18}}>&times;</button>
        <div style={{textAlign:"center",flex:1}}>
          <div style={{fontSize:18,fontWeight:700}}>Log new job</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:2}}>{test?"Test mode":new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</div>
        </div>
        <div style={{width:36}} />
      </div>
      <div style={{padding:"16px 20px",maxWidth:480,margin:"0 auto"}}>
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
        <div style={{textAlign:"center",fontSize:11,color:T.muted,marginTop:8,marginBottom:onCancel?8:0}}>{test?"Test tab only \u00B7 toggle in menu":"Syncs to Sheets"}</div>
        {onCancel&&<button onClick={onCancel} style={{...btnS,marginBottom:20}}>Cancel</button>}
      </div>
    </div>);
}
