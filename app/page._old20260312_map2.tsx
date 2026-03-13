"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type EntryRow = {
  id: string;
  user_id: string;
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

const TABLE = "travel_entries";
const BUCKET = "travel-photos";

function todayYMD() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function emptyForm(): FormState {
  return {
    trip: "",
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

function uniqueFileName(userId: string, file: File) {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const safeExt = (ext || "jpg").toLowerCase();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${userId}/${Date.now()}-${rand}.${safeExt}`;
}

function publicUrlOf(path: string) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export default function TravelPage() {
  const [sessionEmail, setSessionEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session?.user) {
        setUserId(session.user.id);
        setSessionEmail(session.user.email || "");
        await loadEntries(session.user.id);
      }

      setLoading(false);
    }

    boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (session?.user) {
        setUserId(session.user.id);
        setSessionEmail(session.user.email || "");
        await loadEntries(session.user.id);
      } else {
        setUserId("");
        setSessionEmail("");
        setEntries([]);
        setEditingId(null);
        setPhotoUrls([]);
        setForm(emptyForm());
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadEntries(uid: string) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("user_id", uid)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMessage(`불러오기 오류: ${error.message}`);
      return;
    }

    setEntries((data || []) as EntryRow[]);
  }

  const recentEntries = useMemo(() => entries.slice(0, 30), [entries]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    setMessage("");

    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("회원가입 요청 완료. 이메일 확인이 필요할 수 있습니다.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage("로그인되었습니다.");
      }
    } catch (err: any) {
      setMessage(err?.message || "인증 중 오류가 났습니다.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(`로그아웃 오류: ${error.message}`);
      return;
    }
    setMessage("로그아웃되었습니다.");
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function openCameraPicker() {
    cameraInputRef.current?.click();
  }

  async function handlePhotoFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!userId) {
      setMessage("먼저 로그인해주세요.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      const urls: string[] = [];

      for (const file of Array.from(files)) {
        const path = uniqueFileName(userId, file);
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

        if (error) throw error;
        urls.push(publicUrlOf(path));
      }

      setPhotoUrls((prev) => [...prev, ...urls]);
      setMessage(`${urls.length}개 사진 업로드 완료`);
    } catch (err: any) {
      console.error(err);
      setMessage(err?.message || "사진 업로드 중 오류가 났습니다.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function removePhoto(url: string) {
    setPhotoUrls((prev) => prev.filter((x) => x !== url));
  }

  function startNew() {
    setEditingId(null);
    setForm(emptyForm());
    setPhotoUrls([]);
    setMessage("새 기록 입력 모드");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(row: EntryRow) {
    setEditingId(row.id);
    setForm({
      trip: row.trip || "",
      date: row.date || todayYMD(),
      location: row.location || "",
      campground: row.campground || "",
      site: row.site || "",
      water: row.water || "",
      bathroom: row.bathroom || "",
      noise: row.noise || "",
      rating: row.rating == null ? "" : String(row.rating),
      notes: row.notes || "",
    });
    setPhotoUrls(row.photo_urls || []);
    setMessage("수정 모드");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      setMessage("먼저 로그인해주세요.");
      return;
    }

    setSaving(true);
    setMessage("");

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
      rating: form.rating === "" ? null : Number(form.rating),
      notes: form.notes || null,
      photo_urls: photoUrls.length ? photoUrls : null,
    };

    try {
      if (editingId) {
        const { error } = await supabase.from(TABLE).update(payload).eq("id", editingId);
        if (error) throw error;
        setMessage("수정 저장 완료");
      } else {
        const { error } = await supabase.from(TABLE).insert(payload);
        if (error) throw error;
        setMessage("새 기록 저장 완료");
      }

      await loadEntries(userId);
      setEditingId(null);
      setForm(emptyForm());
      setPhotoUrls([]);
    } catch (err: any) {
      console.error(err);
      setMessage(err?.message || "저장 중 오류가 났습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    const ok = window.confirm("이 기록을 삭제할까요?");
    if (!ok) return;

    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) {
      setMessage(`삭제 오류: ${error.message}`);
      return;
    }

    setEntries((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyForm());
      setPhotoUrls([]);
    }
    setMessage("삭제 완료");
  }

  if (loading) {
    return <main style={styles.wrap}><div style={styles.card}>불러오는 중...</div></main>;
  }

  if (!userId) {
    return (
      <main style={styles.wrap}>
        <div style={styles.card}>
          <h1 style={styles.title}>Road Trip Notebook</h1>
          <p style={styles.sub}>로그인 후 여행 기록과 사진을 저장할 수 있습니다.</p>

          <form onSubmit={handleAuth} style={styles.form}>
            <div>
              <label style={styles.label}>Email</label>
              <input
                style={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                required
              />
            </div>

            <div style={styles.rowGap}>
              <button type="submit" style={styles.primaryBtn} disabled={authBusy}>
                {authBusy ? "처리중..." : authMode === "login" ? "로그인" : "회원가입"}
              </button>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => setAuthMode((m) => (m === "login" ? "signup" : "login"))}
              >
                {authMode === "login" ? "회원가입으로" : "로그인으로"}
              </button>
            </div>
          </form>

          {message && <div style={styles.message}>{message}</div>}
        </div>
      </main>
    );
  }

  return (
    <main style={styles.wrap}>
      <div style={styles.headerCard}>
        <div>
          <h1 style={styles.title}>Road Trip Notebook</h1>
          <div style={styles.email}>{sessionEmail}</div>
        </div>
        <div style={styles.rowGap}>
          <button type="button" onClick={startNew} style={styles.secondaryBtn}>새 기록</button>
          <button type="button" onClick={handleLogout} style={styles.secondaryBtn}>로그아웃</button>
        </div>
      </div>

      <form onSubmit={saveEntry} style={styles.card}>
        <h2 style={styles.sectionTitle}>{editingId ? "기록 수정" : "새 여행 기록"}</h2>

        <div style={styles.grid2}>
          <div>
            <label style={styles.label}>Trip</label>
            <input style={styles.input} value={form.trip} onChange={(e) => updateField("trip", e.target.value)} />
          </div>
          <div>
            <label style={styles.label}>Date</label>
            <input style={styles.input} type="date" value={form.date} onChange={(e) => updateField("date", e.target.value)} required />
          </div>
          <div>
            <label style={styles.label}>Location</label>
            <input style={styles.input} value={form.location} onChange={(e) => updateField("location", e.target.value)} />
          </div>
          <div>
            <label style={styles.label}>Campground</label>
            <input style={styles.input} value={form.campground} onChange={(e) => updateField("campground", e.target.value)} />
          </div>
          <div>
            <label style={styles.label}>Site</label>
            <input style={styles.input} value={form.site} onChange={(e) => updateField("site", e.target.value)} />
          </div>
          <div>
            <label style={styles.label}>Rating (1-5)</label>
            <input style={styles.input} type="number" min="1" max="5" value={form.rating} onChange={(e) => updateField("rating", e.target.value)} />
          </div>
          <div>
            <label style={styles.label}>Water</label>
            <input style={styles.input} value={form.water} onChange={(e) => updateField("water", e.target.value)} />
          </div>
          <div>
            <label style={styles.label}>Bathroom</label>
            <input style={styles.input} value={form.bathroom} onChange={(e) => updateField("bathroom", e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={styles.label}>Noise</label>
            <input style={styles.input} value={form.noise} onChange={(e) => updateField("noise", e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={styles.label}>Notes</label>
            <textarea style={styles.textarea} value={form.notes} onChange={(e) => updateField("notes", e.target.value)} rows={4} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={styles.label}>Photos</div>

          <div style={styles.rowGapWrap}>
            <label htmlFor="trip-file-input" style={styles.secondaryBtnLabel}>
              Choose File
            </label>
            <label htmlFor="trip-camera-input" style={styles.secondaryBtnLabel}>
              Take Photo
            </label>
            {uploading && <span style={styles.smallText}>Uploading...</span>}
          </div>

          <input
            id="trip-file-input"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoFiles}
            style={styles.hiddenInput}
          />

          <input
            id="trip-camera-input"
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoFiles}
            style={styles.hiddenInput}
          />

          {photoUrls.length > 0 && (
            <div style={styles.photoGrid}>
              {photoUrls.map((url) => (
                <div key={url} style={styles.photoCard}>
                  <img src={url} alt="trip" style={styles.photo} />
                  <button type="button" style={styles.removeBtn} onClick={() => removePhoto(url)}>
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <button type="submit" disabled={saving || uploading} style={styles.primaryBtn}>
            {saving ? "저장중..." : editingId ? "수정 저장" : "저장"}
          </button>
        </div>

        {message && <div style={styles.message}>{message}</div>}
      </form>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>최근 기록</h2>
        {recentEntries.length === 0 ? (
          <div style={styles.smallText}>아직 기록이 없습니다.</div>
        ) : (
          <div style={styles.listWrap}>
            {recentEntries.map((row) => (
              <div key={row.id} style={styles.entryCard}>
                <div style={styles.entryTop}>
                  <div>
                    <div style={styles.entryTitle}>{row.date} · {row.location || "(no location)"}</div>
                    <div style={styles.smallText}>
                      {row.campground || ""}
                      {row.site ? ` · Site ${row.site}` : ""}
                      {row.rating != null ? ` · ★${row.rating}` : ""}
                    </div>
                  </div>
                  <div style={styles.rowGapWrap}>
                    <button type="button" style={styles.secondaryBtnMini} onClick={() => startEdit(row)}>수정</button>
                    <button type="button" style={styles.deleteBtnMini} onClick={() => deleteEntry(row.id)}>삭제</button>
                  </div>
                </div>

                {(row.notes || row.water || row.bathroom || row.noise) && (
                  <div style={styles.entryBody}>
                    {row.notes && <div style={{ marginBottom: 6 }}>{row.notes}</div>}
                    <div style={styles.smallText}>
                      {row.water ? `Water: ${row.water}  ` : ""}
                      {row.bathroom ? `Bathroom: ${row.bathroom}  ` : ""}
                      {row.noise ? `Noise: ${row.noise}` : ""}
                    </div>
                  </div>
                )}

                {row.photo_urls && row.photo_urls.length > 0 && (
                  <div style={styles.photoGrid}>
                    {row.photo_urls.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                        <img src={url} alt="trip" style={styles.photo} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 920,
    margin: "0 auto",
    padding: "16px 12px 40px",
    background: "#f6f8fb",
    minHeight: "100vh",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #dde3ea",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  },
  headerCard: {
    background: "#ffffff",
    border: "1px solid #dde3ea",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
  },
  sub: {
    color: "#536271",
    marginTop: 8,
    marginBottom: 16,
  },
  email: {
    color: "#536271",
    marginTop: 4,
    fontSize: 14,
  },
  sectionTitle: {
    margin: "0 0 12px 0",
    fontSize: 20,
    fontWeight: 700,
  },
  form: {
    display: "grid",
    gap: 12,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 16,
    background: "#fff",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 16,
    background: "#fff",
    boxSizing: "border-box",
    resize: "vertical",
  },
  primaryBtn: {
    border: "none",
    borderRadius: 10,
    padding: "11px 16px",
    background: "#2563eb",
    color: "white",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryBtn: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 14px",
    background: "white",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryBtnLabel: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 14px",
    background: "white",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    userSelect: "none",
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
  secondaryBtnMini: {
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "6px 10px",
    background: "white",
    fontSize: 13,
    cursor: "pointer",
  },
  deleteBtnMini: {
    border: "1px solid #fecaca",
    borderRadius: 8,
    padding: "6px 10px",
    background: "#fff1f2",
    color: "#b91c1c",
    fontSize: 13,
    cursor: "pointer",
  },
  removeBtn: {
    border: "1px solid #fecaca",
    borderRadius: 8,
    padding: "6px 10px",
    background: "#fff1f2",
    color: "#b91c1c",
    fontSize: 12,
    cursor: "pointer",
    marginTop: 6,
  },
  rowGap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  rowGapWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  message: {
    marginTop: 12,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
  },
  smallText: {
    color: "#64748b",
    fontSize: 14,
  },
  listWrap: {
    display: "grid",
    gap: 12,
  },
  entryCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
    background: "#fcfdff",
  },
  entryTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  entryTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
  },
  entryBody: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 1.45,
  },
  photoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: 10,
    marginTop: 12,
  },
  photoCard: {
    display: "flex",
    flexDirection: "column",
  },
  photo: {
    width: "100%",
    height: 120,
    objectFit: "cover",
    borderRadius: 12,
    border: "1px solid #dbe3eb",
    background: "#f8fafc",
  },
};
