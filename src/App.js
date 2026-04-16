import React, { useState, useEffect, useCallback } from "react";
import { fetchAll, cacheJobs, loadCached } from "./lib/sync";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import PlaidCallback from "./components/PlaidCallback";

const isPlaidCallback = typeof window !== "undefined" && window.location.pathname === "/plaid-callback";

export default function App(){
  const[auth,setAuth]=useState(()=>localStorage.getItem("ut-auth")==="1");
  const[jobs,setJobs]=useState([]);
  const[loading,setLoading]=useState(false);
  const load=useCallback(async()=>{
    setLoading(true);
    const r=await fetchAll();
    if(r&&r.length>0){setJobs(r);cacheJobs(r)}
    else{const c=loadCached();if(c.length>0)setJobs(c)}
    setLoading(false);
  },[]);
  useEffect(()=>{if(auth && !isPlaidCallback)load()},[auth,load]);
  const add=useCallback(j=>{setJobs(p=>{const n=[...p,j];cacheJobs(n);return n})},[]);
  const signOut=()=>{localStorage.removeItem("ut-auth");setAuth(false)};
  if(isPlaidCallback)return<PlaidCallback />;
  if(!auth)return<Login onAuth={()=>setAuth(true)} />;
  return<Dashboard jobs={jobs} setJobs={setJobs} onAdd={add} onSignOut={signOut} loading={loading} refresh={load} />;
}
