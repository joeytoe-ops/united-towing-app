import { TAX } from "./constants";

const escape = (v) => {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replaceAll('"', '""') + '"';
  }
  return s;
};

export function jobsToCSV(jobs){
  const header = ["ID","Date","Time","Description","Customer","Phone","Pickup","Dropoff","Color","Make","Model","Year","Plate","Price","Payment","Status","Notes","VIN","Services","Extended"];
  const rows = jobs.filter(j => j.status !== "deleted").map(j => {
    const desc = j.title || [j.vehicle?.color, j.vehicle?.make, j.vehicle?.model].filter(Boolean).join(" ") || "";
    const services = JSON.stringify(j.services||{});
    const ext = JSON.stringify({
      owner:j.owner||{}, pickupCity:j.pickupCity||"", pickupState:j.pickupState||"", pickupZip:j.pickupZip||"",
      dropoffCity:j.dropoffCity||"", dropoffState:j.dropoffState||"", dropoffZip:j.dropoffZip||"",
      tolls:j.tolls||"", poNumber:j.poNumber||"", raNumber:j.raNumber||"",
      legacyNum:j.legacyNum||"", legacyTitle:j.title||"",
      receiptMissing:j.receiptMissing||false,
      taxMode:j.taxMode||"standard", taxRate:j.taxRate!=null?j.taxRate:TAX
    });
    return [
      j.id||"", j.jobDate||"", j.jobTime||"", desc, j.customer?.name||"", j.customer?.phone||"",
      j.pickup||"", j.dropoff||"", j.vehicle?.color||"", j.vehicle?.make||"",
      j.vehicle?.model||"", j.vehicle?.year||"", j.vehicle?.plate||"",
      j.price||"", j.paymentType||"", j.status||"", j.notes||"", j.vehicle?.vin||"",
      services, ext
    ];
  });
  return [header, ...rows].map(r => r.map(escape).join(",")).join("\n");
}

export function downloadJobsCSV(jobs){
  const csv = jobsToCSV(jobs);
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `united-towing-jobs-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
