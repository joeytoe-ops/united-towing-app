export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

export const fmtDate = d => {
  if (!d) return "\u2014";
  const x = new Date(d + (d.length === 10 ? "T12:00:00" : ""));
  return isNaN(x) ? "\u2014" : `${x.getMonth()+1}/${x.getDate()}/${String(x.getFullYear()).slice(2)}`;
};

export const money = n => (n == null || isNaN(n) || n === "") ? "\u2014" : "$" + Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
