"use client";

import {
  ChangeEvent,
  CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type EntryRow = {
  id: string;
  user_id: string | null;
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

type FormState = {
  trip: string;
  date: string;
  location: string;
  campground: string;
  site: string;
  water: string;
  bathroom: string;
  noise: string;
  rating: string;
  notes: string;
};

type Stop = {
  label: string;
  query: string;
};

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(): FormState {
  return {
    trip: "2026 Spring Road Trip",
    date: todayYMD(),
    location: "",
    campground: "",
    site: "",
    water: "",
    bathroom: "",
    noise: "",
    rating: "",
    notes: "",
  };
}

const TABLE = "travel_entries";
const BUCKET = "roadtrip-photos";

const MAP1: Stop[] = [
  { label: "Jackson, Mississippi", query: "Jackson, Mississippi" },
  { label: "Dallas, Texas", query: "Dallas, Texas" },
  { label: "Carlsbad, New Mexico", query: "Carlsbad, New Mexico 88220" },
  { label: "Las Cruces, New Mexico", query: "Las Cruces, New Mexico" },
  { label: "Tucson, Arizona", query: "Tucson, Arizona" },
  {
    label: "Joshua Tree National Park",
    query: "Joshua Tree National Park, California",
  },
  { label: "Irvine, California", query: "Irvine, California" },
  { label: "Santa Monica, California", query: "Santa Monica, California" },
];

const MAP2: Stop[] = [
  { label: "Santa Monica, California", query: "Santa Monica, California" },
  { label: "Pasadena, California", query: "Pasadena, California" },
  {
    label: "Potwisha Campground, Sequoia",
    query:
      "Potwisha Campground, Sequoia National Park, Generals Highway, Three Rivers, CA",
  },
  {
    label: "Furnace Creek Campground, Death Valley",
    query: "Furnace Creek Campground, Death Valley National Park, California",
  },
  { label: "Las Vegas, Nevada", query: "Las Vegas, Nevada" },
  { label: "Zion National Park", query: "Zion National Park, Utah" },
  { label: "Bryce Canyon National Park", query: "Bryce Canyon National Park, Utah" },
  { label: "Moab, Utah", query: "Moab, Utah 84532" },
  { label: "Mexican Hat, Utah", query: "Mexican Hat, Utah 84531" },
];

const MAP3: Stop[] = [
  { label: "Mexican Hat, Utah", query: "Mexican Hat, Utah 84531" },
  { label: "Page, Arizona", query: "Page, Arizona" },
  { label: "Sedona, Arizona", query: "Sedona, Arizona" },
  { label: "Holbrook, Arizona", query: "Holbrook, Arizona" },
  { label: "Albuquerque, New Mexico", query: "Albuquerque, New Mexico" },
  { label: "Amarillo, Texas", query: "Amarillo, Texas" },
  { label: "Oklahoma City, Oklahoma", query: "Oklahoma City, Oklahoma" },
  { label: "Little Rock, Arkansas", query: "Little Rock, Arkansas" },
  { label: "Memphis, Tennessee", query: "Memphis, Tennessee" },
  { label: "Nashville, Tennessee", query: "Nashville, Tennessee" },
  { label: "Home", query: "3272 Norwood Ct NW, Duluth, GA 30096" },
];

function buildGoogleMapsDirections(stops: Stop[]) {
  if (stops.length < 2) return "#";

  const origin = encodeURIComponent(stops[0].query);
  const destination = encodeURIComponent(stops[stops.length - 1].query);
  const waypoints = stops
    .slice(1, -1)
    .map((s) => encodeURIComponent(s.query))
    .join("|");

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  if (waypoints) url += `&waypoints=${waypoints}`;
  return url;
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)(\?|$)/i.test(url);
}

function fileNameFromUrl(url: string) {
  try {
    const clean = url.split("?")[0];
    return decodeURIComponent(clean.substring(clean.lastIndexOf("/") + 1));
  } catch {
    return "file";
  }
}

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("새 기록 입력 모드");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const map1Url = useMemo(() => buildGoogleMapsDirections(MAP1), []);
  const map2Url = useMemo(() => buildGoogleMapsDirections(MAP2), []);
  const map3Url = useMemo(() => buildGoogleMapsDirections(MAP3), []);

  useEffect(() => {
    let alive = true;

    async function init() {
      const { data, error } = await supabase.auth.getSession();

      if (!alive) return;

      if (error) {
        setMsg(`세션 오류: ${error.message}`);
        setLoading(false);
        setSessionChecked(true);
        return;
      }

      const session = data.session;

      if (!session?.user) {
        setUserId(null);
        setEmail("");
        setEntries([]);
        setLoading(false);
        setSessionChecked(true);
        setMsg("로그인 해주세요.");
        return;
      }

      setUserId(session.user.id);
      setEmail(session.user.email ?? "");
      await loadEntries(session.user.id);
      setLoading(false);
      setSessionChecked(true);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const uid = session?.user?.id ?? null;
        setUserId(uid);
        setEmail(session?.user?.email ?? "");

        if (uid) {
          await loadEntries(uid);
        } else {
          setEntries([]);
        }

        setSessionChecked(true);
        setLoading(false);
      }
    );

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function loadEntries(uid: string) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("user_id", uid)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setMsg(`불러오기 오류: ${error.message}`);
      return;
    }

    setEntries((data ?? []) as EntryRow[]);
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onChooseFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setSelectedFiles((prev) => [...prev, ...files]);
    setMsg(`${files.length}개 파일 선택됨`);
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadFiles(uid: string) {
    if (!selectedFiles.length) return [];

    const uploadedUrls: string[] = [];

    for (const file of selectedFiles) {
      setMsg(`업로드 중: ${file.name}`);

      const original = file.name || "upload";
      const safeName = original.replace(/[^\w.\-]+/g, "_");
      const dot = safeName.lastIndexOf(".");
      const ext = dot >= 0 ? safeName.slice(dot) : "";
      const path = `${uid}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  }

  async function handleLogin() {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setMsg("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setLoginBusy(true);
    setMsg("로그인 중...");

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });

    if (error) {
      setMsg(`로그인 오류: ${error.message}`);
    } else {
      setMsg("로그인 성공");
      setLoginPassword("");
    }

    setLoginBusy(false);
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMsg(`로그아웃 오류: ${error.message}`);
      return;
    }

    setUserId(null);
    setEmail("");
    setEntries([]);
    setSelectedFiles([]);
    setEditingId(null);
    setForm(emptyForm());
    setLoginEmail("");
    setLoginPassword("");
    setMsg("로그아웃되었습니다.");

    window.location.reload();
  }

  async function handleSave() {
    if (!userId) {
      setMsg("로그인이 필요합니다.");
      return;
    }

    if (!form.date) {
      setMsg("날짜를 입력해주세요.");
      return;
    }

    setBusy(true);
    setMsg(editingId ? "수정 저장 중..." : "저장 중...");

    try {
      let uploadedUrls: string[] = [];

      if (selectedFiles.length) {
        uploadedUrls = await uploadFiles(userId);
      }

      if (editingId) {
        const current = entries.find((e) => e.id === editingId);
        const mergedUrls = [...(current?.photo_urls ?? []), ...uploadedUrls];

        const payload = {
          trip: form.trip || null,
          date: form.date,
          location: form.location || null,
          campground: form.campground || null,
          site: form.site || null,
          water: form.water || null,
          bathroom: form.bathroom || null,
          noise: form.noise || null,
          rating: form.rating ? Number(form.rating) : null,
          notes: form.notes || null,
          photo_urls: mergedUrls.length ? mergedUrls : null,
        };

        const { error } = await supabase
          .from(TABLE)
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;

        setMsg("수정 저장 완료");
      } else {
        const payload = {
          user_id: userId,
          trip: form.trip || null,
          date: form.date,
          location: form.location || null,
          campground: form.campground || null,
          site: form.site || null,
          water: form.water || null,
          bathroom: form.bathroom || null,
          noise: form.noise || null,
          rating: form.rating ? Number(form.rating) : null,
          notes: form.notes || null,
          photo_urls: uploadedUrls.length ? uploadedUrls : null,
        };

        const { error } = await supabase.from(TABLE).insert(payload);

        if (error) throw error;

        setMsg("저장 완료");
      }

      setEditingId(null);
      setForm(emptyForm());
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";

      await loadEntries(userId);
    } catch (err: any) {
      setMsg(`저장 오류: ${err?.message ?? "알 수 없는 오류"}`);
    } finally {
      setBusy(false);
    }
  }

  function handleEdit(row: EntryRow) {
    setEditingId(row.id);
    setForm({
      trip: row.trip ?? "2026 Spring Road Trip",
      date: row.date ?? todayYMD(),
      location: row.location ?? "",
      campground: row.campground ?? "",
      site: row.site ?? "",
      water: row.water ?? "",
      bathroom: row.bathroom ?? "",
      noise: row.noise ?? "",
      rating: row.rating ? String(row.rating) : "",
      notes: row.notes ?? "",
    });
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setMsg("수정 모드");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id: string) {
    if (!confirm("이 기록을 삭제할까요?")) return;
    if (!userId) return;

    const { error } = await supabase.from(TABLE).delete().eq("id", id);

    if (error) {
      setMsg(`삭제 오류: ${error.message}`);
      return;
    }

    if (editingId === id) {
      setEditingId(null);
      setForm(emptyForm());
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }

    setMsg("삭제 완료");
    await loadEntries(userId);
  }

  function clearForm() {
    setEditingId(null);
    setForm(emptyForm());
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setMsg("새 기록 입력 모드");
  }

  function driveToLocation(loc: string | null) {
    const location = (loc ?? "").trim();
    if (!location) {
      setMsg("Location 정보가 없습니다.");
      return;
    }
    window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      location
    )}`;
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.wrap}>
          <section style={styles.card}>불러오는 중...</section>
        </div>
      </main>
    );
  }

  if (!loading && sessionChecked && !userId) {
    return (
      <main style={styles.page}>
        <div style={styles.wrap}>
          <section style={styles.topCard}>
            <div>
              <h1 style={styles.title}>Travel Notebook</h1>
              <div style={styles.sub}>로그인 후 사용하세요</div>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionTitle}>로그인</div>

            <div style={styles.formGrid1}>
              <input
                style={styles.input}
                type="email"
                placeholder="이메일"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>

            <div style={styles.formGrid1}>
              <input
                style={styles.input}
                type="password"
                placeholder="비밀번호"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>

            <div style={styles.actionRow}>
              <button
                type="button"
                style={styles.primaryBtn}
                onClick={handleLogin}
                disabled={loginBusy}
              >
                {loginBusy ? "로그인 중..." : "로그인"}
              </button>
            </div>

            <div style={styles.message}>{msg}</div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <section style={styles.topCard}>
          <div>
            <h1 style={styles.title}>Travel Notebook</h1>
            <div style={styles.sub}>{email}</div>
          </div>

          <div style={styles.topButtons}>
            <button style={styles.outlineBtn} onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}>Road Trip 기록</div>

          <div style={styles.mapBtnRow}>
            <a
              href={map1Url}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.smallMapBtn}
            >
              🗺 Road Trip Map 1
            </a>

            <a
              href={map2Url}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.smallMapBtn}
            >
              🗺 Road Trip Map 2
            </a>

            <a
              href={map3Url}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.smallMapBtn}
            >
              🗺 Road Trip Map 3
            </a>
          </div>

          <div style={styles.formGrid1}>
            <input
              style={styles.input}
              value={form.trip}
              onChange={(e) => updateField("trip", e.target.value)}
              placeholder="2026 Spring Road Trip"
            />
          </div>

          <div style={styles.formGrid2}>
            <input
              style={styles.input}
              type="date"
              value={form.date}
              onChange={(e) => updateField("date", e.target.value)}
            />
            <input
              style={styles.input}
              value={form.location}
              onChange={(e) => updateField("location", e.target.value)}
              placeholder="Location (예: Zion National Park)"
            />
          </div>

          <div style={styles.formGrid1}>
            <input
              style={styles.input}
              value={form.campground}
              onChange={(e) => updateField("campground", e.target.value)}
              placeholder="Campground (예: Watchman CG)"
            />
          </div>

          <div style={styles.formGrid1}>
            <input
              style={styles.input}
              value={form.site}
              onChange={(e) => updateField("site", e.target.value)}
              placeholder="Site Number (예: B32)"
            />
          </div>

          <div style={styles.formGrid1}>
            <input
              style={styles.input}
              value={form.water}
              onChange={(e) => updateField("water", e.target.value)}
              placeholder="Water (예: Yes / No)"
            />
          </div>

          <div style={styles.formGrid1}>
            <input
              style={styles.input}
              value={form.bathroom}
              onChange={(e) => updateField("bathroom", e.target.value)}
              placeholder="Bathroom (예: Good / OK / Bad)"
            />
          </div>

          <div style={styles.formGrid1}>
            <input
              style={styles.input}
              value={form.noise}
              onChange={(e) => updateField("noise", e.target.value)}
              placeholder="Noise (예: Quiet / Medium / Loud)"
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={styles.label}>Rating</div>
            <select
              style={styles.input}
              value={form.rating}
              onChange={(e) => updateField("rating", e.target.value)}
            >
              <option value="">선택 안함</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>

          <div style={{ marginTop: 12 }}>
            <textarea
              style={styles.textarea}
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Notes"
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={styles.label}>Photos / Files</div>

            <div style={styles.uploadRow}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={onChooseFiles}
                style={{ display: "none" }}
              />
              <button
                type="button"
                style={styles.fileBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                📁 Choose Files
              </button>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={onChooseFiles}
                style={{ display: "none" }}
              />
              <button
                type="button"
                style={styles.fileBtn}
                onClick={() => cameraInputRef.current?.click()}
              >
                📷 Take Photo
              </button>
            </div>

            {!!selectedFiles.length && (
              <div style={styles.selectedBox}>
                {selectedFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} style={styles.selectedItem}>
                    <span style={{ wordBreak: "break-all" }}>
                      {file.name} ({Math.round(file.size / 1024)} KB)
                    </span>
                    <button
                      type="button"
                      style={styles.removeBtn}
                      onClick={() => removeSelectedFile(idx)}
                    >
                      제거
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.actionRow}>
            <button
              type="button"
              style={styles.primaryBtn}
              onClick={handleSave}
              disabled={busy}
            >
              {busy ? "Saving..." : editingId ? "Update" : "Save"}
            </button>

            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={clearForm}
            >
              Clear
            </button>
          </div>

          <div style={styles.message}>
            {editingId ? `수정 모드: ${msg}` : msg}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}>Saved Entries</div>

          {!entries.length ? (
            <div style={{ color: "#6b7280" }}>아직 기록이 없습니다.</div>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {entries.map((row) => (
                <div key={row.id} style={styles.entryCard}>
                  <div>Trip: {row.trip || ""}</div>
                  <div>Date: {row.date || ""}</div>
                  <div>Location: {row.location || ""}</div>

                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      style={styles.smallActionBtn}
                      onClick={() => driveToLocation(row.location)}
                    >
                      🚗 Drive to This Location
                    </button>
                  </div>

                  <div style={{ marginTop: 10 }}>Campground: {row.campground || ""}</div>
                  <div>Site: {row.site || ""}</div>
                  <div>Water: {row.water || ""}</div>
                  <div>Bathroom: {row.bathroom || ""}</div>
                  <div>Noise: {row.noise || ""}</div>
                  <div>Rating: {row.rating ?? ""}</div>
                  <div>Notes: {row.notes || ""}</div>

                  {!!row.photo_urls?.length && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>
                        Attachments:
                      </div>
                      <div style={styles.attachmentsGrid}>
                        {row.photo_urls.map((url, idx) => (
                          <div key={`${row.id}-${idx}`} style={styles.attachmentItem}>
                            {isImageUrl(url) ? (
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={url}
                                  alt={`upload-${idx}`}
                                  style={styles.thumb}
                                />
                              </a>
                            ) : (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={styles.fileLink}
                              >
                                📎 {fileNameFromUrl(url)}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <button
                      style={styles.smallActionBtn}
                      onClick={() => handleEdit(row)}
                    >
                      Edit
                    </button>
                    <button
                      style={styles.smallActionBtn}
                      onClick={() => handleDelete(row.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8f6f1",
    padding: "24px 14px 40px",
    color: "#111827",
    fontFamily:
      "Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  wrap: {
    maxWidth: 1100,
    margin: "0 auto",
  },
  topCard: {
    background: "#fffaf3",
    border: "1px solid #eadfce",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
  },
  title: {
    fontSize: 34,
    lineHeight: 1.1,
    margin: 0,
    fontWeight: 800,
  },
  sub: {
    marginTop: 6,
    color: "#6b7280",
    fontSize: 16,
  },
  topButtons: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  outlineBtn: {
    padding: "12px 18px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 16,
  },
  card: {
    background: "#fffaf3",
    border: "1px solid #eadfce",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 800,
    marginBottom: 14,
  },
  mapBtnRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  smallMapBtn: {
    display: "inline-block",
    padding: "10px 14px",
    border: "1px solid #b9b1a3",
    borderRadius: 10,
    background: "#fff",
    color: "#111827",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },
  formGrid1: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
    marginTop: 12,
  },
  formGrid2: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
    marginTop: 12,
  },
  input: {
    width: "100%",
    border: "1px solid #d6d3d1",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 16,
    background: "#fff",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    minHeight: 130,
    border: "1px solid #d6d3d1",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 16,
    background: "#fff",
    boxSizing: "border-box",
    resize: "vertical",
  },
  label: {
    fontWeight: 700,
    marginBottom: 8,
    fontSize: 16,
  },
  uploadRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  fileBtn: {
    padding: "10px 14px",
    border: "1px solid #cfcfcf",
    borderRadius: 10,
    background: "#fff",
    cursor: "pointer",
    fontSize: 15,
  },
  selectedBox: {
    marginTop: 10,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 10,
    background: "#fff",
  },
  selectedItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "6px 0",
    borderBottom: "1px solid #f1f5f9",
  },
  removeBtn: {
    border: "1px solid #d1d5db",
    borderRadius: 8,
    background: "#fff",
    padding: "4px 8px",
    cursor: "pointer",
    flexShrink: 0,
  },
  actionRow: {
    marginTop: 14,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    background: "#2563eb",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
  },
  secondaryBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    background: "#fff",
    color: "#111827",
    border: "1px solid #d1d5db",
    cursor: "pointer",
    fontWeight: 700,
  },
  message: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    color: "#475569",
    fontSize: 14,
  },
  entryCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 14,
    background: "#fff",
    lineHeight: 1.55,
  },
  attachmentsGrid: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  attachmentItem: {
    display: "flex",
    alignItems: "center",
  },
  thumb: {
    width: 110,
    height: 110,
    objectFit: "cover",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    display: "block",
  },
  fileLink: {
    display: "inline-block",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "10px 12px",
    background: "#f9fafb",
    textDecoration: "none",
    color: "#111827",
  },
  smallActionBtn: {
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer",
  },
};