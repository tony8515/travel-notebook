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

type ViewerItem = {
  url: string;
  type: "image" | "video";
  label?: string;
};

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString();
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|m4v|webm|ogg)$/i.test(url.split("?")[0]);
}

function mediaTypeFromUrl(url: string): "image" | "video" {
  return isVideoUrl(url) ? "video" : "image";
}

function countMedia(entries: EntryRow[]) {
  return entries.reduce((sum, entry) => sum + (entry.photo_urls?.length ?? 0), 0);
}

export default function ShareTripPage() {
  const params = useParams();
  const [playedVideoUrls, setPlayedVideoUrls] = useState<string[]>([]);
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

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerItems, setViewerItems] = useState<ViewerItem[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

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
          .order("date", { ascending: true })
          .order("created_at", { ascending: true });

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

  useEffect(() => {
    if (!viewerOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setViewerOpen(false);
      } else if (event.key === "ArrowLeft") {
        setViewerIndex((prev) =>
          prev === 0 ? Math.max(viewerItems.length - 1, 0) : prev - 1
        );
      } else if (event.key === "ArrowRight") {
        setViewerIndex((prev) =>
          prev === viewerItems.length - 1 ? 0 : prev + 1
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [viewerOpen, viewerItems.length]);

  const totalMedia = useMemo(() => countMedia(entries), [entries]);

  function openViewer(items: ViewerItem[], startIndex: number) {
    if (!items.length) return;
    setViewerItems(items);
    setViewerIndex(startIndex);
    setViewerOpen(true);
  }

  function closeViewer() {
    setViewerOpen(false);
  }

  function goPrevViewer() {
    setViewerIndex((prev) =>
      prev === 0 ? Math.max(viewerItems.length - 1, 0) : prev - 1
    );
  }

  function goNextViewer() {
    setViewerIndex((prev) =>
      prev === viewerItems.length - 1 ? 0 : prev + 1
    );
  }

  const currentViewerItem = viewerItems[viewerIndex] || null;

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

  const mediaGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
    marginTop: 12,
  };

  const viewerNavBtn: CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 10001,
    background: "rgba(0,0,0,0.65)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 24,
    fontWeight: 700,
    cursor: "pointer",
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
            Entries: {entries.length} · Media: {totalMedia}
          </div>
          <div style={{ ...subStyle, marginTop: 10 }}>읽기 전용 공유 페이지입니다.</div>
        </div>

        {entries.length === 0 ? (
          <div style={{ ...cardStyle, marginTop: 14 }}>
            공유된 기록은 있지만 아직 entry가 없습니다.
          </div>
        ) : (
          entries.map((entry) => {
            const mediaItems: ViewerItem[] = (entry.photo_urls || []).map((url) => ({
              url,
              type: mediaTypeFromUrl(url),
              label: entry.location || entry.campground || formatDate(entry.date),
            }));

            return (
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
                    <div style={{ color: "#6b7280", marginTop: 4 }}>
                      {formatDate(entry.date)}
                    </div>
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
                    <div style={labelStyle}>Accomodation</div>
                    <div style={valueStyle}>{entry.campground || "-"}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>Site/Room</div>
                    <div style={valueStyle}>{entry.site || "-"}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>Amenities</div>
                    <div style={valueStyle}>{entry.water || "-"}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>Cleanliness</div>
                    <div style={valueStyle}>{entry.bathroom || "-"}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>Quietness</div>
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
                  <div style={mediaGridStyle}>
                    {entry.photo_urls.map((url, idx) => {
                      const type = mediaTypeFromUrl(url);

return type === "video" ? (
  playedVideoUrls.includes(url) ? (
    <video
      key={`${entry.id}-${idx}`}
      src={url}
      muted
      playsInline
      preload="metadata"
      onLoadedMetadata={(e) => {
        try {
          e.currentTarget.currentTime = 0.1;
        } catch {}
      }}
      onClick={() => openViewer(mediaItems, idx)}
      style={{
        width: "100%",
        aspectRatio: "4 / 3",
        objectFit: "cover",
        borderRadius: 14,
        border: "1px solid #e5e7eb",
        display: "block",
        background: "#000",
        cursor: "pointer",
      }}
    />
  ) : (
    <div
      key={`${entry.id}-${idx}`}
      onClick={() => openViewer(mediaItems, idx)}
      style={{
        width: "100%",
        aspectRatio: "4 / 3",
        borderRadius: 14,
        border: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#111827",
        color: "#fff",
        cursor: "pointer",
        fontWeight: 800,
        fontSize: 24,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 42, lineHeight: 1 }}>▶</div>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.3 }}>
          VIDEO
        </div>
      </div>
    </div>
  )
) : (
  <img
    key={`${entry.id}-${idx}`}
    src={url}
    alt={`${entry.location || "media"} ${idx + 1}`}
    onClick={() => openViewer(mediaItems, idx)}
    style={{
      width: "100%",
      aspectRatio: "4 / 3",
      objectFit: "cover",
      borderRadius: 14,
      border: "1px solid #e5e7eb",
      display: "block",
      background: "#f3f4f6",
      cursor: "pointer",
    }}
  />
)
                    })}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {viewerOpen && currentViewerItem && (
        <div
          onClick={closeViewer}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              closeViewer();
            }}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 10002,
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ✕ 닫기
          </button>

          {viewerItems.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrevViewer();
                }}
                style={{ ...viewerNavBtn, left: 16 }}
              >
                ‹
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goNextViewer();
                }}
                style={{ ...viewerNavBtn, right: 16 }}
              >
                ›
              </button>
            </>
          )}

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 1200,
              maxHeight: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>
              {viewerIndex + 1} / {viewerItems.length}
              {currentViewerItem.label ? ` · ${currentViewerItem.label}` : ""}
            </div>

            {currentViewerItem.type === "video" ? (
<video
  src={currentViewerItem.url}
  controls
  autoPlay
  playsInline
  preload="auto"
  onPlay={() => {
    if (currentViewerItem?.url) {
      setPlayedVideoUrls((prev) =>
        prev.includes(currentViewerItem.url) ? prev : [...prev, currentViewerItem.url]
      );
    }
  }}
  style={{
    maxWidth: "100%",
    maxHeight: "calc(100vh - 80px)",
    borderRadius: 12,
    background: "#000",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  }}
/>
            ) : (
              <img
  src={currentViewerItem.url}
  alt="viewer"
  style={{
    maxWidth: "100%",
    maxHeight: "calc(100vh - 80px)",
    borderRadius: 12,
    objectFit: "contain",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  }}
/>
            )}

            {viewerItems.length > 1 && (
              <div style={{ color: "#d1d5db", fontSize: 13 }}>
                키보드 ← / → 로도 넘길 수 있습니다
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}