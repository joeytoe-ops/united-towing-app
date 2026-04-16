import React, { useState, useMemo } from "react";
import { T, inp, btnS } from "../../styles/theme";
import { PARTNERS, ST } from "../../lib/constants";
import { fmtDate, money } from "../../lib/format";

function buildCustomers(jobs, extraCustomers){
  const m = {};
  PARTNERS.forEach(n=>{m[n]={name:n,jobs:[],revenue:0,outstanding:0,isPartner:true}});
  (extraCustomers||[]).forEach(n=>{if(!m[n])m[n]={name:n,jobs:[],revenue:0,outstanding:0,isPartner:false}});
  jobs.forEach(j=>{
    const n=j.customer?.name||"";
    if(!n)return;
    if(!m[n])m[n]={name:n,jobs:[],revenue:0,outstanding:0,isPartner:false};
    m[n].jobs.push(j);
    const p=parseFloat(j.price)||0;
    if(j.status===ST.PAID)m[n].revenue+=p;
    else if(p>0)m[n].outstanding+=p;
  });
  return Object.values(m).sort((a,b)=>(b.jobs.length-a.jobs.length)||a.name.localeCompare(b.name));
}

function CustomerDetail({customer,onClose}){
  const sorted=[...customer.jobs].sort((a,b)=>(b.jobDate||"").localeCompare(a.jobDate||""));
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:12,fontFamily:T.font}}>
      <div style={{background:T.surface,borderRadius:14,width:"100%",maxWidth:560,maxHeight:"92vh",overflow:"auto",padding:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:T.dark}}>{customer.name}</div>
            <div style={{fontSize:12,color:T.muted,marginTop:2}}>{customer.isPartner?"Partner":"Customer"} &middot; {customer.jobs.length} jobs</div>
          </div>
          <button onClick={onClose} style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface,color:T.dark,fontSize:12,fontWeight:600,cursor:"pointer"}}>Close</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
          <div style={{background:"#ecfdf5",borderRadius:10,padding:"10px 12px"}}>
            <div style={{fontSize:10,fontWeight:700,color:T.accent,textTransform:"uppercase",letterSpacing:.5}}>Revenue</div>
            <div style={{fontSize:17,fontWeight:700,color:T.accent,marginTop:2}}>{money(customer.revenue)}</div>
          </div>
          <div style={{background:"#fef2f2",borderRadius:10,padding:"10px 12px"}}>
            <div style={{fontSize:10,fontWeight:700,color:T.red,textTransform:"uppercase",letterSpacing:.5}}>Outstanding</div>
            <div style={{fontSize:17,fontWeight:700,color:T.red,marginTop:2}}>{money(customer.outstanding)}</div>
          </div>
        </div>
        <div style={{fontSize:13,fontWeight:700,color:T.dark,marginBottom:8}}>Jobs</div>
        {sorted.length===0&&<div style={{fontSize:12,color:T.muted,textAlign:"center",padding:18}}>No jobs yet</div>}
        {sorted.map(j=>{
          const title=j.title||[j.vehicle?.color,j.vehicle?.make,j.vehicle?.model].filter(Boolean).join(" ")||"No info";
          const sc=j.status===ST.PAID?T.accent:(j.status===ST.UNPAID?T.red:T.amber);
          const sl=j.status===ST.PAID?"Paid":(j.status===ST.UNPAID?"Unpaid":"Missing");
          return(
            <div key={j.id} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${T.bg}`,gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:T.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</div>
                <div style={{fontSize:11,color:T.muted,marginTop:2}}>{fmtDate(j.jobDate)}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:13,fontWeight:700,color:T.dark}}>{j.price?money(j.price):"\u2014"}</div>
                <div style={{fontSize:10,fontWeight:600,color:sc,marginTop:2}}>{sl}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CustomersTab({jobs=[]}){
  const[q,setQ]=useState("");
  const[sel,setSel]=useState(null);
  const[extra,setExtra]=useState([]);
  const[adding,setAdding]=useState(false);
  const[newName,setNewName]=useState("");
  const customers=useMemo(()=>buildCustomers(jobs,extra),[jobs,extra]);
  const total=customers.length;
  const repeat=customers.filter(c=>c.jobs.length>=2).length;
  const out=customers.reduce((a,c)=>a+c.outstanding,0);
  const filtered=q?customers.filter(c=>c.name.toLowerCase().includes(q.toLowerCase())):customers;
  const addCustomer=()=>{const n=newName.trim();if(!n)return;if(!extra.includes(n)&&!PARTNERS.includes(n))setExtra(p=>[...p,n]);setNewName("");setAdding(false)};
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:16,gap:10,flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:22,fontWeight:700,color:T.dark}}>Customers</div>
          <div style={{fontSize:13,color:T.muted,marginTop:4}}>Your partners and one-time customers</div>
        </div>
        <button onClick={()=>setAdding(true)} style={{padding:"8px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:T.dark,color:"#fff"}}>+ New customer</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
        <div style={{background:T.surface,borderRadius:T.radius,padding:"10px 12px",boxShadow:T.shadow,textAlign:"center"}}><div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5}}>Total</div><div style={{fontSize:19,fontWeight:700,color:T.dark,marginTop:2}}>{total}</div></div>
        <div style={{background:T.surface,borderRadius:T.radius,padding:"10px 12px",boxShadow:T.shadow,textAlign:"center"}}><div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5}}>Repeat</div><div style={{fontSize:19,fontWeight:700,color:T.blue,marginTop:2}}>{repeat}</div></div>
        <div style={{background:T.surface,borderRadius:T.radius,padding:"10px 12px",boxShadow:T.shadow,textAlign:"center"}}><div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5}}>Outstanding</div><div style={{fontSize:17,fontWeight:700,color:T.red,marginTop:2}}>{money(out)}</div></div>
      </div>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search customers..." style={{...inp,marginBottom:12}} />
      <div style={{background:T.surface,borderRadius:T.radius,boxShadow:T.shadow,overflow:"hidden"}}>
        {filtered.length===0&&<div style={{padding:24,textAlign:"center",fontSize:13,color:T.muted}}>No customers match</div>}
        {filtered.map((c,i)=>(
          <div key={c.name} onClick={()=>setSel(c)} style={{padding:"12px 14px",borderBottom:i<filtered.length-1?`1px solid ${T.bg}`:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:600,color:T.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}{c.isPartner&&<span style={{padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:700,background:"#eff6ff",color:T.blue,marginLeft:6,verticalAlign:"middle"}}>PARTNER</span>}</div>
              <div style={{fontSize:11,color:T.muted,marginTop:2}}>{c.jobs.length} jobs &middot; {money(c.revenue)} paid</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:13,fontWeight:700,color:c.outstanding>0?T.red:T.muted}}>{c.outstanding>0?money(c.outstanding):"\u2014"}</div>
              <div style={{fontSize:10,color:T.muted,marginTop:2}}>{c.outstanding>0?"outstanding":"none due"}</div>
            </div>
          </div>
        ))}
      </div>
      {sel&&<CustomerDetail customer={sel} onClose={()=>setSel(null)} />}
      {adding&&
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:12,fontFamily:T.font}}>
          <div style={{background:T.surface,borderRadius:14,width:"100%",maxWidth:360,padding:20}}>
            <div style={{fontSize:16,fontWeight:700,color:T.dark,marginBottom:12}}>New customer</div>
            <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCustomer()} placeholder="Customer name" autoFocus style={{...inp,marginBottom:14}} />
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setAdding(false);setNewName("")}} style={{...btnS,flex:1}}>Cancel</button>
              <button onClick={addCustomer} style={{padding:"12px 20px",borderRadius:10,border:"none",cursor:"pointer",fontSize:15,fontWeight:600,background:T.dark,color:"#fff",flex:1}}>Add</button>
            </div>
            <div style={{fontSize:10,color:T.muted,textAlign:"center",marginTop:10}}>Saved in this session &middot; persistence coming later</div>
          </div>
        </div>
      }
    </div>
  );
}
