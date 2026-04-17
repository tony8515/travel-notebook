import { NextResponse } from "next/server";

async function fetchNominatim(query: string) {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "travel-notebook-app/1.0 (local dev)",
    },
    cache: "no-store",
  });

  const text = await res.text();

  console.log("GEOCODE query:", query);
  console.log("GEOCODE status:", res.status);
  console.log("GEOCODE text:", text.slice(0, 200));

  if (!res.ok) return [];

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = (searchParams.get("q") || "").trim();

    if (!address) {
      return NextResponse.json([], { status: 200 });
    }

    let data = await fetchNominatim(address);

    const hasCountry =
      /,\s*[A-Za-z.\- ]+$/.test(address) &&
      /(usa|united states|turkey|greece|korea|japan|france|italy|spain|germany)$/i.test(address);

    if (data.length === 0 && !hasCountry) {
      data = await fetchNominatim(`${address}, USA`);
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.warn("geocode route error:", error);
    return NextResponse.json([], { status: 200 });
  }
}