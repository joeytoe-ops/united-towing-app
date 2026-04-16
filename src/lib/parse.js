import { COL, SVC, ST, TAX, CC_FEE, PARTNERS } from "./constants";
import { uid } from "./format";

export const freshJob = () => ({
  id:uid(), jobDate:new Date().toISOString().split("T")[0],
  jobTime:new Date().toTimeString().slice(0,5),
  vehicle:{color:"",make:"",model:"",year:"",vin:"",plate:""},
  customer:{name:"",phone:""}, owner:{name:"",homePhone:"",workPhone:""},
  pickup:"",pickupCity:"",pickupState:"",pickupZip:"",dropoff:"",dropoffCity:"",dropoffState:"",dropoffZip:"",
  services:{}, price:"", paymentType:"Cash", tolls:"",
  poNumber:"",raNumber:"", status:ST.UNPAID, notes:"",
  taxMode:"standard", taxRate:TAX,
  vehiclePhoto:null, registrationPhoto:null, source:"app", title:""
});

export function parseRow(row) {
  const id = row[COL.ID] || uid();
  let jd = "";
  if (row[COL.DATE]) try { jd = new Date(row[COL.DATE]).toISOString().split("T")[0]; } catch {}
  let jt = "";
  if (row[COL.TIME]) try {
    const t = new Date(row[COL.TIME]);
    jt = t.getUTCHours().toString().padStart(2,"0")+":"+t.getUTCMinutes().toString().padStart(2,"0");
  } catch { jt = String(row[COL.TIME]).slice(0,5); }

  let svc = {};
  try { svc = JSON.parse(row[COL.SVC]); } catch {}
  let ext = {};
  try { if (String(row[COL.EXT]).startsWith("{")) ext = JSON.parse(row[COL.EXT]); } catch {}
  const st = (row[COL.STATUS]||"").toLowerCase();
  const isM = String(id).startsWith("L") || !!ext.legacyNum;
  const desc = String(row[COL.DESC]||"").trim();
  const price = row[COL.PRICE];

  return {
    id, jobDate:jd, jobTime:jt,
    vehicle: {
      color:row[COL.COLOR]||"", make:row[COL.MAKE]||"", model:row[COL.MODEL]||"",
      year:row[COL.YEAR]||"", vin:row[COL.VIN]||"", plate:row[COL.PLATE]||""
    },
    customer: { name:row[COL.CUST]||"", phone:row[COL.PHONE]||"" },
    owner: ext.owner || {name:"",homePhone:"",workPhone:""},
    pickup:row[COL.PICKUP]||"", pickupCity:ext.pickupCity||"", pickupState:ext.pickupState||"", pickupZip:ext.pickupZip||"",
    dropoff:row[COL.DROPOFF]||"", dropoffCity:ext.dropoffCity||"", dropoffState:ext.dropoffState||"", dropoffZip:ext.dropoffZip||"",
    services:svc, price:price||"", paymentType:row[COL.PAYMENT]||"Cash",
    tolls:ext.tolls||"", poNumber:ext.poNumber||"", raNumber:ext.raNumber||"",
    taxMode:ext.taxMode||"standard", taxRate:ext.taxRate!=null?ext.taxRate:TAX,
    status: st==="deleted"?"deleted" : (st==="paid"?ST.PAID : (st==="unpaid"?ST.UNPAID : ((!price||price==="")?ST.MISSING:ST.UNPAID))),
    notes: row[COL.NOTES]||"",
    legacyNum: ext.legacyNum||"",
    receiptMissing: ext.receiptMissing||false,
    vehiclePhoto:null, registrationPhoto:null,
    source: isM ? "migrated" : "app",
    title: desc || [row[COL.COLOR],row[COL.MAKE],row[COL.MODEL]].filter(Boolean).join(" ") || (ext.legacyTitle||"")
  };
}

export function buildPayload(job, action) {
  const veh = [job.vehicle.color, job.vehicle.make, job.vehicle.model].filter(Boolean).join(" ");
  const desc = job.title || veh || "";
  const ext = JSON.stringify({
    owner:job.owner||{}, pickupCity:job.pickupCity||"", pickupState:job.pickupState||"", pickupZip:job.pickupZip||"",
    dropoffCity:job.dropoffCity||"", dropoffState:job.dropoffState||"", dropoffZip:job.dropoffZip||"",
    tolls:job.tolls||"", poNumber:job.poNumber||"", raNumber:job.raNumber||"",
    legacyNum:job.legacyNum||"", legacyTitle:job.title||"",
    receiptMissing:job.receiptMissing||false,
    taxMode:job.taxMode||"standard", taxRate:job.taxRate!=null?job.taxRate:TAX
  });
  const sv = SVC.reduce((a,i) => a + (parseFloat((job.services||{})[i.k])||0), 0)
    + (parseFloat((job.services||{}).custom1)||0) + (parseFloat((job.services||{}).custom2)||0) + (parseFloat((job.services||{}).custom3)||0);
  const txRate = job.taxMode==="exempt"?0:(job.taxRate!=null?parseFloat(job.taxRate):TAX);
  const txAmt = Math.round(sv*txRate*100)/100;
  const tlAmt = parseFloat(job.tolls)||0;
  const ccAmt = job.paymentType==="Credit Card"?Math.round((sv+txAmt+tlAmt)*CC_FEE*100)/100:0;
  const fullTotal = sv>0 ? Math.round((sv+txAmt+tlAmt+ccAmt)*100)/100 : "";
  return {
    action, id:job.id, date:job.jobDate||"", time:job.jobTime||"",
    desc: desc,
    customer:job.customer?.name||"", phone:job.customer?.phone||"",
    pickup:job.pickup||"", dropoff:job.dropoff||"",
    color:job.vehicle?.color||"", make:job.vehicle?.make||"",
    model:job.vehicle?.model||"", year:job.vehicle?.year||"",
    plate:job.vehicle?.plate||"",
    price:fullTotal||job.price||"", payment:job.paymentType||"", status:job.status||"",
    notes:job.notes||"", vin:job.vehicle?.vin||"",
    service:JSON.stringify(job.services||{}), ext: ext,
    test:job.isTest||false
  };
}

// Convert a new legacy row from Overview into an App Jobs entry and sync it
export function parseLegacyNew(r) {
  const payRaw = String(r.pay||"").trim();
  const rcptRaw = String(r.receipt||"").trim();
  const payUp = payRaw.toUpperCase();
  const rcptLow = rcptRaw.toLowerCase();
  let price = "";
  if (r.payout!=null && r.payout!=="" && r.payout!=="-") {
    const p = parseFloat(r.payout); if (!isNaN(p)&&p>0) price = p;
  }
  const needsPay = payUp.includes("NEEDS TO BE PAID");
  const hasPay = payUp.includes("CASH")||payUp.includes("ZELLE")||payUp.includes("CHECK")||payUp.includes("CREDIT");
  const hasChk = rcptRaw.includes("\u2705")||rcptRaw.includes("\u2611");
  const hasRcpt = rcptLow.includes("receipt in tow");
  let status = ST.MISSING;
  if (!price&&price!==0) status=ST.MISSING;
  else if (needsPay) status=ST.UNPAID;
  else if (hasChk||hasRcpt||hasPay) status=ST.PAID;
  else status=ST.UNPAID;
  let payNorm = "Cash";
  if (payUp.includes("ZELLE")) payNorm="Zelle";
  else if (payUp.includes("CHECK")) payNorm="Check";
  else if (payUp.includes("CREDIT")) payNorm="Credit Card";
  else if (payUp.includes("INSURANCE")) payNorm="Pending Insurance";
  else if (needsPay||payUp.includes("PENDING")) payNorm="Invoice Later";
  else if (payUp.includes("CASH")) payNorm="Cash";
  let cust = "";
  const combo = (String(r.name)+" "+String(r.notes||"")).toLowerCase();
  for (const p of PARTNERS) if (combo.includes(p.toLowerCase())) { cust=p; break; }
  let jd = "";
  if (r.date) try { jd=new Date(r.date).toISOString().split("T")[0]; } catch {}
  const name = String(r.name||"").trim();
  return {
    id:"L"+r.n, jobDate:jd, jobTime:"",
    vehicle:{color:"",make:"",model:"",year:"",vin:"",plate:""},
    customer:{name:cust,phone:""}, owner:{name:"",homePhone:"",workPhone:""},
    pickup:"",pickupCity:"",pickupState:"",pickupZip:"",dropoff:"",dropoffCity:"",dropoffState:"",dropoffZip:"",
    services:price?{towing:price}:{}, price, paymentType:payNorm, tolls:"",
    poNumber:"",raNumber:"", status, notes:String(r.notes||""),
    legacyNum:String(r.n), receiptMissing:rcptLow.includes("missing receipt"),
    vehiclePhoto:null, registrationPhoto:null, source:"migrated",
    title:name
  };
}
