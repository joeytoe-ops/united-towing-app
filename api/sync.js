export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzAHhEM7sWfhmMqozMa0GU45t0ARiNbz2FAtJH6yk3Us-w6Jb_UCx79nRIF4OvTsgyqJA/exec";

  try {
    // GET = list all jobs from sheet
    if (req.method === "GET") {
      const response = await fetch(SCRIPT_URL + "?action=list", {
        method: "GET",
        redirect: "follow",
      });
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        return res.status(200).json(json);
      } catch {
        return res.status(200).json({ raw: text });
      }
    }

    // POST = add or update a job
    if (req.method === "POST") {
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        return res.status(200).json(json);
      } catch {
        return res.status(200).json({ result: text });
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
