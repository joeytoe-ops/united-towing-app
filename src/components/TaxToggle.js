import React from "react";
import { T, inp } from "../styles/theme";
import { TAX } from "../lib/constants";

export default function TaxToggle({taxMode,taxRate,onChange}){
  const mode=taxMode||"standard";
  const rate=taxRate!=null?taxRate:TAX;
  const set=(m,r)=>onChange(m,r);
  return(<div>
    <div style={{display:"flex",borderRadius:10,overflow:"hidden",border:`1.5px solid ${T.border}`,marginBottom:mode==="custom"?8:0}}>
      {[{v:"standard",l:`Tax ${(TAX*100).toFixed(3)}%`,c:T.accent},{v:"exempt",l:"Tax Exempt",c:T.muted},{v:"custom",l:"Custom Rate",c:T.blue}].map((o,i)=>(
        <div key={o.v} onClick={()=>{if(o.v==="standard")set("standard",TAX);else if(o.v==="exempt")set("exempt",0);else set("custom",rate||TAX)}} style={{flex:1,padding:"10px 0",textAlign:"center",fontSize:12,fontWeight:600,cursor:"pointer",background:mode===o.v?o.c:T.surface,color:mode===o.v?"#fff":T.muted,borderLeft:i>0?`1px solid ${T.border}`:"none"}}>{o.l}</div>
      ))}
    </div>
    {mode==="custom"&&<div style={{display:"flex",alignItems:"center",gap:8}}>
      <input value={rate?Math.round(rate*10000)/100:""} onChange={e=>{const v=parseFloat(e.target.value);set("custom",isNaN(v)?0:v/100)}} placeholder="8.375" type="number" inputMode="decimal" step="0.001" style={{...inp,flex:1,fontSize:14}} />
      <span style={{fontSize:13,color:T.muted,fontWeight:600}}>%</span>
    </div>}
  </div>);
}
