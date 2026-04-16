import React from "react";
import { T } from "../styles/theme";
import { ST } from "../lib/constants";

export default function StatusToggle({status,onChange}){
  return(<div style={{display:"flex",borderRadius:10,overflow:"hidden",border:`1.5px solid ${T.border}`}}>{[{v:ST.PAID,l:"Paid",c:T.accent},{v:ST.UNPAID,l:"Unpaid",c:T.red},{v:ST.MISSING,l:"Missing info",c:T.amber}].map((o,i)=>(<div key={o.v} onClick={()=>onChange(o.v)} style={{flex:1,padding:"12px 0",textAlign:"center",fontSize:13,fontWeight:600,cursor:"pointer",background:status===o.v?o.c:T.surface,color:status===o.v?"#fff":T.muted,borderLeft:i>0?`1px solid ${T.border}`:"none"}}>{o.l}</div>))}</div>);
}
