import React, { useState } from "react";
import { T, inp, btnP } from "../styles/theme";
import { PIN } from "../lib/constants";

export default function Login({onAuth}){
  const[pin,setPin]=useState("");
  const[err,setErr]=useState(false);
  const go=()=>{if(pin.toLowerCase()===PIN){localStorage.setItem("ut-auth","1");onAuth()}else{setErr(true);setTimeout(()=>setErr(false),2000)}};
  return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.dark,fontFamily:T.font}}><div onKeyDown={e=>e.key==="Enter"&&go()} style={{textAlign:"center",padding:40,width:280}}><div style={{fontSize:28,fontWeight:800,color:"#fff",letterSpacing:"-.5px"}}>United Towing</div><div style={{fontSize:13,color:"#666",marginTop:4,marginBottom:28}}>& Transport LLC</div><input value={pin} onChange={e=>{setPin(e.target.value);setErr(false)}} type="password" placeholder="Access code" autoFocus style={{...inp,background:"#1f2937",border:err?"2px solid #dc2626":"2px solid #374151",color:"#fff",textAlign:"center",fontSize:18,letterSpacing:4,marginBottom:14}} /><button onClick={go} style={{...btnP,background:"#fff",color:T.dark}}>Enter</button>{err&&<div style={{color:"#dc2626",fontSize:13,marginTop:12}}>Wrong code</div>}</div></div>);
}
