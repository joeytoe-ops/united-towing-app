import React from "react";
import { getMissing } from "../lib/math";

export default function MissingPills({job}){
  const m=getMissing(job);
  if(m.length===0)return null;
  return(<div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:3}}>{m.map(f=>{
    const isReceipt=f==="Receipt";
    return <span key={f} style={{padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600,background:isReceipt?"#eff6ff":"#fef3c7",color:isReceipt?"#1e40af":"#92400e",whiteSpace:"nowrap"}}>No {f.toLowerCase()}</span>;
  })}</div>);
}
