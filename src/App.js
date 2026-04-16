import React, { useState, useEffect, useCallback } from "react";
import { fetchAll, cacheJobs, loadCached } from "./lib/sync";
import Login from "./components/Login";
import Capture from "./components/Capture";
import Dashboard from "./components/Dashboard";

export default function App(){
  const[auth,setAuth]=useState(()=>localStorage.getItem("ut-auth")==="1");
  const[jobs,setJobs]=useState([]);
  const[view,setView]=useState("dash");
  const[loading,setLoading]=useState(false);
  const load=useCallback(async()=>{
    setLoading(true);
    const r=await fetchAll();
    if(r&&r.length>0){setJobs(r);cacheJobs(r)}
    else{const c=loadCached();if(c.length>0)setJobs(c)}
    setLoading(false);
  },[]);
  useEffect(()=>{if(auth)load()},[auth,load]);
  const add=useCallback(j=>{setJobs(p=>{const n=[...p,j];cacheJobs(n);return n});setView("dash")},[]);
  if(!auth)return<Login onAuth={()=>setAuth(true)} />;
  if(view==="log")return<Capture onSubmit={add} onCancel={()=>setView("dash")} />;
  return<Dashboard jobs={jobs} setJobs={setJobs} onNew={()=>setView("log")} onOut={()=>{localStorage.removeItem("ut-auth");setAuth(false)}} loading={loading} refresh={load} />;
}
