const fetch = require('node-fetch'); // Omit if using Node 18+ (Vercel default)

module.exports = async (req, res) => {
  // 1. Get address from the request (POST JSON body)
  const { address } = req.body; // Expect: { "address": "1600 Amphitheatre Parkway, Mountain View, CA" }

  if (!address) {
    return res.status(400).json({ error: "Missing address" });
  }

  // 2. Geocode the address → lat / lng
  const GEOCODE_KEY = process.env.GOOGLE_API_KEY; // Store key in Vercel env vars
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GEOCODE_KEY}`;

  const geoResp = await fetch(geocodeUrl);
  const geoData = await geoResp.json();

  if (!geoData.results || geoData.results.length === 0) {
    return res.status(400).json({ error: "Geocode failed – address not found" });
  }

  const { lat, lng } = geoData.results[0].geometry.location;

  // 3. Call Google Maps Solar API → roof area (m²)
  const solarUrl = `https://solar.googleapis.com/v1/roofSegments?location=${lat},${lng}&radiusMeters=30&key=${GEOCODE_KEY}`;

  const solarResp = await fetch(solarUrl);
  if (!solarResp.ok) {
    const txt = await solarResp.text();
    return res.status(500).json({ error: "Solar API error", details: txt });
  }
  const solarData = await solarResp.json();

  if (!solarData.roofSegments || solarData.roofSegments.length === 0) {
    return res.status(404).json({ error: "No roof found at this location" });
  }

  const areaM2 = solarData.roofSegments[0].areaMeters2;
  const areaFt2 = Math.round(areaM2 * 10.7639); // Convert to ft²

  // 4. Return the result
  return res.status(200).json({
    address,
    lat,
    lng,
    area_m2: areaM2,
    area_ft2: areaFt2,
    polygon: solarData.roofSegments[0].polygon
  });
};
