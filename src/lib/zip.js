/* Free zip code lookup using nominatim (OpenStreetMap) - no API key */
export const lookupZip = async (address, city, state) => {
  if (!address && !city) return "";
  const q = [address, city, state].filter(Boolean).join(", ");
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=1&countrycodes=us`);
    const d = await r.json();
    if (d && d[0] && d[0].address && d[0].address.postcode) return d[0].address.postcode;
  } catch {}
  return "";
};
