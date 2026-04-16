import React, { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { T } from "../styles/theme";
import { exchangePublicToken } from "../lib/plaidClient";

export default function PlaidCallback() {
  const [msg, setMsg] = useState("Completing bank connection\u2026");
  const token = (() => { try { return sessionStorage.getItem("plaid_link_token"); } catch { return null; } })();

  const { open, ready } = usePlaidLink({
    token: token || "",
    receivedRedirectUri: typeof window !== "undefined" ? window.location.href : undefined,
    onSuccess: async (public_token) => {
      setMsg("Finalizing\u2026");
      await exchangePublicToken(public_token);
      try { sessionStorage.removeItem("plaid_link_token"); } catch {}
      window.location.href = "/";
    },
    onExit: () => { window.location.href = "/"; },
  });

  useEffect(() => { if (ready && token) open(); }, [ready, token, open]);

  if (!token) {
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font,padding:20,background:T.bg}}>
        <div style={{textAlign:"center",maxWidth:320}}>
          <div style={{fontSize:18,fontWeight:700,color:T.dark,marginBottom:8}}>Session expired</div>
          <div style={{fontSize:13,color:T.muted,marginBottom:16}}>Please return to Finances and start the bank connection again.</div>
          <a href="/" style={{display:"inline-block",padding:"10px 16px",borderRadius:10,background:T.dark,color:"#fff",textDecoration:"none",fontSize:14,fontWeight:600}}>Return home</a>
        </div>
      </div>
    );
  }
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font,background:T.bg}}>
      <div style={{fontSize:14,color:T.muted}}>{msg}</div>
    </div>
  );
}
