import React, { useState } from "react";
import { T, btnS } from "../../styles/theme";
import { ST } from "../../lib/constants";
import { fmtDate, money } from "../../lib/format";
import { ago, getMissing } from "../../lib/math";
import { cacheJobs } from "../../lib/sync";
import EditPanel from "../EditPanel";
import MissingPills from "../MissingPills";

function greeting(){
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function pctChange(cur, prior){
  if (prior === 0 || prior == null) return null;
  return Math.round(((cur - prior) / prior) * 100);
}

function TrendRow({delta}){
  if (delta == null) return <div style={{fontSize:11,color:T.muted,marginTop:4}}>&mdash; no prior data</div>;
  if (delta > 0) return <div style={{fontSize:11,color:T.accent,marginTop:4,fontWeight:600}}>&#9650; +{delta}% vs prior 30d</div>;
  if (delta < 0) return <div style={{fontSize:11,color:T.red,marginTop:4,fontWeight:600}}>&#9660; {delta}% vs prior 30d</div>;
  return <div style={{fontSize:11,color:T.muted,marginTop:4}}>&mdash; unchanged</div>;
}

export default function JobsTab({jobs,setJobs,onNew,loading,refresh}){
  const[edit,setEdit]=useState(null);const[filt,setFilt]=useState("action");
  const[q,setQ]=useState("");const[src,setSrc]=useState("all");const[show,setShow]=useState(50);

  let pool=jobs;if(src==="app")pool=jobs.filter(j=>j.source==="app");else if(src==="migrated")pool=jobs.filter(j=>j.source==="migrated");
  const unpaid=pool.filter(j=>j.status!==ST.PAID&&j.price&&!isNaN(j.price));
  const missing=pool.filter(j=>!j.price||isNaN(j.price));
  const paid=pool.filter(j=>j.status===ST.PAID);
  const needsInfo=pool.filter(j=>getMissing(j).length>0);
  const unpAmt=unpaid.reduce((a,j)=>a+(parseFloat(j.price)||0),0);
  const aging={"0-30":0,"30-60":0,"60-90":0,"90+":0};
  unpaid.forEach(j=>{const d=ago(j.jobDate);if(d<=30)aging["0-30"]++;else if(d<=60)aging["30-60"]++;else if(d<=90)aging["60-90"]++;else aging["90+"]++});
  const maxA=Math.max(...Object.values(aging),1);
  const ar={};unpaid.forEach(j=>{const n=j.customer.name;if(!n)return;if(!ar[n])ar[n]={n2:0,t:0,old:j.jobDate};ar[n].n2++;ar[n].t+=parseFloat(j.price)||0;if(j.jobDate&&j.jobDate<(ar[n].old||"9"))ar[n].old=j.jobDate});
  const arList=Object.entries(ar).sort((a,b)=>b[1].t-a[1].t);
  const oneOff=unpaid.filter(j=>!j.customer.name);const oneOffAmt=oneOff.reduce((a,j)=>a+(parseFloat(j.price)||0),0);
  const missingBreakdown={Price:0,Customer:0,Pickup:0,Dropoff:0,Vehicle:0,Receipt:0};
  needsInfo.forEach(j=>getMissing(j).forEach(f=>{if(missingBreakdown[f]!==undefined)missingBreakdown[f]++}));

  /* Today snapshot — based on ALL jobs regardless of source filter */
  const todayISO=new Date().toISOString().split("T")[0];
  const todayJobs=jobs.filter(j=>j.jobDate===todayISO);
  const todayPaid=todayJobs.filter(j=>j.status===ST.PAID);
  const todayRev=todayPaid.reduce((a,j)=>a+(parseFloat(j.price)||0),0);
  const todayInProgress=todayJobs.filter(j=>j.status!==ST.PAID).length;

  /* 30-day rolling stats + prior period for trends */
  const cur30=jobs.filter(j=>{const d=ago(j.jobDate);return j.jobDate&&d>=0&&d<=30});
  const prior30=jobs.filter(j=>{const d=ago(j.jobDate);return j.jobDate&&d>=31&&d<=60});
  const rev30=cur30.filter(j=>j.status===ST.PAID).reduce((a,j)=>a+(parseFloat(j.price)||0),0);
  const revPrior=prior30.filter(j=>j.status===ST.PAID).reduce((a,j)=>a+(parseFloat(j.price)||0),0);
  const n30=cur30.length, nPrior=prior30.length;
  const avg30=n30?rev30/n30:0;
  const avgPrior=nPrior?revPrior/nPrior:0;
  const paid30c=cur30.filter(j=>j.status===ST.PAID&&j.price&&!isNaN(j.price)).length;
  const unpaid30c=cur30.filter(j=>j.status===ST.UNPAID&&j.price&&!isNaN(j.price)).length;
  const coll30=(paid30c+unpaid30c)?Math.round((paid30c/(paid30c+unpaid30c))*100):0;
  const paidPriorC=prior30.filter(j=>j.status===ST.PAID&&j.price&&!isNaN(j.price)).length;
  const unpaidPriorC=prior30.filter(j=>j.status===ST.UNPAID&&j.price&&!isNaN(j.price)).length;
  const collPrior=(paidPriorC+unpaidPriorC)?Math.round((paidPriorC/(paidPriorC+unpaidPriorC))*100):0;

  const stats30=[
    {l:"Revenue (30d)",v:money(rev30),delta:pctChange(rev30,revPrior),c:T.accent},
    {l:"Jobs (30d)",v:n30,delta:pctChange(n30,nPrior),c:T.dark},
    {l:"Avg job value",v:money(avg30),delta:pctChange(avg30,avgPrior),c:T.dark},
    {l:"Collection rate",v:`${coll30}%`,delta:pctChange(coll30,collPrior),c:T.blue},
  ];

  const snap=[
    {l:"Jobs completed today",v:todayPaid.length,c:T.accent},
    {l:"Revenue today",v:money(todayRev),c:T.accent},
    {l:"In progress",v:todayInProgress,c:T.amber},
  ];

  let list=pool;if(!q){if(filt==="action")list=pool.filter(j=>j.status!==ST.PAID);else if(filt==="unpaid")list=unpaid;else if(filt==="missing")list=missing;else if(filt==="needs_info")list=needsInfo;else if(filt==="paid")list=paid;}
  if(q){const s=q.toLowerCase();list=list.filter(j=>{try{const dateStr=fmtDate(j.jobDate).toLowerCase();const isoDate=(j.jobDate||"").toLowerCase();return (j.customer?.name||"").toLowerCase().includes(s)||(j.title||"").toLowerCase().includes(s)||(j.vehicle?.make||"").toLowerCase().includes(s)||(j.vehicle?.model||"").toLowerCase().includes(s)||(j.vehicle?.color||"").toLowerCase().includes(s)||(j.vehicle?.plate||"").toLowerCase().includes(s)||(j.vehicle?.vin||"").toLowerCase().includes(s)||(j.vehicle?.year||"").toLowerCase().includes(s)||(j.notes||"").toLowerCase().includes(s)||(j.pickup||"").toLowerCase().includes(s)||(j.pickupCity||"").toLowerCase().includes(s)||(j.dropoff||"").toLowerCase().includes(s)||(j.dropoffCity||"").toLowerCase().includes(s)||(j.paymentType||"").toLowerCase().includes(s)||dateStr.includes(s)||isoDate.includes(s)||(j.id||"").toLowerCase().includes(s)}catch{return false}})}
  list=[...list].sort((a,b)=>(b.jobDate||"").localeCompare(a.jobDate||""));
  const legN=jobs.filter(j=>j.source==="migrated").length;const appN=jobs.filter(j=>j.source==="app").length;
  const handleSave=saved=>{setJobs(prev=>{const next=prev.map(j=>j.id===saved.id?saved:j);if(!prev.find(j=>j.id===saved.id))next.push(saved);cacheJobs(next);return next});setEdit(null)};
  const handleDelete=id=>{setJobs(prev=>{const next=prev.filter(j=>j.id!==id);cacheJobs(next);return next});setEdit(null)};

  return(<>
    {/* Greeting */}
    <div style={{marginBottom:14}}>
      <div style={{fontSize:22,fontWeight:600,color:T.dark,letterSpacing:"-.3px"}}>{greeting()}, Joey</div>
      <div style={{fontSize:12,color:T.muted,marginTop:2}}>{loading?"Loading\u2026":`${jobs.length} jobs total`}</div>
    </div>

    {/* Source filter pills */}
    <div style={{display:"flex",gap:6,marginBottom:16}}>{[["all","All"],["migrated",`Migrated (${legN})`],["app",`New (${appN})`]].map(([k,l2])=><span key={k} onClick={()=>{setSrc(k);setShow(50)}} style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",background:src===k?T.dark:T.surface,color:src===k?"#fff":T.muted,border:`1.5px solid ${src===k?T.dark:T.border}`}}>{l2}</span>)}</div>

    {/* Today's snapshot */}
    <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>Today</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10,marginBottom:18}}>
      {snap.map((s,i)=>(
        <div key={i} style={{background:T.surface,borderRadius:T.radius,padding:"16px",boxShadow:T.shadow}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5}}>{s.l}</div>
          <div style={{fontSize:24,fontWeight:700,color:s.c,marginTop:4}}>{s.v}</div>
        </div>
      ))}
    </div>

    {/* 30-day stats with trends */}
    <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>Last 30 days</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:20}}>
      {stats30.map((s,i)=>(
        <div key={i} style={{background:T.surface,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5}}>{s.l}</div>
          <div style={{fontSize:22,fontWeight:700,color:s.c,marginTop:4}}>{s.v}</div>
          <TrendRow delta={s.delta} />
        </div>
      ))}
    </div>

    {/* Aging + Unpaid Partners */}
    <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:12,marginBottom:18}}>
      <div style={{background:T.surface,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow}}><div style={{fontSize:14,fontWeight:700,color:T.red,marginBottom:10}}>Unpaid partners</div>{arList.length===0&&<div style={{fontSize:12,color:T.muted,textAlign:"center",padding:10}}>None</div>}{arList.map(([n,d],i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:i<arList.length-1?`1px solid ${T.bg}`:""}}><div><div style={{fontSize:13,fontWeight:600,color:T.dark}}>{n}</div><div style={{fontSize:10,color:T.muted}}>{d.n2} jobs &middot; {ago(d.old)}d</div></div><div style={{fontSize:14,fontWeight:700,color:T.red}}>{money(d.t)}</div></div>)}{oneOff.length>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"7px 0",color:T.muted,fontSize:12}}><span>One-off ({oneOff.length})</span><span>{money(oneOffAmt)}</span></div>}<div style={{borderTop:`2px solid ${T.border}`,marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700}}><span>Total outstanding</span><span style={{color:T.red}}>{money(unpAmt)}</span></div></div>
      <div style={{background:T.surface,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow}}><div style={{fontSize:14,fontWeight:700,color:T.dark,marginBottom:10}}>Aging</div>{[{l:"0\u201330 days",n:aging["0-30"],c:T.accent},{l:"30\u201360 days",n:aging["30-60"],c:T.amber},{l:"60\u201390 days",n:aging["60-90"],c:"#ea580c"},{l:"90+ days",n:aging["90+"],c:T.red}].map((a,i)=><div key={i} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted,marginBottom:3}}><span>{a.l}</span><span style={{fontWeight:600}}>{a.n}</span></div><div style={{height:10,borderRadius:5,background:T.bg,overflow:"hidden"}}><div style={{width:`${Math.round((a.n/maxA)*100)}%`,height:"100%",background:a.c,borderRadius:5}} /></div></div>)}<div style={{fontSize:11,color:T.muted,marginTop:4,paddingTop:8,borderTop:`1px solid ${T.border}`}}>Goal: collect within 30 days</div></div>
    </div>

    {/* Needs Info breakdown — moved below Unpaid Partners per Phase 3 spec */}
    {needsInfo.length>0&&<div style={{background:T.surface,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow,marginBottom:18,border:"1.5px solid #fde68a"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:14,fontWeight:700,color:"#92400e"}}>{needsInfo.length} jobs need info</div>
        <span onClick={()=>{setFilt("needs_info");setShow(50)}} style={{fontSize:12,fontWeight:600,color:T.blue,cursor:"pointer"}}>View all &rarr;</span>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{Object.entries(missingBreakdown).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([k,v])=><div key={k} style={{background:"#fef3c7",borderRadius:8,padding:"6px 12px",fontSize:12}}><span style={{fontWeight:700,color:"#92400e"}}>{v}</span><span style={{color:"#78350f",marginLeft:4}}>no {k.toLowerCase()}</span></div>)}</div>
    </div>}

    {/* Jobs list panel */}
    <div style={{background:T.surface,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{fontSize:15,fontWeight:700,color:T.dark}}>Jobs</div>
          <button onClick={refresh} title="Refresh from Sheets" style={{width:28,height:28,border:`1.5px solid ${T.border}`,background:T.surface,cursor:"pointer",borderRadius:8,color:T.muted,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{loading?"\u23F3":"\u21BB"}</button>
        </div>
        <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}><input value={q} onChange={e=>{setQ(e.target.value);setShow(50)}} placeholder="Search..." style={{padding:"6px 10px",fontSize:12,borderRadius:8,border:`1.5px solid ${T.border}`,width:120,fontFamily:T.font,outline:"none"}} />{["action","unpaid","needs_info","paid","all"].map(f=><span key={f} onClick={()=>{setFilt(f);setShow(50)}} style={{padding:"5px 10px",borderRadius:14,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",background:filt===f?T.dark:T.bg,color:filt===f?"#fff":T.muted}}>{f==="action"?"Needs action":f==="needs_info"?"Needs info":f==="unpaid"?"Unpaid":f==="paid"?"Paid":"All"}</span>)}</div>
      </div>
      {list.slice(0,show).map(j=>{const title=j.title||[j.vehicle.color,j.vehicle.make,j.vehicle.model].filter(Boolean).join(" ")||"No info";const mi=getMissing(j);const hasGaps=mi.length>0;const sc=j.status===ST.PAID?T.accent:(j.status===ST.UNPAID?T.red:T.amber);const sl=j.status===ST.PAID?"Paid":(j.status===ST.UNPAID?"Unpaid":(hasGaps?"Needs info":"Missing"));return(<div key={j.id} onClick={()=>setEdit(j)} style={{padding:"11px 0",borderBottom:`1px solid ${T.bg}`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:600,color:T.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}{j.source==="migrated"&&<span style={{padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:700,background:"#eff6ff",color:"#2563eb",marginLeft:6,verticalAlign:"middle"}}>M</span>}{j.receiptMissing&&<span style={{padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:700,background:"#fffbeb",color:T.amber,marginLeft:4,verticalAlign:"middle"}}>No rcpt</span>}</div><div style={{fontSize:12,color:T.muted,marginTop:2}}>{j.customer.name||""}{j.customer.name&&" \u00B7 "}{fmtDate(j.jobDate)}</div>{hasGaps&&<MissingPills job={j} />}</div><div style={{textAlign:"right",flexShrink:0,paddingTop:2}}><div style={{fontSize:14,fontWeight:700,color:(j.price&&!isNaN(j.price))?T.dark:T.amber}}>{(j.price&&!isNaN(j.price))?money(j.price):"No price"}</div><div style={{fontSize:11,fontWeight:600,color:sc,marginTop:2}}>{sl}</div></div></div>)})}
      {list.length>show&&<button onClick={()=>setShow(s=>s+50)} style={{...btnS,marginTop:12,fontSize:13}}>Show more ({list.length-show} remaining)</button>}
      {list.length===0&&<div style={{textAlign:"center",padding:24,fontSize:14,color:T.muted}}>No jobs match</div>}
    </div>

    {/* Floating + button — opens Capture modal */}
    <button onClick={onNew} aria-label="Log new job" style={{position:"fixed",right:16,bottom:"calc(64px + env(safe-area-inset-bottom) + 16px)",width:56,height:56,borderRadius:28,border:"none",background:T.dark,color:"#fff",fontSize:28,fontWeight:300,lineHeight:"56px",cursor:"pointer",boxShadow:"0 4px 12px rgba(0,0,0,.2)",zIndex:40,padding:0}}>+</button>

    {edit&&<EditPanel job={edit} onSave={handleSave} onClose={()=>setEdit(null)} onDelete={handleDelete} />}
  </>);
}
