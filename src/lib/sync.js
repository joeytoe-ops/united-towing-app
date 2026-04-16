import { parseRow, parseLegacyNew, buildPayload } from "./parse";

const CK = "ut-v6";
export const cacheJobs = j => { try{localStorage.setItem(CK,JSON.stringify(j))}catch{} };
export const loadCached = () => { try{return JSON.parse(localStorage.getItem(CK)||"[]")}catch{return[]} };

export async function fetchAll() {
  try {
    const r = await fetch("/api/sync");
    const d = await r.json();
    const appJobs = (d.jobs||[]).map(parseRow).filter(j=>j.status!=="deleted");

    // Auto-import any new rows from Overview that aren't in App Jobs yet
    const newLegacy = d.newLegacy || [];
    if (newLegacy.length > 0) {
      console.log(`Auto-importing ${newLegacy.length} new jobs from Overview`);
      const imported = [];
      for (const row of newLegacy) {
        const job = parseLegacyNew(row);
        const ok = await syncJob(job, "add");
        if (ok) imported.push(job);
      }
      return [...appJobs, ...imported];
    }
    return appJobs;
  } catch (e) { console.error(e); return null; }
}

export async function syncJob(job, action="add") {
  try {
    const r = await fetch("/api/sync", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(buildPayload(job, action))
    });
    return await r.json();
  } catch (e) { console.error(e); return null; }
}

export async function deleteJob(job) {
  const marked = {...job, status:"deleted"};
  return await syncJob(marked, "update");
}
