// api/roof-area.js
// ---------------------------
// ES Module version for Vercel (Node 18+)
// ---------------------------

export default async function handler(req, res) {
  try {
    // ---------- 0️⃣ Only allow POST ----------
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST allowed" });
    }

    // ---------- 1️⃣ Get address from body ----------
    const { address } = req.body; // expects { "address": "123 Main St, City, State" }
    if (!address) {
      return res.status(400).json({ error: "Missing address in request body" });
    }

    // ---------- 2️⃣ Get Google API key ----------
    const GOOGLE_KEY = process.env.GOOGLE_API_KEY;
    if (!GOOGLE_KEY) {
      console.error("❌ GOOGLE_API_KEY env var is missing");
      return res
        .status(500)
        .json({ error: "Server mis‑configuration – missing Google API key" });
    }

    // ---------- 3️⃣ Geocode the address ----------
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${GOOGLE_KEY}`;

    const geoResp = await fetch(geoUrl);
    const geoData = await geoResp.json();

    if (!geoData.results || geoData.results.length === 0) {
      return res
        .status(400)
        .json({ error: "Geocode failed – address not found", details: geoData });
    }

    const { lat, lng } = geoData.results[0].geometry.location;

    // ---------- 4️⃣ Call Google Solar API ----------
    const solarUrl = `https://solar.googleapis.com/v1/roofSegments?location=${lat},${lng}&radiusMeters=30&key=${GOOGLE_KEY}`;

    const solarResp = await fetch(solarUrl);
    if (!solarResp.ok) {
      const txt = await solarResp.text(); // may be HTML error page
      console.error("❌ Solar API error:", solarResp.status, txt);
      return res.status(502).json({
        error: "Solar API request failed",
        status: solarResp.status,
        details: txt,
      });
    }

    const solarData = await solarResp.json();

    if (!solarData.roofSegments || solarData.roofSegments.length === 0) {
      return res
        .status(404)
        .json({ error: "No roof found at this location (try larger radius)" });
    }

    const areaM2 = solarData.roofSegments[0].areaMeters2;
    const areaFt2 = Math.round(areaM2 * 10.7639); // convert to ft²

    // ---------- 5️⃣ (Optional) Secret check ----------
    // const secret = req.headers["x-api-secret"];
    // if (secret !== process.env.API_SECRET) {
    //   return res.status(401).json({ error: "Invalid secret header" });
    // }

    // ---------- 6️⃣ Return success ----------
    return res.status(200).json({
      address,
      lat,
      lng,
      area_m2: areaM2,
      area_ft2: areaFt2,
      polygon: solarData.roofSegments[0].polygon,
    });
  } catch (err) {
    console.error("❌ Unexpected error:", err);
    return res
      .status(500)
      .json({ error: "Unexpected server error", details: err.message });
  }
}
