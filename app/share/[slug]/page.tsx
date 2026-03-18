"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type TripRow = {
  id: string;
  name: string;
  is_public: boolean;
  share_slug: string | null;
};

type EntryRow = {
  id: string;
  trip: string | null;
  date: string;
  location: string | null;
  campground: string | null;
  site: string | null;
  water: string | null;
  bathroom: string | null;
  noise: string | null;
  rating: number | null;
  notes: string | null;
  photo_urls: string[] | null;
  created_at?: string | null;
};

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString();
}

function countPhotos(entries: EntryRow[]) {
  return entries.reduce((sum, entry) => sum + (entry.photo_urls?.length ?? 0), 0);
}

export default function ShareTripPage() {
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";

  const [trip, setTrip] = useState<TripRow | null>(null);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!slug) {
        setMessage("공유 주소가 올바르지 않습니다.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setMessage("");

      try {
        const { data: tripData, error: tripError } = await supabase
          .from("trips")
          .select("id, name, is_public, share_slug")
          .eq("share_slug", slug)
          .eq("is_public", true)
          .maybeSingle();

        if (tripError) throw tripError;

        if (!tripData) {
          if (!cancelled) {
            setTrip(null);
            setEntries([]);
            setMessage(`공유된 여행을 찾을 수 없습니다. slug: ${slug}`);
            setLoading(false);
          }
          return;
        }

        const { data: entryData, error: entryError } = await supabase
          .from("travel_entries")
          .select(
            "id, trip, date, location, campground, site, water, bathroom, noise, rating, notes, photo_urls, created_at"
          )
          .eq("trip", tripData.name)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });

        if (entryError) throw entryError;

        if (!cancelled) {
          setTrip(tripData as TripRow);
          setEntries((entryData || []) as EntryRow[]);
          setLoading(false);
        }
      } catch (err: any) {
        console.error("share page load error:", err);

        if (!cancelled) {
          setTrip(null);
          setEntries([]);
          setMessage(`공유 페이지 오류: ${err?.message || "알 수 없는 오류"}`);
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const totalPhotos = useMemo(() => countPhotos(entries), [entries]);

  const pageStyle: CSSProperties = {
    minHeight: "100vh",
    background: "#f3f4f6",
    padding: "20px 14px 40px",
    color: "#111827",
  };

  const wrapStyle: CSSProperties = {
    maxWidth: 960,
    margin: "0 auto",
  };

  const cardStyle: CSSProperties = {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  };

  const entryCardStyle: CSSProperties = {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
  };

  const titleStyle: CSSProperties = {
    fontSize: 24,
    fontWeight: 800,
    margin: 0,
  };

  const subStyle: CSSProperties = {
    color: "#6b7280",
    fontSize: 15,
    marginTop: 8,
    whiteSpace: "pre-wrap",
  };

  const labelStyle: CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: "#374151",
    marginBottom: 4,
  };

  const valueStyle: CSSProperties = {
    fontSize: 15,
    color: "#111827",
    wordBreak: "break-word",
  };

  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 10,
    marginTop: 12,
  };

  const photoGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
    marginTop: 12,
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={wrapStyle}>
          <div style={cardStyle}>불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div style={pageStyle}>
        <div style={wrapStyle}>
          <div style={cardStyle}>
            <h1 style={titleStyle}>Travel Notebook Share</h1>
            <div style={subStyle}>{message || "공유된 여행을 찾을 수 없습니다."}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={wrapStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>Travel Notebook Share</h1>
          <div style={{ fontSize: 34, fontWeight: 800, marginTop: 14 }}>{trip.name}</div>
          <div style={subStyle}>
            Entries: {entries.length} · Photos: {totalPhotos}
          </div>
          <div style={{ ...subStyle, marginTop: 10 }}>읽기 전용 공유 페이지입니다.</div>
        </div>

        {entries.length === 0 ? (
          <div style={{ ...cardStyle, marginTop: 14 }}>
            공유된 기록은 있지만 아직 entry가 없습니다.
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} style={entryCardStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>
                    {entry.location || "No location"}
                  </div>
                  <div style={{ color: "#6b7280", marginTop: 4 }}>{formatDate(entry.date)}</div>
                </div>

                {entry.rating != null ? (
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 999,
                      padding: "8px 12px",
                      fontWeight: 700,
                      background: "#f9fafb",
                    }}
                  >
                    Rating: {entry.rating}/5
                  </div>
                ) : null}
              </div>

              <div style={gridStyle}>
                <div>
                  <div style={labelStyle}>Campground</div>
                  <div style={valueStyle}>{entry.campground || "-"}</div>
                </div>
                <div>
                  <div style={labelStyle}>Site</div>
                  <div style={valueStyle}>{entry.site || "-"}</div>
                </div>
                <div>
                  <div style={labelStyle}>Water</div>
                  <div style={valueStyle}>{entry.water || "-"}</div>
                </div>
                <div>
                  <div style={labelStyle}>Bathroom</div>
                  <div style={valueStyle}>{entry.bathroom || "-"}</div>
                </div>
                <div>
                  <div style={labelStyle}>Noise</div>
                  <div style={valueStyle}>{entry.noise || "-"}</div>
                </div>
              </div>

              {entry.notes ? (
                <div style={{ marginTop: 14 }}>
                  <div style={labelStyle}>Notes</div>
                  <div style={{ ...valueStyle, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {entry.notes}
                  </div>
                </div>
              ) : null}

              {entry.photo_urls && entry.photo_urls.length > 0 ? (
                <div style={photoGridStyle}>
                  {entry.photo_urls.map((url, idx) => (
                    <a
                      key={`${entry.id}-${idx}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ textDecoration: "none" }}
                    >
                      <img
                        src={url}
                        alt={`${entry.location || "photo"} ${idx + 1}`}
                        style={{
                          width: "100%",
                          aspectRatio: "4 / 3",
                          objectFit: "cover",
                          borderRadius: 14,
                          border: "1px solid #e5e7eb",
                          display: "block",
                          background: "#f3f4f6",
                        }}
                      />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}