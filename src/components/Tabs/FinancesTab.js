import React, { useEffect, useMemo, useState } from "react";
import { T, inp } from "../../styles/theme";
import { ST } from "../../lib/constants";
import { money, fmtDate } from "../../lib/format";
import { CATEGORIES, categorize } from "../../lib/categoryMap";
import { getAccounts, getTransactions, disconnectItem, setCategoryOverride, isNotConfigured } from "../../lib/plaidClient";
import { listCashExpenses, addCashExpense, deleteCashExpense } from "../../lib/cashExpenses";
import PlaidConnect from "../PlaidConnect";

/* ───────── Hero: Cash Position ───────── */
function Hero({ state, accounts, onConnected }) {
  if (state === "unconfigured") {
    return (
      <div style={{background:T.surface,borderRadius:T.radius,padding:"22px 20px",boxShadow:T.shadow,marginBottom:18}}>
        <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>Cash position</div>
        <div style={{fontSize:18,fontWeight:700,color:T.dark}}>Bank connection coming soon</div>
        <div style={{fontSize:12,color:T.muted,marginTop:4}}>Add your Plaid keys in Vercel, then connect your bank to see real-time balances here.</div>
      </div>
    );
  }
  if (state === "loading") {
    return <div style={{background:T.surface,borderRadius:T.radius,padding:"18px 20px",boxShadow:T.shadow,marginBottom:18,fontSize:13,color:T.muted}}>Loading cash position\u2026</div>;
  }
  const bankAccts = accounts.filter(a => a.type === "depository");
  const ccAccts = accounts.filter(a => a.type === "credit");
  const bankTotal = bankAccts.reduce((a, x) => a + (parseFloat(x.balance_current) || 0), 0);
  const ccTotal = ccAccts.reduce((a, x) => a + (parseFloat(x.balance_current) || 0), 0);
  const net = bankTotal - ccTotal;
  if (accounts.length === 0) {
    return (
      <div style={{background:T.surface,borderRadius:T.radius,padding:"22px 20px",boxShadow:T.shadow,marginBottom:18,textAlign:"center"}}>
        <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>Cash position</div>
        <div style={{fontSize:14,fontWeight:600,color:T.dark,marginBottom:6}}>No bank accounts connected yet</div>
        <div style={{fontSize:12,color:T.muted,marginBottom:16}}>Connect Chase (or any bank) to see real balances here.</div>
        <PlaidConnect onConnected={onConnected} />
      </div>
    );
  }
  return (
    <div style={{background:T.surface,borderRadius:T.radius,padding:"18px 20px",boxShadow:T.shadow,marginBottom:18}}>
      <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:8}}>Cash position</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
        <div><div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:.5,fontWeight:700}}>Bank total</div><div style={{fontSize:20,fontWeight:700,color:T.accent,marginTop:2}}>{money(bankTotal)}</div></div>
        <div><div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:.5,fontWeight:700}}>CC balance</div><div style={{fontSize:20,fontWeight:700,color:T.red,marginTop:2}}>{money(ccTotal)}</div></div>
        <div><div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:.5,fontWeight:700}}>Net position</div><div style={{fontSize:20,fontWeight:700,color:net>=0?T.dark:T.red,marginTop:2}}>{money(net)}</div></div>
      </div>
    </div>
  );
}

/* ───────── Revenue since day 1 (jobs only) ───────── */
function MonthlyBars({ data, color }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:6,height:70,marginTop:8}}>
      {data.map(d => (
        <div key={d.label} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:"100%"}}>
          <div title={`${d.label}: ${money(d.value)}`} style={{width:"100%",height:`${Math.max(2,(d.value/max)*50)}px`,background:color,borderRadius:"4px 4px 0 0"}} />
          <div style={{fontSize:9,color:T.muted,marginTop:4}}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function RevenueSection({ jobs }) {
  const paid = jobs.filter(j => j.status === ST.PAID && j.price && !isNaN(j.price));
  const total = paid.reduce((a, j) => a + parseFloat(j.price || 0), 0);
  const byPay = {};
  paid.forEach(j => { const p = j.paymentType || "Other"; byPay[p] = (byPay[p] || 0) + parseFloat(j.price || 0); });
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const label = d.toLocaleDateString("en-US",{month:"short"});
    const value = paid.filter(j => (j.jobDate || "").startsWith(prefix)).reduce((a,j) => a + parseFloat(j.price || 0), 0);
    months.push({ label, value });
  }
  return (
    <div style={{background:T.surface,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow,marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
        <div style={{fontSize:14,fontWeight:700,color:T.dark}}>Revenue since day 1</div>
        <div style={{fontSize:20,fontWeight:700,color:T.accent}}>{money(total)}</div>
      </div>
      <div style={{fontSize:11,color:T.muted}}>{paid.length} paid jobs</div>
      <MonthlyBars data={months} color={T.accent} />
      <div style={{borderTop:`1px solid ${T.bg}`,marginTop:12,paddingTop:10}}>
        <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>By payment method</div>
        {Object.entries(byPay).sort((a,b)=>b[1]-a[1]).map(([k,v]) => (
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:13}}><span style={{color:T.dark}}>{k}</span><span style={{fontWeight:600,color:T.dark}}>{money(v)}</span></div>
        ))}
        {Object.keys(byPay).length === 0 && <div style={{fontSize:12,color:T.muted}}>No paid jobs yet</div>}
      </div>
    </div>
  );
}

/* ───────── Cash drawer ───────── */
function CashDrawerSection({ jobs, expenses, onAdd, onDelete, kvBlocked }) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Supplies");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const cashRevenue = jobs
    .filter(j => j.status === ST.PAID && (j.paymentType || "").toLowerCase() === "cash")
    .reduce((a, j) => a + (parseFloat(j.price) || 0), 0);
  const spent = expenses.reduce((a, e) => a + (parseFloat(e.amount) || 0), 0);
  const onHand = cashRevenue - spent;
  const submit = async () => {
    const n = parseFloat(amount);
    if (!n || isNaN(n)) return;
    setBusy(true);
    await onAdd({ amount: n, category, note, date: new Date().toISOString().split("T")[0] });
    setAmount(""); setNote(""); setBusy(false);
  };
  return (
    <div style={{background:T.surface,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow,marginBottom:18}}>
      <div style={{fontSize:14,fontWeight:700,color:T.dark,marginBottom:10}}>Cash drawer</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:12}}>
        <div><div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:.5,fontWeight:700}}>Cash revenue</div><div style={{fontSize:17,fontWeight:700,color:T.accent,marginTop:2}}>{money(cashRevenue)}</div></div>
        <div><div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:.5,fontWeight:700}}>Cash expenses</div><div style={{fontSize:17,fontWeight:700,color:T.red,marginTop:2}}>{money(spent)}</div></div>
        <div><div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:.5,fontWeight:700}}>Kevin&rsquo;s cash on hand</div><div style={{fontSize:17,fontWeight:700,color:onHand>=0?T.dark:T.red,marginTop:2}}>{money(onHand)}</div></div>
      </div>
      {kvBlocked ? (
        <div style={{fontSize:12,color:T.muted,padding:"8px 0"}}>Enable Vercel KV to track cash expenses.</div>
      ) : (
        <>
          <div style={{borderTop:`1px solid ${T.bg}`,paddingTop:10}}>
            <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>Add cash expense</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <input value={amount} onChange={e=>setAmount(e.target.value)} type="number" inputMode="decimal" placeholder="Amount" style={inp} />
              <select value={category} onChange={e=>setCategory(e.target.value)} style={{...inp,appearance:"auto"}}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Note (optional)" style={{...inp,marginBottom:8}} />
            <button onClick={submit} disabled={busy||!amount} style={{padding:"10px 16px",borderRadius:10,border:"none",cursor:(busy||!amount)?"default":"pointer",fontSize:13,fontWeight:600,background:T.dark,color:"#fff",opacity:(busy||!amount)?.6:1}}>{busy?"Adding\u2026":"Add expense"}</button>
          </div>
          {expenses.length > 0 && (
            <div style={{marginTop:12,borderTop:`1px solid ${T.bg}`,paddingTop:10}}>
              <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>Recent cash expenses</div>
              {[...expenses].sort((a,b)=>(b.created_at||0)-(a.created_at||0)).slice(0,5).map(e=>(
                <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",fontSize:13,borderBottom:`1px solid ${T.bg}`}}>
                  <div><div style={{color:T.dark,fontWeight:600}}>{e.category}</div><div style={{fontSize:11,color:T.muted}}>{fmtDate(e.date)}{e.note?` \u00B7 ${e.note}`:""}</div></div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{fontWeight:700,color:T.red}}>{money(e.amount)}</div>
                    <button onClick={()=>onDelete(e.id)} title="Delete" style={{border:"none",background:"transparent",color:T.muted,cursor:"pointer",fontSize:14,padding:4}}>&times;</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ───────── Monthly P&L ───────── */
function PLSection({ jobs, transactions }) {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const label = d.toLocaleDateString("en-US",{month:"short",year:"2-digit"});
    const rev = jobs.filter(j => j.status === ST.PAID && (j.jobDate||"").startsWith(prefix)).reduce((a,j)=>a+parseFloat(j.price||0),0);
    /* Plaid convention: positive amount = money out (purchase), negative = inflow. We treat positive as expense. */
    const exp = transactions.filter(t => (t.date||"").startsWith(prefix) && t.amount > 0).reduce((a,t)=>a+t.amount, 0);
    months.push({ label, rev, exp, net: rev - exp });
  }
  const hasPlaid = transactions.length > 0;
  return (
    <div style={{background:T.surface,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow,marginBottom:18}}>
      <div style={{fontSize:14,fontWeight:700,color:T.dark,marginBottom:10}}>Monthly P&amp;L</div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:320}}>
          <thead>
            <tr style={{color:T.muted,fontSize:10,textTransform:"uppercase",letterSpacing:.5}}>
              <th style={{textAlign:"left",padding:"6px 4px"}}>Month</th>
              <th style={{textAlign:"right",padding:"6px 4px"}}>Revenue</th>
              <th style={{textAlign:"right",padding:"6px 4px"}}>Expenses</th>
              <th style={{textAlign:"right",padding:"6px 4px"}}>Net</th>
            </tr>
          </thead>
          <tbody>
            {months.map(m => (
              <tr key={m.label} style={{borderTop:`1px solid ${T.bg}`}}>
                <td style={{padding:"8px 4px",color:T.dark}}>{m.label}</td>
                <td style={{padding:"8px 4px",textAlign:"right",color:T.accent,fontWeight:600}}>{money(m.rev)}</td>
                <td style={{padding:"8px 4px",textAlign:"right",color:hasPlaid?T.red:T.muted,fontWeight:600}}>{hasPlaid?money(m.exp):"\u2014"}</td>
                <td style={{padding:"8px 4px",textAlign:"right",color:m.net>=0?T.dark:T.red,fontWeight:700}}>{hasPlaid?money(m.net):money(m.rev)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!hasPlaid && <div style={{fontSize:11,color:T.muted,marginTop:8}}>Expenses will populate once Plaid is connected.</div>}
    </div>
  );
}

/* ───────── Recent transactions ───────── */
function TransactionsSection({ transactions, accounts, onCategorize }) {
  const byId = useMemo(() => Object.fromEntries(accounts.map(a => [a.account_id, a])), [accounts]);
  if (!transactions || transactions.length === 0) {
    return (
      <div style={{background:T.surface,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow,marginBottom:18}}>
        <div style={{fontSize:14,fontWeight:700,color:T.dark,marginBottom:6}}>Recent transactions</div>
        <div style={{fontSize:12,color:T.muted}}>None yet. Connect a bank to pull transactions.</div>
      </div>
    );
  }
  const recent = transactions.slice(0, 50);
  return (
    <div style={{background:T.surface,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow,marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
        <div style={{fontSize:14,fontWeight:700,color:T.dark}}>Recent transactions</div>
        <div style={{fontSize:11,color:T.muted}}>Last {recent.length} of {transactions.length}</div>
      </div>
      {recent.map(t => {
        const acct = byId[t.account_id];
        const cat = categorize(t);
        return (
          <div key={t.transaction_id} style={{padding:"8px 0",borderBottom:`1px solid ${T.bg}`,display:"grid",gridTemplateColumns:"1fr auto",gap:8}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:T.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.merchant_name || t.name}</div>
              <div style={{fontSize:11,color:T.muted,marginTop:2}}>{fmtDate(t.date)}{acct?` \u00B7 ${acct.name}${acct.mask?" \u2022\u2022"+acct.mask:""}`:""}{t.pending?" \u00B7 pending":""}</div>
              <select value={cat} onChange={e=>onCategorize(t.transaction_id, e.target.value)} style={{marginTop:4,padding:"3px 6px",fontSize:10,borderRadius:6,border:`1px solid ${T.border}`,background:T.bg,color:T.muted,fontFamily:T.font}}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{textAlign:"right",whiteSpace:"nowrap"}}>
              <div style={{fontSize:14,fontWeight:700,color:t.amount>0?T.red:T.accent}}>{t.amount>0?"-":"+"}{money(Math.abs(t.amount))}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────── Credit card payoff tracker ───────── */
function CCPayoffSection({ accounts }) {
  const [apr, setApr] = useState(22);
  const [payment, setPayment] = useState(500);
  const cc = accounts.filter(a => a.type === "credit");
  if (cc.length === 0) return null;
  const balance = cc.reduce((a, x) => a + (parseFloat(x.balance_current) || 0), 0);
  const r = (parseFloat(apr)||0) / 100 / 12;
  const p = parseFloat(payment)||0;
  let months = null, interest = null;
  if (balance > 0 && p > 0 && p > balance * r) {
    months = Math.ceil(Math.log(p / (p - balance*r)) / Math.log(1 + r));
    const total = months * p;
    interest = total - balance;
  }
  return (
    <div style={{background:T.surface,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow,marginBottom:18}}>
      <div style={{fontSize:14,fontWeight:700,color:T.dark,marginBottom:10}}>Credit card payoff</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:12}}>
        <div><div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:.5,fontWeight:700}}>Current balance</div><div style={{fontSize:19,fontWeight:700,color:T.red,marginTop:2}}>{money(balance)}</div></div>
        <div><div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:.5,fontWeight:700}}>Est. monthly interest</div><div style={{fontSize:19,fontWeight:700,color:T.amber,marginTop:2}}>{money(balance*r)}</div></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <div><label style={{fontSize:10,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>APR %</label><input value={apr} onChange={e=>setApr(e.target.value)} type="number" style={inp} /></div>
        <div><label style={{fontSize:10,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Monthly payment</label><input value={payment} onChange={e=>setPayment(e.target.value)} type="number" style={inp} /></div>
      </div>
      {months != null ? (
        <div style={{fontSize:13,color:T.dark}}>Paying <strong>{money(p)}/month</strong> at <strong>{apr}%</strong> APR &rarr; debt-free in <strong>{months} months</strong> ({Math.floor(months/12)}y {months%12}m). Total interest: <strong>{money(interest)}</strong>.</div>
      ) : p > 0 ? (
        <div style={{fontSize:12,color:T.red}}>Payment too small to cover monthly interest &mdash; balance will grow.</div>
      ) : (
        <div style={{fontSize:12,color:T.muted}}>Enter a monthly payment to see payoff timeline.</div>
      )}
    </div>
  );
}

/* ───────── Accounts management ───────── */
function AccountsSection({ accounts, onDisconnect, onConnected, connectable }) {
  if (!connectable && accounts.length === 0) return null;
  const grouped = {};
  accounts.forEach(a => {
    if (!grouped[a.item_id]) grouped[a.item_id] = { institution_name: a.institution_name || "Bank", accounts: [] };
    grouped[a.item_id].accounts.push(a);
  });
  return (
    <div style={{background:T.surface,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow,marginBottom:18}}>
      <div style={{fontSize:14,fontWeight:700,color:T.dark,marginBottom:10}}>Connected accounts</div>
      {Object.entries(grouped).map(([itemId, g]) => (
        <div key={itemId} style={{paddingBottom:10,marginBottom:10,borderBottom:`1px solid ${T.bg}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{fontSize:13,fontWeight:700,color:T.dark}}>{g.institution_name}</div>
            <button onClick={()=>onDisconnect(itemId)} style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${T.border}`,background:T.surface,color:T.red,fontSize:11,fontWeight:600,cursor:"pointer"}}>Disconnect</button>
          </div>
          {g.accounts.map(a => (
            <div key={a.account_id} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0"}}>
              <span style={{color:T.muted}}>{a.name}{a.mask?` \u2022\u2022${a.mask}`:""} <span style={{fontSize:10,color:T.muted}}>({a.subtype||a.type})</span></span>
              <span style={{fontWeight:600,color:T.dark}}>{a.balance_current!=null?money(a.balance_current):"\u2014"}</span>
            </div>
          ))}
        </div>
      ))}
      {connectable && <div style={{marginTop:4}}><PlaidConnect onConnected={onConnected} label="+ Connect another account" /></div>}
    </div>
  );
}

/* ───────── Main ───────── */
export default function FinancesTab({ jobs = [] }) {
  const [plaidState, setPlaidState] = useState("loading"); // loading | unconfigured | ready | error
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [cashExpenses, setCashExpenses] = useState([]);
  const [kvBlocked, setKvBlocked] = useState(false);

  const loadAccounts = async (refresh = false) => {
    const r = await getAccounts({ refresh });
    if (isNotConfigured(r)) { setPlaidState("unconfigured"); return; }
    if (r.ok) { setAccounts(r.data.accounts || []); setPlaidState("ready"); }
    else setPlaidState("error");
  };
  const loadTxns = async () => {
    const r = await getTransactions(90);
    if (isNotConfigured(r)) return;
    if (r.ok) setTransactions(r.data.transactions || []);
  };
  const loadCashExp = async () => {
    const r = await listCashExpenses();
    if (r.status === 503) { setKvBlocked(true); return; }
    if (r.ok) setCashExpenses(r.data.expenses || []);
  };

  useEffect(() => { loadAccounts(); loadTxns(); loadCashExp(); }, []);

  const handleConnected = async () => {
    await loadAccounts(true);
    await loadTxns();
  };
  const handleDisconnect = async (item_id) => {
    if (!window.confirm("Disconnect this bank? You can reconnect anytime.")) return;
    await disconnectItem(item_id);
    await loadAccounts(true);
    await loadTxns();
  };
  const handleCategorize = async (transaction_id, category) => {
    await setCategoryOverride(transaction_id, category);
    setTransactions(prev => prev.map(t => t.transaction_id === transaction_id ? { ...t, override_category: category } : t));
  };
  const handleAddCashExp = async (data) => {
    const r = await addCashExpense(data);
    if (r.ok) setCashExpenses(prev => [...prev, r.data.item]);
  };
  const handleDeleteCashExp = async (id) => {
    await deleteCashExpense(id);
    setCashExpenses(prev => prev.filter(e => e.id !== id));
  };

  return (
    <div>
      <div style={{marginBottom:18}}>
        <div style={{fontSize:22,fontWeight:700,color:T.dark}}>Finances</div>
        <div style={{fontSize:13,color:T.muted,marginTop:4}}>Real-time balances, revenue, and expense tracking</div>
      </div>
      <Hero state={plaidState} accounts={accounts} onConnected={handleConnected} />
      <RevenueSection jobs={jobs} />
      <CashDrawerSection jobs={jobs} expenses={cashExpenses} onAdd={handleAddCashExp} onDelete={handleDeleteCashExp} kvBlocked={kvBlocked} />
      <PLSection jobs={jobs} transactions={transactions} />
      <TransactionsSection transactions={transactions} accounts={accounts} onCategorize={handleCategorize} />
      <CCPayoffSection accounts={accounts} />
      <AccountsSection accounts={accounts} onDisconnect={handleDisconnect} onConnected={handleConnected} connectable={plaidState==="ready"} />
    </div>
  );
}
