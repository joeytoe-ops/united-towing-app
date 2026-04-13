export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzhCYclm89MmmaAyb-kDI02BYriBpURNgGoq_NOAPsanGv88FVUGgmjWteJFqTbOHGmPg/exec";

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
