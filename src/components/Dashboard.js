import React, { useState } from "react";
import { T } from "../styles/theme";
import Header from "./Header";
import BottomNav from "./BottomNav";
import Capture from "./Capture";
import JobsTab from "./Tabs/JobsTab";
import ExpensesTab from "./Tabs/ExpensesTab";
import CustomersTab from "./Tabs/CustomersTab";
import InvoicesTab from "./Tabs/InvoicesTab";
import SettingsTab from "./Tabs/SettingsTab";

const TEST_KEY = "ut-test-mode";

export default function Dashboard({jobs,setJobs,onAdd,onSignOut,loading,refresh}){
  const[tab,setTab]=useState("jobs");
  const[captureOpen,setCaptureOpen]=useState(false);
  const[testMode,setTestModeState]=useState(()=>localStorage.getItem(TEST_KEY)==="1");
  const setTestMode=(v)=>{setTestModeState(v);try{if(v)localStorage.setItem(TEST_KEY,"1");else localStorage.removeItem(TEST_KEY)}catch{}};

  const handleCaptureSubmit=(job)=>{onAdd(job);setCaptureOpen(false)};

  return(
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:T.font,paddingTop:48,paddingBottom:"calc(64px + env(safe-area-inset-bottom))"}}>
      <Header testMode={testMode} setTestMode={setTestMode} onSignOut={onSignOut} />
      <main style={{maxWidth:720,margin:"0 auto",padding:"16px"}}>
        {tab==="jobs"&&<JobsTab jobs={jobs} setJobs={setJobs} loading={loading} refresh={refresh} onNew={()=>setCaptureOpen(true)} />}
        {tab==="expenses"&&<ExpensesTab />}
        {tab==="customers"&&<CustomersTab jobs={jobs} />}
        {tab==="invoices"&&<InvoicesTab jobs={jobs} />}
        {tab==="settings"&&<SettingsTab jobs={jobs} testMode={testMode} setTestMode={setTestMode} />}
      </main>
      <BottomNav active={tab} onChange={setTab} />
      {captureOpen&&<Capture testMode={testMode} onSubmit={handleCaptureSubmit} onCancel={()=>setCaptureOpen(false)} />}
    </div>
  );
}
