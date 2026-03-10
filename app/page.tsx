"use client";

import { ChangeEvent, useEffect, useState } from "react";
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

function mapLink(location: string | null) {
  if (!location) return "#";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    location
  )}`;
}

export default function Page() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    setLoading(true);

    const { data, error } = await supabase
      .from("travel_entries")
      .select("*")
      .order("date", { ascending: true });

    if (error) {
      setMsg("불러오기 실패: " + error.message);
      setLoading(false);
      return;
    }

    setEntries((data as Entry[]) || []);
    setLoading(false);
  }

  function resetForm() {
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
    setExistingPhotoUrls([]);
    setSelectedFiles([]);
    setMsg("");
  }

  function handleFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
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

    return uploadedUrls;
  }

  async function saveEntry() {
    setMsg("");
    setSaving(true);

    try {
      let newPhotoUrls: string[] = [];

      if (selectedFiles.length > 0) {
        newPhotoUrls = await uploadPhotos();
      }

      const mergedPhotoUrls =
        editingId !== null
          ? [...existingPhotoUrls, ...newPhotoUrls]
          : newPhotoUrls.length > 0
          ? newPhotoUrls
          : null;

      if (editingId) {
        const { error } = await supabase
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
          .eq("id", editingId);

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
    const ok = confirm("이 기록을 삭제할까요?");
    if (!ok) return;

    const { error } = await supabase.from("travel_entries").delete().eq("id", id);

    if (error) {
      setMsg("삭제 실패: " + error.message);
      return;
    }

    setMsg("삭제되었습니다.");
    await loadEntries();
  }

  function startEdit(entry: Entry) {
    setEditingId(entry.id);
    setTrip(entry.trip ?? "");
    setDate(entry.date);
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

function openTripMap() {
  if (!entries || entries.length < 2) return;

  const locations = entries
    .map((e) => e.location)
    .filter((l): l is string => !!l && l.trim() !== "");

  if (locations.length < 2) return;

  const url =
    "https://www.google.com/maps/dir/" +
    locations.map((l) => encodeURIComponent(l)).join("/");

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

    const from = String(sorted[index].location || "");
    const to = String(sorted[index + 1].location || "");

    if (!from || !to) return;

    const url =
      "https://www.google.com/maps/dir/?api=1" +
      "&origin=" +
      encodeURIComponent(from) +
      "&destination=" +
      encodeURIComponent(to) +
      "&travelmode=driving";

    window.open(url, "_blank");
  }

  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: 16,
        background: "#ffffff",
        color: "#111111",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ marginBottom: 4, fontSize: 48, lineHeight: 1.05 }}>
        Travel Notebook
      </h1>
      <div style={{ marginBottom: 16, fontSize: 18 }}>Road Trip 기록</div>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <button
          type="button"
          onClick={openTripMap}
          style={{
            padding: "12px 18px",
            cursor: "pointer",
            background: "#f3f6fb",
            color: "#111111",
            border: "1px solid #cfd8e3",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          🗺️ Open Road Trip Map
        </button>

        <button
          type="button"
          onClick={openNextDrive}
          style={{
            padding: "12px 18px",
            cursor: "pointer",
            background: "#f3f6fb",
            color: "#111111",
            border: "1px solid #cfd8e3",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          🚗 Drive to Next Destination
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          value={trip}
          onChange={(e) => setTrip(e.target.value)}
          placeholder="Trip (예: 2026 Spring Road Trip)"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (예: Zion National Park)"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          value={campground}
          onChange={(e) => setCampground(e.target.value)}
          placeholder="Campground (예: Watchman CG)"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          value={site}
          onChange={(e) => setSite(e.target.value)}
          placeholder="Site Number (예: B32)"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          value={water}
          onChange={(e) => setWater(e.target.value)}
          placeholder="Water (예: Yes / No)"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          value={bathroom}
          onChange={(e) => setBathroom(e.target.value)}
          placeholder="Bathroom (예: Good / OK / Bad)"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          value={noise}
          onChange={(e) => setNoise(e.target.value)}
          placeholder="Noise (예: Quiet / Medium / Loud)"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 8, fontWeight: 700, fontSize: 18 }}>
          Rating
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

      <div style={{ marginBottom: 12 }}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          rows={6}
          style={{
            ...inputStyle,
            resize: "vertical",
            minHeight: 150,
          }}
        />
      </div>

      {editingId && existingPhotoUrls.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ marginBottom: 8, fontWeight: 700 }}>현재 사진</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {existingPhotoUrls.map((url, index) => (
              <div key={url + index}>
                <img
                  src={url}
                  alt="travel"
                  style={{
                    width: 120,
                    height: 90,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    display: "block",
                    marginBottom: 6,
                  }}
                />
                <button
                  type="button"
                  onClick={() => removeExistingPhoto(index)}
                  style={smallDangerButtonStyle}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={{ marginBottom: 8, fontWeight: 700 }}>
          Photos {editingId ? "(새 사진 추가 가능)" : ""}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label style={photoButtonStyle}>
            📁 Choose Photos
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilesChange}
              style={{ display: "none" }}
            />
          </label>

          <label style={photoButtonStyle}>
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
          <div style={{ marginTop: 8, color: "#333", fontWeight: 600 }}>
            선택된 사진: {selectedFiles.length}장
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button
          onClick={saveEntry}
          disabled={saving}
          style={{
            padding: "12px 22px",
            cursor: "pointer",
            background: "#0d6efd",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          {saving ? "Saving..." : editingId ? "Update" : "Save"}
        </button>

        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            style={{
              padding: "12px 22px",
              cursor: "pointer",
              background: "#f1f3f5",
              color: "#111111",
              border: "1px solid #ced4da",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            Cancel Edit
          </button>
        )}
      </div>

      {msg && (
        <p
          style={{
            marginTop: 14,
            color: msg.includes("실패") ? "#c62828" : "#1b5e20",
            fontWeight: 700,
          }}
        >
          {msg}
        </p>
      )}

      <hr style={{ margin: "28px 0" }} />

      <h2 style={{ fontSize: 32, marginBottom: 14 }}>Saved Entries</h2>

      {loading ? (
        <p>불러오는 중...</p>
      ) : entries.length === 0 ? (
        <p>아직 저장된 기록이 없습니다.</p>
      ) : (
        [...entries]
          .sort((a, b) => String(a.date).localeCompare(String(b.date)))
          .map((entry) => (
            <div
              key={entry.id}
              style={{
                border: "1px solid #d9d9d9",
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
                background: "#ffffff",
              }}
            >
              <div>
                <strong>Trip:</strong> {entry.trip}
              </div>
              <div>
                <strong>Date:</strong> {entry.date}
              </div>
              <div>
                <strong>Location:</strong>{" "}
                {entry.location ? (
                  <a
                    href={mapLink(entry.location)}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "#0056cc",
                      textDecoration: "underline",
                      fontWeight: 700,
                    }}
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
                    style={{
                      color: "#0056cc",
                      textDecoration: "underline",
                      fontWeight: 700,
                    }}
                  >
                    {entry.campground}
                  </a>
                ) : (
                  ""
                )}
              </div>
              <div>
                <strong>Site:</strong> {entry.site}
              </div>
              <div>
                <strong>Water:</strong> {entry.water}
              </div>
              <div>
                <strong>Bathroom:</strong> {entry.bathroom}
              </div>
              <div>
                <strong>Noise:</strong> {entry.noise}
              </div>
              <div>
                <strong>Rating:</strong> {entry.rating}
              </div>

              {entry.notes && (
                <div style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
                  {entry.notes}
                </div>
              )}

              {entry.photo_urls && entry.photo_urls.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {entry.photo_urls.map((url, i) => (
                    <a
                      key={url + i}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={url}
                        alt="travel"
                        style={{
                          width: 120,
                          height: 90,
                          objectFit: "cover",
                          borderRadius: 8,
                          border: "1px solid #ddd",
                        }}
                      />
                    </a>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => startEdit(entry)}
                  style={smallButtonStyle}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteEntry(entry.id)}
                  style={smallDangerButtonStyle}
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
        fontSize: 34,
        cursor: "pointer",
        color: value <= current ? "#f5b301" : "#999999",
        lineHeight: 1,
      }}
      aria-label={`rate ${value}`}
      title={`${value}점`}
    >
      ★
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 12px",
  border: "1px solid #cfcfcf",
  borderRadius: 8,
  fontSize: 16,
  background: "#ffffff",
  color: "#111111",
  boxSizing: "border-box",
};

const photoButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  border: "1px solid #bdbdbd",
  borderRadius: 8,
  cursor: "pointer",
  background: "#ffffff",
  color: "#111111",
  fontWeight: 700,
  display: "inline-block",
};

const smallButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  cursor: "pointer",
  background: "#f1f3f5",
  color: "#111111",
  border: "1px solid #ced4da",
  borderRadius: 6,
  fontWeight: 700,
};

const smallDangerButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  cursor: "pointer",
  background: "#fff5f5",
  color: "#b42318",
  border: "1px solid #f1b0b7",
  borderRadius: 6,
  fontWeight: 700,
};