import React, { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { T } from "../styles/theme";
import { createLinkToken, exchangePublicToken, isNotConfigured } from "../lib/plaidClient";

function LinkButton({ linkToken, onConnected, label }) {
  const [busy, setBusy] = useState(false);
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token) => {
      setBusy(true);
      try {
        const r = await exchangePublicToken(public_token);
        if (r.ok) onConnected?.(r.data);
      } finally {
        setBusy(false);
      }
    },
    onExit: () => {},
  });
  return (
    <button
      onClick={() => open()}
      disabled={!ready || busy}
      style={{padding:"12px 18px",borderRadius:10,border:"none",cursor:(!ready||busy)?"default":"pointer",fontSize:14,fontWeight:600,background:T.dark,color:"#fff",opacity:(!ready||busy)?.6:1}}
    >
      {busy ? "Connecting\u2026" : (label || "Connect bank account")}
    </button>
  );
}

export default function PlaidConnect({ onConnected, label }) {
  const [token, setToken] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | unconfigured | error
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await createLinkToken();
      if (cancelled) return;
      if (isNotConfigured(r)) { setState("unconfigured"); return; }
      if (r.ok && r.data.link_token) {
        try { sessionStorage.setItem("plaid_link_token", r.data.link_token); } catch {}
        setToken(r.data.link_token);
        setState("ready");
      } else {
        setErr(r.data.error || "Cannot create link token");
        setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state === "unconfigured") return <div style={{fontSize:12,color:T.muted,padding:"10px 0"}}>Bank connection not yet configured. Add Plaid keys in Vercel to enable.</div>;
  if (state === "error") return <div style={{fontSize:12,color:T.red,padding:"10px 0"}}>Error: {err}</div>;
  if (state === "loading" || !token) return <div style={{fontSize:12,color:T.muted,padding:"10px 0"}}>Preparing bank connect\u2026</div>;
  return <LinkButton linkToken={token} onConnected={onConnected} label={label} />;
}
