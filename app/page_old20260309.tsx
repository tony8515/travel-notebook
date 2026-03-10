"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type TravelEntry = {
  id: string;
  trip: string | null;
  date: string | null;
  location: string | null;
  notes: string | null;
  rating: number | null;
  created_at: string | null;
};

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function Page() {
  const [trip, setTrip] = useState("");
  const [date, setDate] = useState(todayYMD());
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState("");
  const [msg, setMsg] = useState("");
  const [entries, setEntries] = useState<TravelEntry[]>([]);

  async function loadEntries() {
    const { data, error } = await supabase
      .from("travel_entries")
      .select("id, trip, date, location, notes, rating, created_at")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMsg("불러오기 실패: " + error.message);
      return;
    }

    setEntries(data ?? []);
  }

  useEffect(() => {
    loadEntries();
  }, []);

  async function saveEntry() {
    setMsg("");

    const ratingNum = rating ? Number(rating) : null;

    const { error } = await supabase.from("travel_entries").insert([
      {
        trip: trip || null,
        date,
        location: location || null,
        notes: notes || null,
        rating: ratingNum,
      },
    ]);

    if (error) {
      setMsg("저장 실패: " + error.message);
      return;
    }

    setMsg("저장되었습니다.");
    setTrip("");
    setDate(todayYMD());
    setLocation("");
    setNotes("");
    setRating("");
    loadEntries();
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "Arial" }}>
      <h1>Travel Notebook</h1>
      <p>Road Trip 기록</p>

      <input
        placeholder="Trip (예: 2026 Spring Road Trip)"
        value={trip}
        onChange={(e) => setTrip(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      <input
        placeholder="Location (예: Zion National Park)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      <textarea
        placeholder="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{ width: "100%", padding: 10, height: 120, marginBottom: 10 }}
      />

      <input
        type="number"
        min="1"
        max="5"
        placeholder="Rating 1~5"
        value={rating}
        onChange={(e) => setRating(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      <button
        onClick={saveEntry}
        style={{ marginTop: 10, padding: "10px 20px" }}
      >
        Save
      </button>

      {msg ? <p style={{ marginTop: 12 }}>{msg}</p> : null}

      <hr style={{ margin: "30px 0" }} />

      <h2>Saved Entries</h2>

      {entries.length === 0 ? (
        <p>아직 저장된 기록이 없습니다.</p>
      ) : (
        entries.map((entry) => (
          <div
            key={entry.id}
            style={{
              border: "1px solid #ddd",
              padding: 12,
              marginBottom: 12,
              borderRadius: 8,
            }}
          >
            <div><strong>Trip:</strong> {entry.trip}</div>
            <div><strong>Date:</strong> {entry.date}</div>
            <div><strong>Location:</strong> {entry.location}</div>
            <div><strong>Rating:</strong> {entry.rating ?? ""}</div>
            <div style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
              {entry.notes}
            </div>
          </div>
        ))
      )}
    </div>
  );
}