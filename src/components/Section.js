import React from "react";
import { T } from "../styles/theme";

export default function Section({title,children,style:s}){
  return(<div style={{background:T.bg,borderRadius:10,padding:"14px 16px",marginBottom:14,...s}}>{title&&<div style={{fontSize:13,fontWeight:700,color:T.dark,marginBottom:10}}>{title}</div>}{children}</div>);
}
