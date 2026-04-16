import React, { useState, useEffect, useRef } from "react";
import { T } from "../styles/theme";

export default function Header({testMode,setTestMode,onSignOut}){
  const[open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const close=(e)=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};
    document.addEventListener("mousedown",close);
    document.addEventListener("touchstart",close);
    return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("touchstart",close)};
  },[open]);
  return(
    <header style={{position:"fixed",top:0,left:0,right:0,height:48,background:T.surface,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",zIndex:50,fontFamily:T.font}}>
      <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
        <div style={{fontSize:15,fontWeight:800,color:T.dark,letterSpacing:"-.3px"}}>United Towing</div>
        <div style={{fontSize:12,color:T.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>& Transport</div>
        {testMode&&<span style={{padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700,background:"#fff7ed",color:"#c2410c",border:"1px solid #fed7aa",letterSpacing:.3}}>TEST</span>}
      </div>
      <div ref={ref} style={{position:"relative"}}>
        <button onClick={()=>setOpen(o=>!o)} aria-label="Menu" style={{width:36,height:36,border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:8,color:T.dark}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
        </button>
        {open&&<div style={{position:"absolute",top:42,right:0,background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,boxShadow:"0 4px 16px rgba(0,0,0,.12)",minWidth:220,overflow:"hidden",zIndex:60}}>
          <div onClick={()=>setTestMode(!testMode)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",cursor:"pointer",borderBottom:`1px solid ${T.border}`}}>
            <div><div style={{fontSize:13,fontWeight:600,color:T.dark}}>Test Mode</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>Routes captures to Test tab</div></div>
            <div style={{width:38,height:22,borderRadius:11,background:testMode?"#c2410c":"#d1d5db",position:"relative",flexShrink:0}}><div style={{width:18,height:18,borderRadius:9,background:"#fff",position:"absolute",top:2,left:testMode?18:2,transition:"left .15s"}} /></div>
          </div>
          <div onClick={()=>{setOpen(false);onSignOut()}} style={{padding:"12px 14px",cursor:"pointer",fontSize:13,fontWeight:600,color:T.red}}>Sign out</div>
        </div>}
      </div>
    </header>
  );
}
