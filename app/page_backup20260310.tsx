"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Entry = {
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
};

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function StarButton({
  value,
  current,
  onClick,
}: {
  value: number;
  current: number;
  onClick: (n: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontSize: 32,
        lineHeight: 1,
        color: value <= current ? "#f59e0b" : "#cbd5e1",
        padding: 0,
        marginRight: 6,
      }}
      aria-label={`${value} stars`}
      title={`${value} stars`}
    >
      ★
    </button>
  );
}

export default function TravelPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [trip, setTrip] = useState("2026 Spring Road Trip");
  const [date, setDate] = useState(todayYMD());
  const [location, setLocation] = useState("");
  const [campground, setCampground] = useState("");
  const [site, setSite] = useState("");
  const [water, setWater] = useState("");
  const [bathroom, setBathroom] = useState("");
  const [noise, setNoise] = useState("");
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #d9d9d9",
    borderRadius: 10,
    fontSize: 16,
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 10,
  };

  const cardStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  };

  async function loadEntries() {
    setLoading(true);

    const { data, error } = await supabase
      .from("travel_entries")
      .select("*")
      .order("date", { ascending: true })
      .order("id", { ascending: true });

    if (!error) {
      setEntries((data ?? []) as Entry[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadEntries();
  }, []);

  function clearForm() {
    setEditingId(null);
    setTrip("2026 Spring Road Trip");
    setDate(todayYMD());
    setLocation("");
    setCampground("");
    setSite("");
    setWater("");
    setBathroom("");
    setNoise("");
    setRating(0);
    setNotes("");
  }

  async function saveEntry() {
    if (!date || !location.trim()) return;

    setSaving(true);

    const payload = {
      trip: trip.trim() || null,
      date,
      location: location.trim() || null,
      campground: campground.trim() || null,
      site: site.trim() || null,
      water: water.trim() || null,
      bathroom: bathroom.trim() || null,
      noise: noise.trim() || null,
      rating: rating > 0 ? rating : null,
      notes: notes.trim() || null,
    };

    if (editingId) {
      await supabase.from("travel_entries").update(payload).eq("id", editingId);
    } else {
      await supabase.from("travel_entries").insert(payload);
    }

    await loadEntries();
    clearForm();
    setSaving(false);
  }

  function startEdit(entry: Entry) {
    setEditingId(entry.id);
    setTrip(entry.trip ?? "2026 Spring Road Trip");
    setDate(entry.date ?? todayYMD());
    setLocation(entry.location ?? "");
    setCampground(entry.campground ?? "");
    setSite(entry.site ?? "");
    setWater(entry.water ?? "");
    setBathroom(entry.bathroom ?? "");
    setNoise(entry.noise ?? "");
    setRating(entry.rating ?? 0);
    setNotes(entry.notes ?? "");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteEntry(id: string) {
    const ok = window.confirm("이 기록을 삭제할까요?");
    if (!ok) return;

    await supabase.from("travel_entries").delete().eq("id", id);

    if (editingId === id) {
      clearForm();
    }

    await loadEntries();
  }

  const sortedEntries = useMemo(() => {
    return [...entries]
      .filter((e) => e.location && String(e.location).trim() !== "")
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [entries]);

function openMapPart1() {
  const sorted = [...entries]
    .filter((e) => e.location && String(e.location).trim() !== "")
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const part1 = sorted.slice(0, 8);

  if (part1.length < 2) {
    alert("경로를 만들려면 location이 2개 이상 필요합니다.");
    return;
  }

  const origin = encodeURIComponent(String(part1[0].location));
  const destination = encodeURIComponent(String(part1[part1.length - 1].location));

  const waypoints = part1
    .slice(1, -1)
    .map((e) => encodeURIComponent(String(e.location)))
    .join("|");

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;

  if (waypoints) {
    url += `&waypoints=${waypoints}`;
  }

  url += `&travelmode=driving`;

  window.open(url, "_blank");
}

function openMapPart2() {
  const sorted = [...entries]
    .filter((e) => e.location && String(e.location).trim() !== "")
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const part2 = sorted.slice(7);

  if (part2.length < 2) {
    alert("경로를 만들려면 location이 2개 이상 필요합니다.");
    return;
  }

  const origin = encodeURIComponent(String(part2[0].location));
  const destination = encodeURIComponent(String(part2[part2.length - 1].location));

  const waypoints = part2
    .slice(1, -1)
    .map((e) => encodeURIComponent(String(e.location)))
    .join("|");

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;

  if (waypoints) {
    url += `&waypoints=${waypoints}`;
  }

  url += `&travelmode=driving`;

  window.open(url, "_blank");
}

function driveNext() {
  const sorted = [...entries]
    .filter((e) => e.location && String(e.location).trim() !== "")
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  if (sorted.length === 0) {
    alert("저장된 목적지가 없습니다.");
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  let nextIndex = sorted.findIndex((e) => String(e.date) >= today);

  if (nextIndex === -1) nextIndex = sorted.length - 1;

  // 첫 기록이 Home이면 건너뛰기
  if (
    nextIndex === 0 &&
    sorted.length > 1 &&
    String(sorted[0].location).toLowerCase().includes("norwood")
  ) {
    nextIndex = 1;
  }

  const target = sorted[nextIndex];

  const url =
    `https://www.google.com/maps/dir/?api=1&destination=` +
    encodeURIComponent(String(target.location));

  window.open(url, "_blank");
}

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: 20,
        background: "#ffffff",
        color: "#111111",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ fontSize: 42, marginBottom: 10 }}>Travel Notebook</h1>

      <div style={{ marginBottom: 18, fontSize: 18 }}>Road Trip 기록</div>

<div style={{ marginBottom: 20 }}>
  <button type="button" onClick={openMapPart1} style={{ marginRight: 10 }}>
    🗺 Road Trip Map 1
  </button>

  <button type="button" onClick={openMapPart2} style={{ marginRight: 10 }}>
    🗺 Road Trip Map 2
  </button>

  <button type="button" onClick={driveNext}>
    🚗 Drive to Next Destination
  </button>
</div>

      <input
        value={trip}
        onChange={(e) => setTrip(e.target.value)}
        placeholder="2026 Spring Road Trip"
        style={inputStyle}
      />

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={inputStyle}
      />

      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location (예: Zion National Park)"
        style={inputStyle}
      />

      <input
        value={campground}
        onChange={(e) => setCampground(e.target.value)}
        placeholder="Campground (예: Watchman CG)"
        style={inputStyle}
      />

      <input
        value={site}
        onChange={(e) => setSite(e.target.value)}
        placeholder="Site Number (예: B32)"
        style={inputStyle}
      />

      <input
        value={water}
        onChange={(e) => setWater(e.target.value)}
        placeholder="Water (예: Yes / No)"
        style={inputStyle}
      />

      <input
        value={bathroom}
        onChange={(e) => setBathroom(e.target.value)}
        placeholder="Bathroom (예: Good / OK / Bad)"
        style={inputStyle}
      />

      <input
        value={noise}
        onChange={(e) => setNoise(e.target.value)}
        placeholder="Noise (예: Quiet / Medium / Loud)"
        style={inputStyle}
      />

      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 8, fontWeight: 700, fontSize: 18 }}>
          Rating
        </div>

        {[1, 2, 3, 4, 5].map((n) => (
          <StarButton
            key={n}
            value={n}
            current={rating}
            onClick={setRating}
          />
        ))}
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        rows={6}
        style={{
          ...inputStyle,
          resize: "vertical",
          minHeight: 120,
        }}
      />

      <div style={{ marginBottom: 10, fontWeight: 700 }}>Photos</div>
      <div style={{ marginBottom: 6 }}>Photos</div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <button type="button">📁 Choose Photos</button>
        <button type="button">📷 Take Photo</button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button type="button" onClick={saveEntry} disabled={saving}>
          {saving ? "Saving..." : editingId ? "Update" : "Save"}
        </button>

        <button type="button" onClick={clearForm} style={{ marginLeft: 10 }}>
          Clear
        </button>
      </div>

      <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "24px 0" }} />

      <h2 style={{ fontSize: 28, marginBottom: 12 }}>Saved Entries</h2>

      {loading ? (
        <p>불러오는 중...</p>
      ) : entries.length === 0 ? (
        <p>저장된 기록이 없습니다.</p>
      ) : (
        <div>
          {sortedEntries.map((e) => (
            <div key={e.id} style={cardStyle}>
              <div><b>Trip:</b> {e.trip ?? ""}</div>
              <div><b>Date:</b> {e.date}</div>
              <div><b>Location:</b> {e.location ?? ""}</div>
              <div><b>Campground:</b> {e.campground ?? ""}</div>
              <div><b>Site:</b> {e.site ?? ""}</div>
              <div><b>Water:</b> {e.water ?? ""}</div>
              <div><b>Bathroom:</b> {e.bathroom ?? ""}</div>
              <div><b>Noise:</b> {e.noise ?? ""}</div>
              <div><b>Rating:</b> {e.rating ?? ""}</div>
              <div><b>Notes:</b> {e.notes ?? ""}</div>

              <div style={{ marginTop: 10 }}>
                <button type="button" onClick={() => startEdit(e)}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteEntry(e.id)}
                  style={{ marginLeft: 8 }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}