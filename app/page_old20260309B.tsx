"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function safeText(v: string | null | undefined) {
  return (v ?? "").trim();
}

function mapsSearchLink(location: string | null) {
  const q = safeText(location);
  if (!q) return "#";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function sortedEntries(entries: Entry[]) {
  return [...entries].sort((a, b) => String(a.date).localeCompare(String(b.date)));
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
  const active = value <= current;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontSize: 34,
        lineHeight: 1,
        padding: 0,
        color: active ? "#f59e0b" : "#cbd5e1",
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
  const [msg, setMsg] = useState("");

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

  const chooseInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  async function loadEntries() {
    setLoading(true);
    setMsg("");

    const { data, error } = await supabase
      .from("travel_entries")
      .select("*")
      .order("date", { ascending: true });

    if (error) {
      setMsg(`불러오기 실패: ${error.message}`);
      setEntries([]);
      setLoading(false);
      return;
    }

    setEntries((data ?? []) as Entry[]);
    setLoading(false);
  }

  useEffect(() => {
    loadEntries();
  }, []);

  const orderedEntries = useMemo(() => sortedEntries(entries), [entries]);

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
    setMsg("");
  }

  async function saveEntry() {
    if (!date) {
      setMsg("날짜를 넣어주세요.");
      return;
    }
    if (!safeText(location)) {
      setMsg("Location을 넣어주세요.");
      return;
    }

    setSaving(true);
    setMsg(editingId ? "수정 중..." : "저장 중...");

    const payload = {
      trip: safeText(trip) || null,
      date,
      location: safeText(location) || null,
      campground: safeText(campground) || null,
      site: safeText(site) || null,
      water: safeText(water) || null,
      bathroom: safeText(bathroom) || null,
      noise: safeText(noise) || null,
      rating: rating > 0 ? rating : null,
      notes: safeText(notes) || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("travel_entries")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        setMsg(`수정 실패: ${error.message}`);
        setSaving(false);
        return;
      }

      setMsg("수정 완료");
    } else {
      const { error } = await supabase.from("travel_entries").insert(payload);

      if (error) {
        setMsg(`저장 실패: ${error.message}`);
        setSaving(false);
        return;
      }

      setMsg("저장 완료");
    }

    await loadEntries();
    clearForm();
    setSaving(false);
  }

  function startEdit(e: Entry) {
    setEditingId(e.id);
    setTrip(e.trip ?? "2026 Spring Road Trip");
    setDate(e.date ?? todayYMD());
    setLocation(e.location ?? "");
    setCampground(e.campground ?? "");
    setSite(e.site ?? "");
    setWater(e.water ?? "");
    setBathroom(e.bathroom ?? "");
    setNoise(e.noise ?? "");
    setRating(e.rating ?? 0);
    setNotes(e.notes ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeEntry(id: string) {
    const ok = window.confirm("이 기록을 삭제할까요?");
    if (!ok) return;

    const { error } = await supabase.from("travel_entries").delete().eq("id", id);

    if (error) {
      setMsg(`삭제 실패: ${error.message}`);
      return;
    }

    if (editingId === id) clearForm();

    setMsg("삭제 완료");
    await loadEntries();
  }

  function openRoadTripMap() {
    const valid = orderedEntries.filter((e) => safeText(e.location));
    if (valid.length < 2) {
      setMsg("경로를 열려면 location이 2개 이상 있어야 합니다.");
      return;
    }

    const origin = encodeURIComponent(String(valid[0].location));
    const destination = encodeURIComponent(String(valid[valid.length - 1].location));
    const waypoints = valid
      .slice(1, -1)
      .map((e) => encodeURIComponent(String(e.location)))
      .join("|");

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    if (waypoints) url += `&waypoints=${waypoints}`;

    window.open(url, "_blank");
  }

  function driveToNextDestination() {
    const valid = orderedEntries.filter((e) => safeText(e.location));
    if (valid.length === 0) {
      setMsg("저장된 목적지가 없습니다.");
      return;
    }

    const today = todayYMD();
    const nextIndex = valid.findIndex((e) => String(e.date) >= today);

    const target =
      nextIndex >= 0 && nextIndex < valid.length
        ? valid[nextIndex]
        : valid[valid.length - 1];

    const destination = encodeURIComponent(String(target.location));
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

    window.open(url, "_blank");
  }

  function handleChoosePhotos() {
    chooseInputRef.current?.click();
  }

  function handleTakePhoto() {
    cameraInputRef.current?.click();
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    const count = files?.length ?? 0;
    if (count > 0) {
      setMsg(`사진 ${count}개 선택됨 (업로드 기능은 다음 단계에서 연결)`);
    }
    e.target.value = "";
  }

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

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 8,
  };

  const primaryButtonStyle: React.CSSProperties = {
    padding: "12px 18px",
    borderRadius: 10,
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  };

  const secondaryButtonStyle: React.CSSProperties = {
    padding: "12px 18px",
    borderRadius: 10,
    border: "1px solid #d9d9d9",
    background: "#fff",
    color: "#111",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  };

  const smallButtonStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #d9d9d9",
    background: "#fff",
    color: "#111",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  };

  const smallDangerButtonStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #ef4444",
    background: "#fff",
    color: "#ef4444",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  };

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: 20,
        background: "#fff",
        color: "#111",
      }}
    >
      <h1 style={{ fontSize: 42, marginBottom: 12 }}>Travel Notebook</h1>

      <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={openRoadTripMap} style={secondaryButtonStyle}>
          🗺 Open Road Trip Map
        </button>
        <button type="button" onClick={driveToNextDestination} style={secondaryButtonStyle}>
          🚗 Drive to Next Destination
        </button>
      </div>

      <div style={{ ...sectionTitleStyle, marginTop: 10 }}>Entry</div>

      <input
        value={trip}
        onChange={(e) => setTrip(e.target.value)}
        placeholder="Trip (예: 2026 Spring Road Trip)"
        style={inputStyle}
      />

      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />

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
        <div style={sectionTitleStyle}>Rating</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <StarButton key={n} value={n} current={rating} onClick={setRating} />
          ))}
        </div>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        rows={6}
        style={{
          ...inputStyle,
          resize: "vertical",
          minHeight: 130,
          marginBottom: 16,
        }}
      />

      <div style={{ ...sectionTitleStyle, marginBottom: 6 }}>Photos</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <button type="button" onClick={handleChoosePhotos} style={secondaryButtonStyle}>
          📁 Choose Photos
        </button>
        <button type="button" onClick={handleTakePhoto} style={secondaryButtonStyle}>
          📷 Take Photo
        </button>

        <input
          ref={chooseInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleFilesSelected}
        />

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={handleFilesSelected}
        />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <button type="button" onClick={saveEntry} style={primaryButtonStyle} disabled={saving}>
          {saving ? "Saving..." : editingId ? "Update" : "Save"}
        </button>
        <button type="button" onClick={clearForm} style={secondaryButtonStyle}>
          Clear
        </button>
      </div>

      {msg && (
        <div style={{ marginBottom: 20, color: "#b91c1c", fontWeight: 700 }}>
          {msg}
        </div>
      )}

      <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "24px 0" }} />

      <h2 style={{ fontSize: 28, marginBottom: 12 }}>Saved Entries</h2>

      {loading ? (
        <p>불러오는 중...</p>
      ) : orderedEntries.length === 0 ? (
        <p>저장된 기록이 없습니다.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {orderedEntries.map((e) => (
            <div
              key={e.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div><b>Trip:</b> {e.trip}</div>
              <div><b>Date:</b> {e.date}</div>
              <div>
                <b>Location:</b>{" "}
                {safeText(e.location) ? (
                  <a href={mapsSearchLink(e.location)} target="_blank" rel="noreferrer">
                    {e.location}
                  </a>
                ) : (
                  ""
                )}
              </div>
              <div>
                <b>Campground:</b>{" "}
                {safeText(e.campground) ? (
                  <a href={mapsSearchLink(e.campground)} target="_blank" rel="noreferrer">
                    {e.campground}
                  </a>
                ) : (
                  ""
                )}
              </div>
              <div><b>Site:</b> {e.site}</div>
              <div><b>Water:</b> {e.water}</div>
              <div><b>Bathroom:</b> {e.bathroom}</div>
              <div><b>Noise:</b> {e.noise}</div>
              <div><b>Rating:</b> {e.rating}</div>
              <div><b>Notes:</b> {e.notes}</div>

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button type="button" onClick={() => startEdit(e)} style={smallButtonStyle}>
                  Edit
                </button>
                <button type="button" onClick={() => removeEntry(e.id)} style={smallDangerButtonStyle}>
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