export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyhpmBQh3lQ614CON4Vog7Mvbro2zfvrgtXRrP1nVRNRroyI2j_mZcjUCDuPVE7j6LKdw/exec";

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();
    res.status(200).json({ result: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
