import React, { useState } from "react";
import { T } from "../../styles/theme";
import { PARTNERS, SVC, TAX } from "../../lib/constants";
import { downloadJobsCSV } from "../../lib/csv";

function CardHeader({title,subtitle,open,onToggle,right}){
  return(
    <div onClick={onToggle} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",cursor:"pointer",userSelect:"none"}}>
      <div>
        <div style={{fontSize:14,fontWeight:700,color:T.dark}}>{title}</div>
        {subtitle&&<div style={{fontSize:11,color:T.muted,marginTop:2}}>{subtitle}</div>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {right}
        <span style={{fontSize:12,color:T.muted,transition:"transform .15s",transform:open?"rotate(180deg)":"none"}}>&#9662;</span>
      </div>
    </div>
  );
}

function Card({title,subtitle,open,onToggle,right,children}){
  return(
    <div style={{background:T.surface,borderRadius:T.radius,boxShadow:T.shadow,marginBottom:10,overflow:"hidden"}}>
      <CardHeader title={title} subtitle={subtitle} open={open} onToggle={onToggle} right={right} />
      {open&&<div style={{padding:"4px 16px 16px",borderTop:`1px solid ${T.bg}`,fontSize:13,color:T.dark,lineHeight:1.7}}>{children}</div>}
    </div>
  );
}

const DISABLED_EDIT = {padding:"6px 12px",borderRadius:8,border:`1.5px solid ${T.border}`,cursor:"not-allowed",fontSize:11,fontWeight:600,background:T.bg,color:T.muted,opacity:.7};

export default function SettingsTab({jobs=[],testMode,setTestMode}){
  const[open,setOpen]=useState("");
  const tog=k=>setOpen(o=>o===k?"":k);
  const exportCSV=()=>{try{downloadJobsCSV(jobs)}catch(e){alert("Export failed: "+e.message)}};
  return(
    <div>
      <div style={{marginBottom:18}}>
        <div style={{fontSize:22,fontWeight:700,color:T.dark}}>Settings</div>
        <div style={{fontSize:13,color:T.muted,marginTop:4}}>Business info, tax, services, team, and data</div>
      </div>

      <Card title="Business info" subtitle="Company details on invoices" open={open==="biz"} onToggle={()=>tog("biz")} right={<button disabled style={DISABLED_EDIT}>Edit</button>}>
        <div style={{marginTop:6}}>
          <div style={{fontWeight:600}}>United Towing & Transport LLC</div>
          <div style={{color:T.muted}}>82 Kramers Pond Rd, Putnam Valley, NY 10579</div>
          <div style={{color:T.muted}}>914-500-5570</div>
        </div>
      </Card>

      <Card title="Tax settings" subtitle={`Default ${(TAX*100).toFixed(3)}%`} open={open==="tax"} onToggle={()=>tog("tax")} right={<button disabled style={DISABLED_EDIT}>Edit</button>}>
        <div style={{marginTop:6}}>
          <div><strong>Default rate:</strong> {(TAX*100).toFixed(3)}%</div>
          <div style={{color:T.muted,marginTop:4}}><strong>Custom rates:</strong> none configured</div>
        </div>
      </Card>

      <Card title="Services & pricing" subtitle={`${SVC.length} standard + 3 custom slots`} open={open==="svc"} onToggle={()=>tog("svc")} right={<button disabled style={DISABLED_EDIT}>Edit</button>}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:4,marginTop:6}}>
          {SVC.map(s=><div key={s.k} style={{color:T.dark,fontSize:12}}>&middot; {s.l}</div>)}
          <div style={{color:T.muted,fontSize:12,fontStyle:"italic"}}>&middot; Custom fee 1</div>
          <div style={{color:T.muted,fontSize:12,fontStyle:"italic"}}>&middot; Custom fee 2</div>
          <div style={{color:T.muted,fontSize:12,fontStyle:"italic"}}>&middot; Custom fee 3</div>
        </div>
      </Card>

      <Card title="Partners" subtitle={`${PARTNERS.length} known`} open={open==="prt"} onToggle={()=>tog("prt")} right={<button disabled style={DISABLED_EDIT}>Edit</button>}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:4,marginTop:6}}>
          {PARTNERS.map(p=><div key={p} style={{fontSize:12,color:T.dark}}>&middot; {p}</div>)}
        </div>
      </Card>

      <Card title="Team" subtitle="2 members" open={open==="team"} onToggle={()=>tog("team")} right={<button disabled style={DISABLED_EDIT}>Edit</button>}>
        <div style={{marginTop:6}}>
          <div><strong>Kevin</strong> &middot; <span style={{color:T.muted}}>driver</span></div>
          <div><strong>Joey</strong> &middot; <span style={{color:T.muted}}>admin</span></div>
        </div>
      </Card>

      <Card title="Test Mode" subtitle={testMode?"ON — captures route to Test tab":"Off"} open={open==="test"} onToggle={()=>tog("test")} right={
        <div onClick={e=>{e.stopPropagation();setTestMode(!testMode)}} style={{width:38,height:22,borderRadius:11,background:testMode?"#c2410c":"#d1d5db",position:"relative",cursor:"pointer",flexShrink:0}}>
          <div style={{width:18,height:18,borderRadius:9,background:"#fff",position:"absolute",top:2,left:testMode?18:2,transition:"left .15s"}} />
        </div>
      }>
        <div style={{marginTop:6,color:T.muted}}>When on, newly captured jobs are sent to the Test Jobs sheet tab instead of the live App Jobs tab. Use it to practice the capture flow without creating real entries.</div>
      </Card>

      <Card title="Data" subtitle={`${jobs.filter(j=>j.status!=="deleted").length} jobs stored`} open={open==="data"} onToggle={()=>tog("data")} right={null}>
        <div style={{marginTop:6,color:T.muted,marginBottom:12}}>Export every non-deleted job to CSV (20 columns matching the Google Sheet).</div>
        <button onClick={exportCSV} style={{padding:"10px 16px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:T.dark,color:"#fff"}}>Export all jobs to CSV</button>
      </Card>
    </div>
  );
}
