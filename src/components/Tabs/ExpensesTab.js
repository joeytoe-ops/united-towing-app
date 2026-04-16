import React from "react";
import { T } from "../../styles/theme";

const CATS = [
  { k:"fuel", l:"Fuel" },
  { k:"maintenance", l:"Maintenance" },
  { k:"tolls", l:"Tolls" },
  { k:"supplies", l:"Supplies" },
];

export default function ExpensesTab(){
  return(
    <div>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:22,fontWeight:700,color:T.dark}}>Expenses</div>
        <div style={{fontSize:13,color:T.muted,marginTop:4}}>Track fuel, maintenance, tolls, and supplies</div>
      </div>
      <div style={{background:T.surface,borderRadius:T.radius,padding:"28px 20px",boxShadow:T.shadow,textAlign:"center",marginBottom:18}}>
        <div style={{fontSize:14,color:T.dark,fontWeight:600,marginBottom:6}}>No expenses tracked yet</div>
        <div style={{fontSize:12,color:T.muted,lineHeight:1.5,marginBottom:16}}>Connect your bank and card accounts to auto-import, or add manually.</div>
        <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
          <button disabled title="Coming soon" style={{padding:"10px 16px",borderRadius:10,border:"none",cursor:"not-allowed",fontSize:13,fontWeight:600,background:T.dark,color:"#fff",opacity:.5}}>Connect bank</button>
          <button disabled title="Coming soon" style={{padding:"10px 16px",borderRadius:10,border:`1.5px solid ${T.border}`,cursor:"not-allowed",fontSize:13,fontWeight:600,background:T.surface,color:T.muted,opacity:.6}}>Add expense</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
        {CATS.map(c=>(
          <div key={c.k} style={{background:T.surface,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow}}>
            <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>{c.l}</div>
            <div style={{fontSize:20,fontWeight:700,color:T.dark}}>$0.00</div>
            <div style={{fontSize:11,color:T.muted,marginTop:4}}>&mdash;</div>
          </div>
        ))}
      </div>
    </div>
  );
}
