import React, { useRef, useState } from "react";
import { T, lbl } from "../styles/theme";

export default function Photo({label,icon,value,onChange}){
  const ref=useRef(null);
  const[prev,setPrev]=useState(value);
  return(<div><div style={lbl}>{label}</div>{prev?<div style={{position:"relative",borderRadius:8,overflow:"hidden",border:`1.5px solid ${T.border}`}}><img src={prev} alt={label} style={{width:"100%",height:100,objectFit:"cover",display:"block"}} /><button onClick={e=>{e.stopPropagation();setPrev(null);onChange(null);if(ref.current)ref.current.value=""}} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,.6)",color:"#fff",border:"none",borderRadius:"50%",width:24,height:24,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>&times;</button></div>:<div onClick={()=>ref.current?.click()} style={{border:`1.5px dashed ${T.border}`,borderRadius:8,padding:"18px 8px",textAlign:"center",color:T.muted,fontSize:11,cursor:"pointer",background:T.surface}}><div style={{fontSize:20,marginBottom:2}}>{icon}</div>Tap</div>}<input ref={ref} type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files[0];if(!f)return;const r2=new FileReader();r2.onloadend=()=>{setPrev(r2.result);onChange(r2.result)};r2.readAsDataURL(f)}} style={{display:"none"}} /></div>);
}
