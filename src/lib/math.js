import { SVC, ST, TAX, CC_FEE } from "./constants";

export const ago = d => {
  if (!d) return 0;
  const ms = Date.now() - new Date(d + (d.length===10?"T12:00:00":"")).getTime();
  return isNaN(ms) ? 0 : Math.floor(ms/86400000);
};

export const totals = (svc, tolls, pay, taxRate) => {
  const s = svc||{};
  const svcSum = SVC.reduce((a,i) => a + (parseFloat(s[i.k])||0), 0)
    + (parseFloat(s.custom1)||0) + (parseFloat(s.custom2)||0) + (parseFloat(s.custom3)||0);
  const tl = parseFloat(tolls)||0;
  const rate = (taxRate==null||taxRate===undefined) ? TAX : parseFloat(taxRate)||0;
  const tax = Math.round(svcSum*rate*100)/100;
  const chargeBase = svcSum + tax + tl;
  const cc = pay==="Credit Card" ? Math.round(chargeBase*CC_FEE*100)/100 : 0;
  const total = Math.round((chargeBase+cc)*100)/100;
  const sub = svcSum + tl;
  return { sub, svcSum, tl, tax, taxRate:rate, cc, total };
};

export const getMissing = (j) => {
  const isPaid = j.status === ST.PAID;
  const hasReceipt = !j.receiptMissing && isPaid;
  if (isPaid && hasReceipt) return [];
  if (isPaid && j.receiptMissing) return ["Receipt"];
  if (isPaid && j.price && !isNaN(j.price)) return [];
  const m = [];
  if (!j.price || isNaN(j.price) || parseFloat(j.price) === 0) m.push("Price");
  if (!j.customer?.name) m.push("Customer");
  if (!j.pickup) m.push("Pickup");
  if (!j.dropoff) m.push("Dropoff");
  if (!j.vehicle?.make && !j.vehicle?.model) m.push("Vehicle");
  return m;
};
