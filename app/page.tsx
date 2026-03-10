"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type TravelEntry = {
  id: string;
  trip: string | null;
  date: string | null;
  location: string | null;
  campground: string | null;
  site: string | null;
  water: string | null;
  bathroom: string | null;
  noise: string | null;
  rating: number | null;
  notes: string | null;
  photo_urls: string[] | null;
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
  const [trip, setTrip] = useState("2026 Spring Road Trip");
  const [date, setDate] = useState(todayYMD());
  const [location, setLocation] = useState("");
  const [campground, setCampground] = useState("");
  const [site, setSite] = useState("");
  const [water, setWater] = useState("");
  const [bathroom, setBathroom] = useState("");
  const [noise, setNoise] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<TravelEntry[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    const { data, error } = await supabase
      .from("travel_entries")
      .select(
        "id, trip, date, location, campground, site, water, bathroom, noise, rating, notes, photo_urls, created_at"
      )
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setMsg("불러오기 실패: " + error.message);
      return;
    }

    setEntries((data ?? []) as TravelEntry[]);
  }

  function resetForm() {
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
    setSelectedFiles([]);
    setExistingPhotoUrls([]);
    setEditingId(null);
  }

  function handleFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    console.log("files selected =", files);
    setSelectedFiles(files);
  }

  async function uploadPhotos(): Promise<string[]> {
    if (selectedFiles.length === 0) return [];

    const uploadedUrls: string[] = [];

    for (const file of selectedFiles) {
      const ext = file.name.split(".").pop() || "jpg";
      const safeName = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const filePath = `travel/${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("travel-photos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data } = supabase.storage
        .from("travel-photos")
        .getPublicUrl(filePath);

      uploadedUrls.push(data.publicUrl);
    }

    console.log("uploadedUrls =", uploadedUrls);
    return uploadedUrls;
  }

  async function saveEntry() {
    setMsg("");
    setSaving(true);

    console.log("selectedFiles at save =", selectedFiles);

    try {
      let newPhotoUrls: string[] = [];

      if (selectedFiles.length > 0) {
        newPhotoUrls = await uploadPhotos();
      }

      console.log("newPhotoUrls =", newPhotoUrls);
      console.log("existingPhotoUrls =", existingPhotoUrls);

      let mergedPhotoUrls: string[] | null = null;

      if (editingId !== null) {
        mergedPhotoUrls = [...existingPhotoUrls, ...newPhotoUrls];
      } else {
        mergedPhotoUrls = newPhotoUrls.length > 0 ? newPhotoUrls : null;
      }

      console.log("mergedPhotoUrls =", mergedPhotoUrls);

      if (editingId) {
        const { data, error } = await supabase
          .from("travel_entries")
          .update({
            trip: trip || null,
            date,
            location: location || null,
            campground: campground || null,
            site: site || null,
            water: water || null,
            bathroom: bathroom || null,
            noise: noise || null,
            rating: rating || null,
            notes: notes || null,
            photo_urls: mergedPhotoUrls,
          })
          .eq("id", editingId)
          .select();

        console.log("update result =", data);

        if (error) {
          setMsg("수정 실패: " + error.message);
          setSaving(false);
          return;
        }

        setMsg("수정되었습니다.");
      } else {
        const { error } = await supabase.from("travel_entries").insert([
          {
            trip: trip || null,
            date,
            location: location || null,
            campground: campground || null,
            site: site || null,
            water: water || null,
            bathroom: bathroom || null,
            noise: noise || null,
            rating: rating || null,
            notes: notes || null,
            photo_urls: mergedPhotoUrls,
          },
        ]);

        if (error) {
          setMsg("저장 실패: " + error.message);
          setSaving(false);
          return;
        }

        setMsg("저장되었습니다.");
      }

      resetForm();
      await loadEntries();
    } catch (err: any) {
      setMsg("사진 업로드 실패: " + (err?.message || "알 수 없는 오류"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    const ok = window.confirm("이 기록을 삭제할까요?");
    if (!ok) return;

    const { error } = await supabase.from("travel_entries").delete().eq("id", id);

    if (error) {
      setMsg("삭제 실패: " + error.message);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    setMsg("삭제되었습니다.");
    await loadEntries();
  }

  function startEdit(entry: TravelEntry) {
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
    setExistingPhotoUrls(entry.photo_urls ?? []);
    setSelectedFiles([]);
    setMsg("수정 모드입니다. 내용 고친 뒤 Save 누르세요.");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function removeExistingPhoto(index: number) {
    const copy = [...existingPhotoUrls];
    copy.splice(index, 1);
    setExistingPhotoUrls(copy);
  }

  function mapLink(location: string | null) {
    if (!location) return "#";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      location
    )}`;
  }

  function openTripMap() {
    if (!entries || entries.length === 0) return;

    const locations = entries
      .map((e) => e.location)
      .filter((l): l is string => !!l && l.trim() !== "")
      .reverse();

    if (locations.length === 0) return;

    const url =
"https://www.google.com/maps/dir/?api=1&waypoints=" +
locations.map((l) => encodeURIComponent(l)).join("|");

    window.open(url, "_blank");
  }

  function openNextDrive() {
    if (!entries || entries.length < 2) return;

    const sorted = [...entries].sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );

    const today = new Date().toISOString().slice(0, 10);

    const index = sorted.findIndex((e) => String(e.date) >= today);

    if (index === -1 || index === sorted.length - 1) return;

    const from = String(sorted[index].location);
    const to = String(sorted[index + 1].location);

    const url =
      "https://www.google.com/maps/dir/" +
      encodeURIComponent(from) +
      "/" +
      encodeURIComponent(to);

    window.open(url, "_blank");
  }

  function StarButton({
    value,
    current,
    onClick,
  }: {
    value: number;
    current: number;
    onClick: (value: number) => void;
  }) {
    return (
      <button
        type="button"
        onClick={() => onClick(value)}
        style={{
          border: "none",
          background: "transparent",
          fontSize: 28,
          cursor: "pointer",
          padding: "0 4px",
        }}
      >
        {value <= current ? "★" : "☆"}
      </button>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "Arial" }}>
      <h1>Travel Notebook</h1>
      <p>Road Trip 기록</p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <button
          onClick={openTripMap}
          style={{ padding: "10px 18px", fontSize: 16, cursor: "pointer" }}
        >
          🗺 Open Road Trip Map
        </button>

        <button
          onClick={openNextDrive}
          style={{ padding: "10px 18px", fontSize: 16, cursor: "pointer" }}
        >
          🚗 Drive to Next Destination
        </button>
      </div>

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

      <input
        placeholder="Campground (예: Watchman CG)"
        value={campground}
        onChange={(e) => setCampground(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      <input
        placeholder="Site Number (예: B32)"
        value={site}
        onChange={(e) => setSite(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      <input
        placeholder="Water (예: Yes / No)"
        value={water}
        onChange={(e) => setWater(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      <input
        placeholder="Bathroom (예: Good / OK / Bad)"
        value={bathroom}
        onChange={(e) => setBathroom(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      <input
        placeholder="Noise (예: Quiet / Medium / Loud)"
        value={noise}
        onChange={(e) => setNoise(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      <div style={{ marginBottom: 10 }}>
        <div style={{ marginBottom: 6 }}>Rating</div>
        <div>
          {[1, 2, 3, 4, 5].map((n) => (
            <StarButton
              key={n}
              value={n}
              current={rating}
              onClick={setRating}
            />
          ))}
        </div>
      </div>

      <textarea
        placeholder="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{ width: "100%", padding: 10, height: 120, marginBottom: 10 }}
      />

      {editingId && existingPhotoUrls.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ marginBottom: 8 }}>현재 저장된 사진</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {existingPhotoUrls.map((url, idx) => (
              <div key={idx} style={{ textAlign: "center" }}>
                <a href={url} target="_blank" rel="noreferrer">
                  <img
                    src={url}
                    alt={`existing-${idx}`}
                    style={{
                      width: 120,
                      height: 90,
                      objectFit: "cover",
                      borderRadius: 8,
                      border: "1px solid #ccc",
                    }}
                  />
                </a>
                <div style={{ marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => removeExistingPhoto(idx)}
                    style={{ cursor: "pointer" }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={{ marginBottom: 6 }}>
          Photos {editingId ? "(새 사진 추가 가능)" : ""}
        </div>
<div style={{ marginBottom: 10 }}>
  <div style={{ marginBottom: 6 }}>Photos</div>

  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
    
    {/* 갤러리 선택 */}
    <label
      style={{
        padding: "8px 14px",
        border: "1px solid #ccc",
        borderRadius: 6,
        cursor: "pointer",
        background: "#f8f8f8"
      }}
    >
      📁 Choose Photos
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesChange}
        style={{ display: "none" }}
      />
    </label>
    {/* 카메라 촬영 */}
    <label
      style={{
        padding: "8px 14px",
        border: "1px solid #ccc",
        borderRadius: 6,
        cursor: "pointer",
        background: "#f8f8f8"
      }}
    >
      📷 Take Photo
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFilesChange}
        style={{ display: "none" }}
      />
    </label>
  </div>
  {selectedFiles.length > 0 && (
    <div style={{ marginTop: 8 }}>
      선택된 사진: {selectedFiles.length}장
    </div>
  )}
</div>
        {selectedFiles.length > 0 && (
          <div style={{ marginTop: 8, color: "#444" }}>
            선택된 사진: {selectedFiles.length}장
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <button
          onClick={saveEntry}
          disabled={saving}
          style={{
            padding: "10px 20px",
            cursor: "pointer",
          }}
        >
          {saving ? "Saving..." : editingId ? "Update" : "Save"}
        </button>

        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            style={{
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            Cancel Edit
          </button>
        )}
      </div>

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

            <div>
              <strong>Location:</strong>{" "}
              {entry.location ? (
                <a
                  href={mapLink(entry.location)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#0a58ca", textDecoration: "underline" }}
                >
                  {entry.location}
                </a>
              ) : (
                ""
              )}
            </div>

            <div>
              <strong>Campground:</strong>{" "}
              {entry.campground ? (
                <a
                  href={mapLink(
                    `${entry.campground}${entry.location ? ", " + entry.location : ""}`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#0a58ca", textDecoration: "underline" }}
                >
                  {entry.campground}
                </a>
              ) : (
                ""
              )}
            </div>

            <div><strong>Site:</strong> {entry.site}</div>
            <div><strong>Water:</strong> {entry.water}</div>
            <div><strong>Bathroom:</strong> {entry.bathroom}</div>
            <div><strong>Noise:</strong> {entry.noise}</div>
            <div><strong>Rating:</strong> {entry.rating ?? ""}</div>

            <div style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
              {entry.notes}
            </div>

            {entry.photo_urls && entry.photo_urls.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 12,
                }}
              >
                {entry.photo_urls.map((url, idx) => (
                  <a key={idx} href={url} target="_blank" rel="noreferrer">
                    <img
                      src={url}
                      alt={`travel-${idx}`}
                      style={{
                        width: 140,
                        height: 100,
                        objectFit: "cover",
                        borderRadius: 8,
                        border: "1px solid #ccc",
                        cursor: "pointer",
                      }}
                    />
                  </a>
                ))}
              </div>
            )}

            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => startEdit(entry)}
                style={{ cursor: "pointer" }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => deleteEntry(entry.id)}
                style={{ cursor: "pointer" }}
              >
                Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}