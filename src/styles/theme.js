export const T = {
  bg:"#f4f3f0", surface:"#ffffff", dark:"#111827", accent:"#16a34a",
  red:"#dc2626", amber:"#d97706", blue:"#2563eb", muted:"#6b7280",
  border:"#e5e5e5", radius:10, shadow:"0 1px 3px rgba(0,0,0,.08)",
  font:"'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
};

export const inp = {width:"100%",padding:"11px 12px",fontSize:15,borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface,boxSizing:"border-box",fontFamily:T.font,outline:"none"};
export const lbl = {fontSize:11,fontWeight:600,color:T.muted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.5};
export const btnP = {padding:"12px 20px",borderRadius:10,border:"none",cursor:"pointer",fontSize:15,fontWeight:600,background:T.dark,color:"#fff",width:"100%"};
export const btnS = {...btnP,background:T.bg,color:T.dark,border:`1.5px solid ${T.border}`};
