import React from "react";
import { T } from "../styles/theme";
import { SVC } from "../lib/constants";

export default function SvcPricing({services,onChange}){
  const s=services||{};
  const customs=[{nk:"custom1_name",vk:"custom1"},{nk:"custom2_name",vk:"custom2"},{nk:"custom3_name",vk:"custom3"}];
  return(<div style={{display:"grid",gap:2}}>
    {SVC.map(i=>{const v=s[i.k]||"";const on=parseFloat(v)>0;return(<div key={i.k} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0"}}><div style={{flex:1,fontSize:14,fontWeight:on?600:400,color:on?T.dark:T.muted}}>{i.l}</div><input value={v} onChange={e=>onChange({...s,[i.k]:e.target.value})} placeholder="$0" type="number" inputMode="decimal" style={{width:90,padding:"8px 10px",fontSize:15,borderRadius:8,fontWeight:on?700:400,border:`1.5px solid ${on?T.accent:T.border}`,background:on?"#f0fdf4":T.surface,textAlign:"right",boxSizing:"border-box",fontFamily:T.font,outline:"none"}} /></div>)})}
    <div style={{borderTop:`1px solid ${T.border}`,marginTop:6,paddingTop:8}}>
      <div style={{fontSize:11,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>Custom fees</div>
      {customs.map(c=>{const nm=s[c.nk]||"";const v=s[c.vk]||"";const on=parseFloat(v)>0;return(<div key={c.vk} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0"}}><input value={nm} onChange={e=>onChange({...s,[c.nk]:e.target.value})} placeholder="Fee name" style={{flex:1,padding:"8px 10px",fontSize:14,borderRadius:8,border:`1.5px solid ${on?"#3b82f6":T.border}`,background:on?"#eff6ff":T.surface,boxSizing:"border-box",fontFamily:T.font,outline:"none",fontWeight:on?600:400,color:on?T.dark:T.muted}} /><input value={v} onChange={e=>onChange({...s,[c.vk]:e.target.value})} placeholder="$0" type="number" inputMode="decimal" style={{width:90,padding:"8px 10px",fontSize:15,borderRadius:8,fontWeight:on?700:400,border:`1.5px solid ${on?"#3b82f6":T.border}`,background:on?"#eff6ff":T.surface,textAlign:"right",boxSizing:"border-box",fontFamily:T.font,outline:"none"}} /></div>)})}
    </div>
  </div>);
}
