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

/** =========================
 *  꼭 확인할 2줄
 *  ========================= */
const TABLE = "travel_entries";
const PHOTO_BUCKET = "travel-photos";
const DEFAULT_TRIP = "Spring 2026 West Road Trip";
const TRIP_STORAGE_KEY = "travel_v1_current_trip";

/** =========================
 *  Types
 *  ========================= */
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

type SessionLike = {
  user?: {
    id?: string;
    email?: string;
  } | null;
} | null;

/** =========================
 *  Helpers
 *  ========================= */
function localYMD(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyForm(): FormState {
  return {
    date: localYMD(),
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

function notEmpty(s: string) {
  return s.trim().length > 0;
}

function toNullable(v: string) {
  const t = v.trim();
  return t ? t : null;
}

function toNullableNumber(v: string) {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function makePhotoPath(userId: string, fileName: string) {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const safe = fileName.replace(/[^\w.\-]+/g, "_");
  return `${userId}/${stamp}_${rand}_${safe}`;
}

function fileToJpgName(name: string) {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base}.jpg`;
}

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    const canvas = document.createElement("canvas");

    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.onload = () => {
      img.src = String(reader.result || "");
    };

    img.onerror = () => reject(new Error("이미지 로드 실패"));
    img.onload = () => {
      const MAX = 1600;
      let w = img.width;
      let h = img.height;

      if (w > h && w > MAX) {
        h = Math.round((h * MAX) / w);
        w = MAX;
      } else if (h >= w && h > MAX) {
        w = Math.round((w * MAX) / h);
        h = MAX;
      }

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("캔버스 생성 실패"));
        return;
      }

      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("이미지 압축 실패"));
            return;
          }
          resolve(
            new File([blob], fileToJpgName(file.name), {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
          );
        },
        "image/jpeg",
        0.82
      );
    };

    reader.readAsDataURL(file);
  });
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function uploadOnePhoto(
  userId: string,
  file: File
): Promise<{ path: string; publicUrl: string }> {
  const path = makePhotoPath(userId, file.name);

  const uploadPromise = supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

  const { error } = await withTimeout(
    uploadPromise,
    120000,
    "업로드 시간 초과 (upload timeout)"
  );

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  if (!publicUrl) {
    throw new Error("사진 URL 생성 실패");
  }

  return { path, publicUrl };
}

/** =========================
 *  Component
 *  ========================= */
export default function TravelPage() {
  /** auth */
  const [session, setSession] = useState<SessionLike>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  /** data */
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  /** trip */
  const [currentTrip, setCurrentTrip] = useState(DEFAULT_TRIP);
  const [showTripList, setShowTripList] = useState(false);

  /** form */
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);

  /** photos */
  const choosePhotosRef = useRef<HTMLInputElement | null>(null);
  const takePhotoRef = useRef<HTMLInputElement | null>(null);

  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([]);

  /** ui */
  const [saving, setSaving] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /** =========================
   *  derived: trips
   *  ========================= */
  const tripList = useMemo(() => {
    const set = new Set<string>();

    rows.forEach((row) => {
      const trip = row.trip?.trim();
      if (trip) set.add(trip);
    });

    if (currentTrip.trim()) {
      set.add(currentTrip.trim());
    }

    if (DEFAULT_TRIP.trim()) {
      set.add(DEFAULT_TRIP.trim());
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows, currentTrip]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => (row.trip?.trim() || "") === currentTrip.trim());
  }, [rows, currentTrip]);

  const currentTripPhotoCount = useMemo(
    () =>
      filteredRows.reduce((sum, row) => sum + (row.photo_urls?.length ?? 0), 0),
    [filteredRows]
  );

  const totalPhotoCount = useMemo(
    () => existingPhotoUrls.length + newPhotos.length,
    [existingPhotoUrls.length, newPhotos.length]
  );

  /** =========================
   *  auth init
   *  ========================= */
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          const msg = String(error.message || "");
          if (
            msg.includes("Lock broken by another request") ||
            error.name === "AbortError"
          ) {
            setCheckingAuth(false);
            return;
          }
          console.error(error);
        }

        setSession((data?.session as SessionLike) ?? null);
        setCheckingAuth(false);
      } catch (err: any) {
        if (!mounted) return;

        const msg = String(err?.message || "");
        if (msg.includes("Lock broken by another request") || err?.name === "AbortError") {
          setCheckingAuth(false);
          return;
        }

        console.error(err);
        setCheckingAuth(false);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession((newSession as SessionLike) ?? null);
      setCheckingAuth(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /** =========================
   *  trip restore
   *  ========================= */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTrip = localStorage.getItem(TRIP_STORAGE_KEY)?.trim();
    if (savedTrip) {
      setCurrentTrip(savedTrip);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(TRIP_STORAGE_KEY, currentTrip);
  }, [currentTrip]);

  /** =========================
   *  rows load
   *  ========================= */
  async function loadRows() {
    const userId = session?.user?.id;
    if (!userId) return;

    setLoadingRows(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRows((data || []) as EntryRow[]);
    } catch (err: any) {
      console.error(err);

      const msg = String(err?.message || "");

      if (msg.includes("Lock broken by another request")) {
        return;
      }

      if (err?.name === "AbortError") {
        return;
      }

      setMessage(`불러오기 오류: ${msg || "알 수 없는 오류"}`);
    } finally {
      setLoadingRows(false);
    }
  }

  useEffect(() => {
    if (session?.user?.id) {
      loadRows();
    } else {
      setRows([]);
    }
  }, [session?.user?.id]);

  /** =========================
   *  keep currentTrip valid
   *  ========================= */
  useEffect(() => {
    if (!tripList.length) return;

    const exists = tripList.includes(currentTrip);
    if (!exists) {
      setCurrentTrip(tripList[0]);
    }
  }, [tripList, currentTrip]);

  /** =========================
   *  preview urls for pending files
   *  ========================= */
  useEffect(() => {
    const urls = newPhotos.map((f) => URL.createObjectURL(f));
    setNewPhotoPreviews(urls);

    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [newPhotos]);

  /** =========================
   *  form handlers
   *  ========================= */
  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetAll() {
    setEditingId(null);
    setForm(emptyForm());
    setExistingPhotoUrls([]);
    setNewPhotos([]);
    setUploadProgress("");
    setMessage("");
    if (choosePhotosRef.current) choosePhotosRef.current.value = "";
    if (takePhotoRef.current) takePhotoRef.current.value = "";
  }

  function startEdit(row: EntryRow) {
    setEditingId(row.id);

    const rowTrip = row.trip?.trim() || currentTrip;
    setCurrentTrip(rowTrip);

    setForm({
      date: row.date || localYMD(),
      location: row.location || "",
      campground: row.campground || "",
      site: row.site || "",
      water: row.water || "",
      bathroom: row.bathroom || "",
      noise: row.noise || "",
      rating: row.rating == null ? "" : String(row.rating),
      notes: row.notes || "",
    });
    setExistingPhotoUrls(row.photo_urls || []);
    setNewPhotos([]);
    setUploadProgress("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** =========================
   *  trip handlers
   *  ========================= */
  function handleCreateTrip() {
    const raw = window.prompt("새 trip 이름을 입력하세요.", "");
    const name = raw?.trim();

    if (!name) return;

    if (tripList.includes(name)) {
      setCurrentTrip(name);
      setShowTripList(false);
      setMessage(`이미 있는 trip입니다. 현재 trip을 "${name}"(으)로 바꿨습니다.`);
      return;
    }

    setCurrentTrip(name);
    setEditingId(null);
    setForm(emptyForm());
    setExistingPhotoUrls([]);
    setNewPhotos([]);
    setShowTripList(false);
    setMessage(`새 trip 준비 완료: ${name}`);
  }

  async function handleRenameTrip() {
    const oldTrip = currentTrip.trim();
    if (!oldTrip) return;

    const raw = window.prompt("새 trip 이름", oldTrip);
    const newTrip = raw?.trim();

    if (!newTrip || newTrip === oldTrip) return;

    const userId = session?.user?.id;
    if (!userId) return;

    try {
      const { error } = await supabase
        .from(TABLE)
        .update({ trip: newTrip })
        .eq("user_id", userId)
        .eq("trip", oldTrip);

      if (error) throw error;

      setRows((prev) =>
        prev.map((row) =>
          (row.trip?.trim() || "") === oldTrip ? { ...row, trip: newTrip } : row
        )
      );
      setCurrentTrip(newTrip);
      setMessage("Trip 이름 변경 완료");
    } catch (err: any) {
      console.error(err);
      setMessage(`Trip 이름 변경 오류: ${err?.message || "알 수 없는 오류"}`);
    }
  }

  async function handleDeleteTrip() {
    const tripToDelete = currentTrip.trim();
    const userId = session?.user?.id;

    if (!tripToDelete || !userId) return;

    const targetCount = rows.filter(
      (row) => (row.trip?.trim() || "") === tripToDelete
    ).length;

    const ok = window.confirm(
      `"${tripToDelete}" trip의 기록 ${targetCount}개를 모두 삭제할까요?`
    );
    if (!ok) return;

    try {
      const { error } = await supabase
        .from(TABLE)
        .delete()
        .eq("user_id", userId)
        .eq("trip", tripToDelete);

      if (error) throw error;

      const remainingRows = rows.filter(
        (row) => (row.trip?.trim() || "") !== tripToDelete
      );
      setRows(remainingRows);

      const remainingTrips = Array.from(
        new Set(
          remainingRows
            .map((row) => row.trip?.trim())
            .filter((trip): trip is string => Boolean(trip))
        )
      ).sort((a, b) => a.localeCompare(b));

      setCurrentTrip(remainingTrips[0] || DEFAULT_TRIP);
      resetAll();
      setShowTripList(false);
      setMessage("Trip 삭제 완료");
    } catch (err: any) {
      console.error(err);
      setMessage(`Trip 삭제 오류: ${err?.message || "알 수 없는 오류"}`);
    }
  }

  /** =========================
   *  photo pickers
   *  ========================= */
  async function handleChoosePhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setMessage("사진 압축 중...");

    try {
      const compressed: File[] = [];
      for (let i = 0; i < files.length; i += 1) {
        const c = await compressImage(files[i]);
        compressed.push(c);
      }
      setNewPhotos((prev) => [...prev, ...compressed]);
      setMessage(`${compressed.length}장 추가 완료`);
    } catch (err: any) {
      console.error(err);
      setMessage(`사진 준비 오류: ${err?.message || "알 수 없는 오류"}`);
    } finally {
      if (choosePhotosRef.current) choosePhotosRef.current.value = "";
    }
  }

  async function handleTakePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setMessage("촬영 사진 압축 중...");

    try {
      const compressed = await compressImage(file);
      setNewPhotos((prev) => [...prev, compressed]);
      setMessage("사진 1장 추가 완료");
    } catch (err: any) {
      console.error(err);
      setMessage(`사진 준비 오류: ${err?.message || "알 수 없는 오류"}`);
    } finally {
      if (takePhotoRef.current) takePhotoRef.current.value = "";
    }
  }

  function removePendingPhoto(index: number) {
    setNewPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function removeExistingPhoto(index: number) {
    setExistingPhotoUrls((prev) => prev.filter((_, i) => i !== index));
  }

  /** =========================
   *  auth handlers
   *  ========================= */
  async function handleLogin() {
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setMessage("이메일과 비밀번호를 입력해 주세요.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage(`로그인 실패: ${error.message}`);
      return;
    }

    setMessage("로그인되었습니다.");
  }

  async function handleLogout() {
    setLogoutBusy(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setSession(null);
      setRows([]);
      setPassword("");
      resetAll();
      setMessage("로그아웃 되었습니다.");
    } catch (err: any) {
      console.error(err);
      setMessage(`로그아웃 오류: ${err?.message || "알 수 없는 오류"}`);
    } finally {
      setLogoutBusy(false);
      setSaving(false);
      setUploadProgress("");
    }
  }

  /** =========================
   *  save / update
   *  ========================= */
  async function saveEntry() {
    const userId = session?.user?.id;
    if (!userId) {
      setMessage("로그인이 필요합니다.");
      return;
    }

    if (!notEmpty(currentTrip)) {
      setMessage("먼저 trip을 선택하거나 새로 만드세요.");
      return;
    }

    if (!notEmpty(form.date)) {
      setMessage("날짜를 입력하세요.");
      return;
    }

    setSaving(true);
    setMessage("");
    setUploadProgress("");

    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < newPhotos.length; i += 1) {
        const file = newPhotos[i];
        setUploadProgress(`사진 업로드 중 (${i + 1}/${newPhotos.length})`);
        const { publicUrl } = await uploadOnePhoto(userId, file);
        uploadedUrls.push(publicUrl);
      }

      const finalPhotoUrls = [...existingPhotoUrls, ...uploadedUrls];

      const payload = {
        user_id: userId,
        trip: currentTrip.trim(),
        date: form.date,
        location: toNullable(form.location),
        campground: toNullable(form.campground),
        site: toNullable(form.site),
        water: toNullable(form.water),
        bathroom: toNullable(form.bathroom),
        noise: toNullable(form.noise),
        rating: toNullableNumber(form.rating),
        notes: toNullable(form.notes),
        photo_urls: finalPhotoUrls,
      };

      if (editingId) {
        const { error } = await supabase
          .from(TABLE)
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        setMessage("수정 저장 완료");
      } else {
        const { error } = await supabase.from(TABLE).insert(payload);
        if (error) throw error;
        setMessage("저장 완료");
      }

      resetAll();
      await loadRows();
    } catch (err: any) {
      console.error(err);
      setMessage(`저장 오류: ${err?.message || "알 수 없는 오류"}`);
    } finally {
      setSaving(false);
      setUploadProgress("");
    }
  }

  /** =========================
   *  delete
   *  ========================= */
  async function deleteEntry(id: string) {
    const ok = window.confirm("이 기록을 삭제할까요?");
    if (!ok) return;

    setMessage("");

    try {
      const { error } = await supabase.from(TABLE).delete().eq("id", id);
      if (error) throw error;
      if (editingId === id) resetAll();
      await loadRows();
      setMessage("삭제 완료");
    } catch (err: any) {
      console.error(err);
      setMessage(`삭제 오류: ${err?.message || "알 수 없는 오류"}`);
    }
  }

  /** =========================
   *  styles
   *  ========================= */
  const page: CSSProperties = {
    maxWidth: 980,
    margin: "0 auto",
    padding: "16px 14px 80px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    color: "#111827",
    background: "#ffffff",
  };

  const card: CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    background: "#fff",
  };

  const row2: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  };

  const row3: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 10,
  };

  const label: CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
  };

  const input: CSSProperties = {
    width: "100%",
    minHeight: 42,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 16,
    outline: "none",
    boxSizing: "border-box",
  };

  const textarea: CSSProperties = {
    ...input,
    minHeight: 100,
    resize: "vertical",
  };

  const btn: CSSProperties = {
    minHeight: 42,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 15,
    fontWeight: 600,
    background: "#f9fafb",
    cursor: "pointer",
  };

  const primaryBtn: CSSProperties = {
    ...btn,
    background: "#111827",
    color: "#fff",
    border: "1px solid #111827",
  };

  const dangerBtn: CSSProperties = {
    ...btn,
    background: "#fff1f2",
    color: "#be123c",
    border: "1px solid #fecdd3",
  };

  const smallBtn: CSSProperties = {
    ...btn,
    minHeight: 34,
    padding: "6px 10px",
    fontSize: 13,
  };

  /** =========================
   *  render - auth checking
   *  ========================= */
  if (checkingAuth) {
    return (
      <div style={page}>
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Travel Notebook</h2>
          <div>불러오는 중...</div>
        </div>
      </div>
    );
  }

  /** =========================
   *  render - login
   *  ========================= */
  if (!session?.user?.id) {
    return (
      <div style={page}>
        <div style={card}>
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Travel Notebook</h2>
          <div style={{ color: "#6b7280", marginBottom: 14 }}>
            로그인 상태가 유지되면 다음부터는 아이콘을 눌렀을 때 바로 열립니다.
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            autoComplete="on"
          >
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Email</label>
              <input
                style={input}
                type="email"
                name="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={label}>Password</label>
              <input
                style={input}
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" style={primaryBtn}>
              로그인
            </button>
          </form>

          {!!message && (
            <div style={{ marginTop: 12, color: "#b91c1c", whiteSpace: "pre-wrap" }}>
              {message}
            </div>
          )}
        </div>
      </div>
    );
  }

  /** =========================
   *  render - main
   *  ========================= */
  return (
    <div style={page}>
      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Travel Notebook</h2>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
              {session.user?.email || ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              style={smallBtn}
              onClick={resetAll}
              disabled={saving}
              type="button"
            >
              Clear
            </button>
            <button
              style={dangerBtn}
              onClick={handleLogout}
              disabled={logoutBusy}
              type="button"
            >
              {logoutBusy ? "로그아웃 중..." : "로그아웃"}
            </button>
          </div>
        </div>

        {!!message && (
          <div
            style={{
              marginTop: 12,
              whiteSpace: "pre-wrap",
              color:
                message.includes("완료") ||
                message.includes("추가 완료") ||
                message.includes("로그인되었습니다.") ||
                message.includes("준비 완료")
                  ? "#065f46"
                  : "#b91c1c",
            }}
          >
            {message}
          </div>
        )}

        {!!uploadProgress && (
          <div style={{ marginTop: 8, color: "#1d4ed8", fontWeight: 600 }}>
            {uploadProgress}
          </div>
        )}
      </div>

      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Current Trip</h3>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{currentTrip}</div>
            <div style={{ color: "#6b7280", fontSize: 13, marginTop: 6 }}>
              Entries: {filteredRows.length} · Photos: {currentTripPhotoCount}
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                style={btn}
                onClick={() => setShowTripList((prev) => !prev)}
              >
                View Trips
              </button>
              <button type="button" style={btn} onClick={handleCreateTrip}>
                New Trip
              </button>
              <button type="button" style={btn} onClick={handleRenameTrip}>
                Rename Trip
              </button>
              <button type="button" style={dangerBtn} onClick={handleDeleteTrip}>
                Delete Trip
              </button>
            </div>

            {showTripList && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 8px)",
                  minWidth: 240,
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 8,
                  background: "#fff",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                  zIndex: 10,
                }}
              >
                {!tripList.length ? (
                  <div style={{ padding: 8, color: "#6b7280", fontSize: 14 }}>
                    No trips yet
                  </div>
                ) : (
                  tripList.map((trip) => (
                    <button
                      key={trip}
                      type="button"
                      onClick={() => {
                        setCurrentTrip(trip);
                        setShowTripList(false);
                        resetAll();
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "none",
                        background: trip === currentTrip ? "#f3f4f6" : "#fff",
                        fontSize: 14,
                        fontWeight: trip === currentTrip ? 700 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {trip}
                      {trip === currentTrip ? " ✓" : ""}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>{editingId ? "기록 수정" : "새 기록"}</h3>

        <div style={{ marginBottom: 12, color: "#374151", fontSize: 14 }}>
          Saving to trip: <span style={{ fontWeight: 700 }}>{currentTrip}</span>
        </div>

        <div style={row2}>
          <div>
            <label style={label}>Date</label>
            <input
              style={input}
              type="date"
              value={form.date}
              onChange={(e) => setField("date", e.target.value)}
            />
          </div>
          <div>
            <label style={label}>Location</label>
            <input
              style={input}
              value={form.location}
              onChange={(e) => setField("location", e.target.value)}
              placeholder="예: Zion NP"
            />
          </div>
        </div>

        <div style={{ height: 10 }} />

        <div style={row3}>
          <div>
            <label style={label}>Campground</label>
            <input
              style={input}
              value={form.campground}
              onChange={(e) => setField("campground", e.target.value)}
            />
          </div>
          <div>
            <label style={label}>Site</label>
            <input
              style={input}
              value={form.site}
              onChange={(e) => setField("site", e.target.value)}
            />
          </div>
          <div>
            <label style={label}>Rating (1~5)</label>
            <input
              style={input}
              type="number"
              min="1"
              max="5"
              step="1"
              value={form.rating}
              onChange={(e) => setField("rating", e.target.value)}
            />
          </div>
        </div>

        <div style={{ height: 10 }} />

        <div style={row3}>
          <div>
            <label style={label}>Water</label>
            <input
              style={input}
              value={form.water}
              onChange={(e) => setField("water", e.target.value)}
              placeholder="예: yes / no / nearby"
            />
          </div>
          <div>
            <label style={label}>Bathroom</label>
            <input
              style={input}
              value={form.bathroom}
              onChange={(e) => setField("bathroom", e.target.value)}
              placeholder="예: flush / vault"
            />
          </div>
          <div>
            <label style={label}>Noise</label>
            <input
              style={input}
              value={form.noise}
              onChange={(e) => setField("noise", e.target.value)}
              placeholder="예: quiet / road noise"
            />
          </div>
        </div>

        <div style={{ height: 10 }} />

        <div>
          <label style={label}>Notes</label>
          <textarea
            style={textarea}
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
            placeholder="기억할 점, 후기, 팁"
          />
        </div>

        <div style={{ height: 14 }} />

        <div>
          <div style={{ ...label, marginBottom: 8 }}>
            Photos ({totalPhotoCount})
          </div>

          <input
            ref={choosePhotosRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleChoosePhotos}
            style={{ display: "none" }}
          />

          <input
            ref={takePhotoRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleTakePhoto}
            style={{ display: "none" }}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button
              type="button"
              style={btn}
              onClick={() => choosePhotosRef.current?.click()}
              disabled={saving}
            >
              Choose Photos
            </button>

            <button
              type="button"
              style={btn}
              onClick={() => takePhotoRef.current?.click()}
              disabled={saving}
            >
              Take Photo
            </button>
          </div>

          {!!existingPhotoUrls.length && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                기존 사진
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                  gap: 10,
                }}
              >
                {existingPhotoUrls.map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 8 }}
                  >
                    <img
                      src={url}
                      alt={`existing-${i}`}
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        objectFit: "cover",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                      onClick={() => setPreviewUrl(url)}
                    />
                    <button
                      type="button"
                      style={{ ...smallBtn, marginTop: 8, width: "100%" }}
                      onClick={() => removeExistingPhoto(i)}
                    >
                      제거
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!newPhotoPreviews.length && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                새로 추가할 사진
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                  gap: 10,
                }}
              >
                {newPhotoPreviews.map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 8 }}
                  >
                    <img
                      src={url}
                      alt={`new-${i}`}
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        objectFit: "cover",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                      onClick={() => setPreviewUrl(url)}
                    />
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        color: "#6b7280",
                        wordBreak: "break-all",
                      }}
                    >
                      {newPhotos[i]?.name}
                    </div>
                    <button
                      type="button"
                      style={{ ...smallBtn, marginTop: 8, width: "100%" }}
                      onClick={() => removePendingPhoto(i)}
                    >
                      제거
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            style={primaryBtn}
            onClick={saveEntry}
            disabled={saving}
          >
            {saving
              ? editingId
                ? "수정 저장중..."
                : "저장중..."
              : editingId
              ? "Update"
              : "Save"}
          </button>

          <button type="button" style={btn} onClick={resetAll} disabled={saving}>
            Clear
          </button>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>
          Recent Entries {loadingRows ? "(불러오는 중...)" : `(${filteredRows.length})`}
        </h3>

        {!filteredRows.length ? (
          <div style={{ color: "#6b7280" }}>이 trip에는 아직 기록이 없습니다.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {filteredRows.map((row) => (
              <div
                key={row.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  padding: 12,
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                      {row.date} {row.location ? `· ${row.location}` : ""}
                    </div>
                    <div style={{ marginTop: 4, color: "#6b7280", fontSize: 13 }}>
                      {row.trip || ""} {row.campground ? `· ${row.campground}` : ""}
                      {row.site ? ` · Site ${row.site}` : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" style={smallBtn} onClick={() => startEdit(row)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      style={{
                        ...smallBtn,
                        background: "#fff1f2",
                        color: "#be123c",
                        border: "1px solid #fecdd3",
                      }}
                      onClick={() => deleteEntry(row.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {(row.water || row.bathroom || row.noise || row.rating != null) && (
                  <div style={{ marginTop: 8, color: "#374151", fontSize: 14 }}>
                    {row.water ? `Water: ${row.water}  ` : ""}
                    {row.bathroom ? `Bathroom: ${row.bathroom}  ` : ""}
                    {row.noise ? `Noise: ${row.noise}  ` : ""}
                    {row.rating != null ? `Rating: ${row.rating}` : ""}
                  </div>
                )}

                {row.notes && (
                  <div style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                    {row.notes}
                  </div>
                )}

                {!!row.photo_urls?.length && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
                      gap: 8,
                      marginTop: 12,
                    }}
                  >
                    {row.photo_urls.map((url, idx) => (
                      <img
                        key={`${url}-${idx}`}
                        src={url}
                        alt={`row-${idx}`}
                        style={{
                          width: "100%",
                          aspectRatio: "1 / 1",
                          objectFit: "cover",
                          borderRadius: 10,
                          border: "1px solid #e5e7eb",
                          cursor: "pointer",
                        }}
                        onClick={() => setPreviewUrl(url)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <img
            src={previewUrl}
            alt="preview"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              borderRadius: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            }}
          />
        </div>
      )}
    </div>
  );
}