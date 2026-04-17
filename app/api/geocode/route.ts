import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("q");

    if (!address) {
      return NextResponse.json([], { status: 200 });
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      address + ", USA"
    )}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "travel-notebook-app",
        "Accept": "application/json",
      },
      cache: "force-cache",
    });

    if (!res.ok) {
      console.warn("geocode upstream failed:", address, res.status);
      return NextResponse.json([], { status: 200 });
    }

    const text = await res.text();

    let data: any[] = [];
    try {
      const parsed = JSON.parse(text);
      data = Array.isArray(parsed) ? parsed : [];
    } catch {
      console.warn("geocode upstream returned non-json:", address, text.slice(0, 120));
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.warn("geocode route error:", error);
    return NextResponse.json([], { status: 200 });
  }
}