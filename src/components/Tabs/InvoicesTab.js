import React from "react";
import { T } from "../../styles/theme";
import { ST } from "../../lib/constants";
import { money } from "../../lib/format";
import { ago } from "../../lib/math";

export default function InvoicesTab({jobs=[]}){
  const now = new Date();
  const thisMonth = now.toISOString().slice(0,7);
  const paidThisMonth = jobs.filter(j=>j.status===ST.PAID&&(j.jobDate||"").startsWith(thisMonth)).reduce((a,j)=>a+(parseFloat(j.price)||0),0);
  const outstanding = jobs.filter(j=>j.status===ST.UNPAID&&j.price&&!isNaN(j.price)).reduce((a,j)=>a+(parseFloat(j.price)||0),0);
  const overdue = jobs.filter(j=>j.status===ST.UNPAID&&j.price&&!isNaN(j.price)&&ago(j.jobDate)>30).length;
  const drafts = 0;
  const tiles = [
    { l:"Paid this month", v:money(paidThisMonth), c:T.accent },
    { l:"Outstanding", v:money(outstanding), c:T.red },
    { l:"Overdue", v:overdue, c:T.amber },
    { l:"Drafts", v:drafts, c:T.muted },
  ];
  return(
    <div>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:22,fontWeight:700,color:T.dark}}>Invoices</div>
        <div style={{fontSize:13,color:T.muted,marginTop:4}}>Send and track invoices</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:18}}>
        {tiles.map((t,i)=>(
          <div key={i} style={{background:T.surface,borderRadius:T.radius,padding:"12px 14px",boxShadow:T.shadow}}>
            <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{t.l}</div>
            <div style={{fontSize:20,fontWeight:700,color:t.c}}>{t.v}</div>
          </div>
        ))}
      </div>
      <div style={{background:T.surface,borderRadius:T.radius,padding:"24px 18px",boxShadow:T.shadow,textAlign:"center"}}>
        <div style={{fontSize:13,color:T.dark,fontWeight:600,marginBottom:6}}>Per-job invoicing only</div>
        <div style={{fontSize:12,color:T.muted,lineHeight:1.5,marginBottom:14}}>Invoices are currently generated per-job via the PDF button. Multi-job invoicing coming soon.</div>
        <button disabled title="Coming soon" style={{padding:"10px 16px",borderRadius:10,border:"none",cursor:"not-allowed",fontSize:13,fontWeight:600,background:T.dark,color:"#fff",opacity:.5}}>+ Create multi-job invoice</button>
      </div>
    </div>
  );
}
