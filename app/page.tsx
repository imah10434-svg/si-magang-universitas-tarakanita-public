"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  FileText,
  LayoutDashboard,
  Menu,
  PenLine,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";

type NavKey = "overview" | "daily" | "weekly" | "signatures";
type LogStatus = "Selesai" | "Proses" | "Tertunda";
type SignatureRole = "supervisor" | "dosen";

type Log = {
  id: string;
  date: string;
  title: string;
  description: string;
  hours: number;
  category: string;
  status: LogStatus;
};

type Signature = {
  role: SignatureRole;
  name: string;
  title: string;
  signedAt?: string;
  signatureData?: string;
};

type DocumentSigner = {
  role: SignatureRole;
  name: string;
  signedAt: string;
};

type SignedDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  status: "uploaded" | "signed";
  signatures: DocumentSigner[];
  hasSignedData: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type Profile = {
  email: string;
  name: string;
  major: string;
  studyProgram: string;
  nim: string;
  semester: number;
  cohort: string;
};

type UserRole = "Mahasiswa" | "Dosen Pembimbing" | "Supervisor Kantor" | "Koordinator/Admin";

type DirectoryUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  major?: string;
  studyProgram?: string;
  nim?: string;
  semester?: number;
  cohort?: string;
  organization?: string;
  createdAt?: string;
};

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  major: string;
  studyProgram: string;
  nim: string;
  semester: number | null;
  cohort: string;
  organization: string;
  internId: string | null;
  company: string;
  supervisorName: string;
  lecturerName: string;
  startDate: string | null;
  endDate: string | null;
};

const initialProfile: Profile = {
  email: "",
  name: "Nadya Kirana Putri",
  major: "Fakultas Teknik dan Informatika",
  studyProgram: "Sistem Informasi",
  nim: "2022010123",
  semester: 7,
  cohort: "2022",
};

const emptyProfile: Profile = {
  email: "",
  name: "",
  major: "",
  studyProgram: "",
  nim: "",
  semester: 1,
  cohort: "",
};

type ProfileData = { email?: string | null; name?: string | null; major?: string | null; studyProgram?: string | null; nim?: string | null; semester?: number | null; cohort?: string | null };

const normalizeProfile = (data: ProfileData | null | undefined, fallback = initialProfile): Profile => ({
  email: String(data?.email ?? fallback.email),
  name: String(data?.name ?? fallback.name),
  major: String(data?.major ?? fallback.major),
  studyProgram: String(data?.studyProgram ?? fallback.studyProgram),
  nim: String(data?.nim ?? fallback.nim),
  semester: Number(data?.semester ?? fallback.semester ?? 1),
  cohort: String(data?.cohort ?? fallback.cohort),
});

const navItems: { key: NavKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Ringkasan", icon: LayoutDashboard },
  { key: "daily", label: "Tracking Harian", icon: CalendarDays },
  { key: "weekly", label: "Review Mingguan", icon: BarChart3 },
  { key: "signatures", label: "Tanda Tangan", icon: PenLine },
];

const initialLogs: Log[] = [
  {
    id: "log-1",
    date: "2026-08-12",
    title: "Meninjau alur kerja operasional",
    description: "Mempelajari SOP dan alur approval dokumen internal bersama supervisor.",
    hours: 7,
    category: "Administrasi",
    status: "Selesai",
  },
  {
    id: "log-2",
    date: "2026-08-11",
    title: "Input data inventaris",
    description: "Memutakhirkan data inventaris perangkat ke dashboard monitoring kantor.",
    hours: 7,
    category: "Data",
    status: "Selesai",
  },
  {
    id: "log-3",
    date: "2026-08-10",
    title: "Onboarding tim produk",
    description: "Mengikuti briefing mingguan dan memahami target sprint produk Agustus.",
    hours: 6,
    category: "Orientasi",
    status: "Selesai",
  },
  {
    id: "log-4",
    date: "2026-08-09",
    title: "Merapikan template laporan",
    description: "Menyusun format laporan harian agar lebih mudah direview oleh tim.",
    hours: 7,
    category: "Dokumentasi",
    status: "Proses",
  },
];

const initialSignatures: Signature[] = [
  {
    role: "supervisor",
    name: "Raka Pratama, S.Kom.",
    title: "Supervisor Magang · PT Solusi Digital Nusantara",
  },
  {
    role: "dosen",
    name: "Dr. Maria Lestari, M.Kom.",
    title: "Dosen Pembimbing · Universitas Tarakanita",
  },
];

const weeklyData = [
  { week: "Minggu 1", range: "01–07 Agu", progress: 86, tone: "yellow" },
  { week: "Minggu 2", range: "08–14 Agu", progress: 74, tone: "sage" },
  { week: "Minggu 3", range: "15–21 Agu", progress: 48, tone: "blue" },
  { week: "Minggu 4", range: "22–31 Agu", progress: 22, tone: "lavender" },
];

const parseDate = (value: string) => {
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (date: string) => {
  const parsed = parseDate(date);
  return parsed
    ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(parsed)
    : date;
};

const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

const downloadProfileSpreadsheet = (profile: Profile) => {
  const rows = [
    ["Email", "Nama", "Jurusan", "Program Studi", "NIM", "Semester", "Angkatan"],
    [profile.email, profile.name, profile.major, profile.studyProgram, profile.nim, profile.semester, profile.cohort],
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `profil-magang-${profile.nim || "pengguna"}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const downloadUsersSpreadsheet = (users: DirectoryUser[]) => {
  const rows = [
    ["Email Gmail", "Nama", "Peran", "Jurusan", "Program Studi", "NIM", "Semester", "Angkatan", "Instansi/Unit"],
    ...users.map((user) => [user.email, user.name, user.role, user.major ?? "", user.studyProgram ?? "", user.nim ?? "", user.semester ?? "", user.cohort ?? "", user.organization ?? ""]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "daftar-pengguna-si-magang.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

function Badge({ status }: { status: LogStatus }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{status}</span>;
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<UserRole>("Mahasiswa");
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "", name: "", major: "", studyProgram: "", nim: "", semester: "", cohort: "", organization: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isStudent = role === "Mahasiswa";
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (mode === "register" && form.password !== form.confirmPassword) {
      setError("Konfirmasi password belum sama.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "login" ? { email: form.email, password: form.password } : {
          email: form.email,
          password: form.password,
          name: form.name,
          role,
          major: form.major,
          studyProgram: form.studyProgram,
          nim: form.nim,
          semester: form.semester,
          cohort: form.cohort,
          organization: form.organization,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(String(data.error ?? "Permintaan tidak dapat diproses."));
        return;
      }
      onAuthenticated(data.user as AuthUser);
    } catch {
      setError("Tidak dapat terhubung ke server. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand"><div className="brand-mark"><Sparkles size={20} strokeWidth={2.5} /></div><div><p className="brand-name">SI MAGANG</p><p className="brand-campus">UNIVERSITAS TARAKANITA</p></div></div>
        <div className="auth-intro"><p className="eyebrow">Workspace magang pribadi</p><h1>{mode === "login" ? "Masuk ke akunmu" : "Buat akun pengguna"}</h1><p>{mode === "login" ? "Kelola tracking harian, review mingguan, dan TTD secara aman." : "Daftar sekali dengan Gmail dan password, lalu langsung masuk ke dashboard akunmu."}</p></div>
        <div className="auth-tabs"><button type="button" className={mode === "login" ? "auth-tab active" : "auth-tab"} onClick={() => { setMode("login"); setError(""); }}>Masuk</button><button type="button" className={mode === "register" ? "auth-tab active" : "auth-tab"} onClick={() => { setMode("register"); setError(""); }}>Daftar</button></div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && <>
            <label className="field-label" htmlFor="auth-role">Peran pengguna</label>
            <select id="auth-role" className="text-input" value={role} onChange={(event) => setRole(event.target.value as UserRole)}><option>Mahasiswa</option><option>Dosen Pembimbing</option><option>Supervisor Kantor</option><option>Koordinator/Admin</option></select>
            <label className="field-label" htmlFor="auth-name">Nama lengkap</label>
            <input id="auth-name" className="text-input" placeholder="Nama lengkap" value={form.name} onChange={(event) => update("name", event.target.value)} autoComplete="name" required />
          </>}
          <label className="field-label" htmlFor="auth-email">Gmail</label>
          <input id="auth-email" className="text-input" type="email" inputMode="email" placeholder="nama@gmail.com" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" required />
          <label className="field-label" htmlFor="auth-password">Password</label>
          <input id="auth-password" className="text-input" type="password" placeholder="Minimal 8 karakter" value={form.password} onChange={(event) => update("password", event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required />
          {mode === "register" && <>
            <label className="field-label" htmlFor="auth-confirm-password">Ulangi password</label>
            <input id="auth-confirm-password" className="text-input" type="password" placeholder="Ulangi password" value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} autoComplete="new-password" minLength={8} required />
            {isStudent && <div className="auth-student-fields">
              <div className="form-grid"><div><label className="field-label" htmlFor="auth-major">Jurusan</label><input id="auth-major" className="text-input" placeholder="Jurusan" value={form.major} onChange={(event) => update("major", event.target.value)} required /></div><div><label className="field-label" htmlFor="auth-study-program">Program studi</label><input id="auth-study-program" className="text-input" placeholder="Program studi" value={form.studyProgram} onChange={(event) => update("studyProgram", event.target.value)} required /></div></div>
              <div className="form-grid"><div><label className="field-label" htmlFor="auth-nim">NIM</label><input id="auth-nim" className="text-input" placeholder="NIM mahasiswa" value={form.nim} onChange={(event) => update("nim", event.target.value)} required /></div><div><label className="field-label" htmlFor="auth-semester">Semester</label><input id="auth-semester" className="text-input" type="number" min="1" max="20" placeholder="1–20" value={form.semester} onChange={(event) => update("semester", event.target.value)} required /></div></div>
              <label className="field-label" htmlFor="auth-cohort">Angkatan</label><input id="auth-cohort" className="text-input" inputMode="numeric" placeholder="Contoh: 2022" value={form.cohort} onChange={(event) => update("cohort", event.target.value)} required />
            </div>}
            {!isStudent && <><label className="field-label" htmlFor="auth-organization">Instansi/unit</label><input id="auth-organization" className="text-input" placeholder="Fakultas atau perusahaan" value={form.organization} onChange={(event) => update("organization", event.target.value)} /></>}
          </>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Memproses..." : mode === "login" ? "Masuk ke akun" : "Daftar dan masuk"}</button>
        </form>
        <p className="auth-security"><ShieldCheck size={15} /> Password tersimpan sebagai hash dan data magang dipisahkan per akun.</p>
      </section>
    </main>
  );
}

function SignatureModal({
  signature,
  onClose,
  onSave,
  documentName,
}: {
  signature: Signature;
  onClose: () => void;
  onSave: (signatureData: string, name: string) => void | Promise<void>;
  documentName?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [name, setName] = useState(signature.name);
  const [hasInk, setHasInk] = useState(false);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    const bounds = canvas.getBoundingClientRect();
    canvas.width = bounds.width * ratio;
    canvas.height = bounds.height * ratio;
    context.scale(ratio, ratio);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.4;
    context.strokeStyle = "#23433c";
    if (signature.signatureData) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, bounds.width, bounds.height);
      image.src = signature.signatureData;
      setHasInk(true);
    }
  }, [signature.signatureData]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    canvas.setPointerCapture(event.pointerId);
    const point = getPoint(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    drawing.current = true;
    setHasInk(true);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const point = getPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  const save = () => {
    const data = canvasRef.current?.toDataURL("image/png");
    if (data && hasInk && name.trim()) onSave(data, name.trim());
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal signature-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">TTD elektronik</p>
            <h2>{signature.role === "supervisor" ? "TTD Supervisor Kantor" : "TTD Dosen Pembimbing"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup dialog"><X size={18} /></button>
        </div>
        <label className="field-label" htmlFor="signer-name">Nama penandatangan</label>
        <input id="signer-name" className="text-input" value={name} onChange={(event) => setName(event.target.value)} />
        <p className="helper-copy">Bubuhkan tanda tangan menggunakan mouse, trackpad, atau layar sentuh.</p>
        {documentName && <div className="signature-target"><FileText size={15} /><span>TTD akan ditempel ke <strong>{documentName}</strong></span></div>}
        <div className="signature-pad-wrap">
          <canvas
            ref={canvasRef}
            className="signature-pad"
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={() => { drawing.current = false; }}
            onPointerLeave={() => { drawing.current = false; }}
            aria-label="Area tanda tangan elektronik"
          />
          <span className="signature-line-label">Tanda tangan elektronik</span>
        </div>
        <div className="modal-actions">
          <button className="ghost-button" onClick={clear}><Trash2 size={16} /> Hapus coretan</button>
          <button className="primary-button" onClick={save} disabled={!hasInk || !name.trim()}><Check size={16} /> Simpan TTD</button>
        </div>
      </div>
    </div>
  );
}

function AddLogModal({ onClose, onSave }: { onClose: () => void; onSave: (log: Omit<Log, "id">) => void }) {
  const [form, setForm] = useState({
    date: "2026-08-12",
    title: "",
    description: "",
    hours: "8",
    category: "Administrasi",
    status: "Selesai" as LogStatus,
  });

  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    onSave({ ...form, title: form.title.trim(), description: form.description.trim(), hours: Number(form.hours) || 0 });
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="modal add-log-modal" onSubmit={submit} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><p className="eyebrow">Aktivitas baru</p><h2>Tambah tracking harian</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Tutup dialog"><X size={18} /></button>
        </div>
        <div className="form-grid">
          <div><label className="field-label" htmlFor="log-date">Tanggal</label><input id="log-date" className="text-input" type="date" value={form.date} onChange={(event) => update("date", event.target.value)} /></div>
          <div><label className="field-label" htmlFor="log-hours">Durasi (jam)</label><input id="log-hours" className="text-input" type="number" min="0" max="24" step="0.5" value={form.hours} onChange={(event) => update("hours", event.target.value)} /></div>
        </div>
        <label className="field-label" htmlFor="log-title">Judul aktivitas</label>
        <input id="log-title" className="text-input" placeholder="Contoh: Membuat dokumentasi API" value={form.title} onChange={(event) => update("title", event.target.value)} required />
        <label className="field-label" htmlFor="log-description">Deskripsi singkat</label>
        <textarea id="log-description" className="text-input textarea" placeholder="Ceritakan hasil yang dikerjakan hari ini..." value={form.description} onChange={(event) => update("description", event.target.value)} required />
        <div className="form-grid">
          <div><label className="field-label" htmlFor="log-category">Kategori</label><select id="log-category" className="text-input" value={form.category} onChange={(event) => update("category", event.target.value)}><option>Administrasi</option><option>Data</option><option>Dokumentasi</option><option>Orientasi</option><option>Pengembangan</option><option>Lainnya</option></select></div>
          <div><label className="field-label" htmlFor="log-status">Status</label><select id="log-status" className="text-input" value={form.status} onChange={(event) => update("status", event.target.value)}><option>Selesai</option><option>Proses</option><option>Tertunda</option></select></div>
        </div>
        <div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose}>Batal</button><button type="submit" className="primary-button"><Plus size={16} /> Simpan aktivitas</button></div>
      </form>
    </div>
  );
}

function ProfileModal({
  profile,
  role,
  onClose,
  onSave,
  onLogout,
}: {
  profile: Profile;
  role: UserRole;
  onClose: () => void;
  onSave: (profile: Profile) => void;
  onLogout: () => void;
}) {
  const [form, setForm] = useState(profile);
  const isStudent = role === "Mahasiswa";
  const update = (key: keyof Profile, value: string) => setForm((current) => ({
    ...current,
    [key]: key === "semester" ? Number(value) : value,
  }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave({ ...form, email: form.email.trim().toLowerCase(), name: form.name.trim(), major: form.major.trim(), studyProgram: form.studyProgram.trim(), nim: form.nim.trim(), cohort: form.cohort.trim() });
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="modal profile-modal" onSubmit={submit} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><p className="eyebrow">Profil pengguna</p><h2>Daftar data mahasiswa</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Tutup dialog"><X size={18} /></button>
        </div>
        <p className="helper-copy profile-intro">Lengkapi data diri untuk ditampilkan di dokumen magang dan diunduh sebagai spreadsheet.</p>
        <label className="field-label" htmlFor="profile-email">Email</label>
        <input id="profile-email" className="text-input" type="email" placeholder="nama@gmail.com" value={form.email} onChange={(event) => update("email", event.target.value)} required />
        <label className="field-label" htmlFor="profile-name">Nama lengkap</label>
        <input id="profile-name" className="text-input" placeholder="Nama lengkap mahasiswa" value={form.name} onChange={(event) => update("name", event.target.value)} required />
        <div className="form-grid">
          <div><label className="field-label" htmlFor="profile-major">Jurusan</label><input id="profile-major" className="text-input" placeholder="Contoh: Teknik Informatika" value={form.major} onChange={(event) => update("major", event.target.value)} required={isStudent} /></div>
          <div><label className="field-label" htmlFor="profile-study-program">Program studi</label><input id="profile-study-program" className="text-input" placeholder="Contoh: Sistem Informasi" value={form.studyProgram} onChange={(event) => update("studyProgram", event.target.value)} required={isStudent} /></div>
        </div>
        <div className="form-grid">
          <div><label className="field-label" htmlFor="profile-nim">NIM</label><input id="profile-nim" className="text-input" placeholder="Nomor induk mahasiswa" value={form.nim} onChange={(event) => update("nim", event.target.value)} required={isStudent} /></div>
          <div><label className="field-label" htmlFor="profile-semester">Semester</label><input id="profile-semester" className="text-input" type="number" min="1" max="20" value={form.semester} onChange={(event) => update("semester", event.target.value)} required={isStudent} /></div>
        </div>
        <label className="field-label" htmlFor="profile-cohort">Angkatan</label>
        <input id="profile-cohort" className="text-input" inputMode="numeric" placeholder="Contoh: 2022" value={form.cohort} onChange={(event) => update("cohort", event.target.value)} required={isStudent} />
        <div className="modal-actions profile-actions"><button type="button" className="ghost-button" onClick={() => downloadProfileSpreadsheet(form)}><Download size={16} /> Unduh spreadsheet</button><button type="submit" className="primary-button"><Check size={16} /> Simpan profil</button></div>
        <button type="button" className="logout-button" onClick={onLogout}>Keluar dari akun</button>
      </form>
    </div>
  );
}

function RegistrationModal({
  profile,
  users,
  onClose,
  onRegister,
}: {
  profile: Profile;
  users: DirectoryUser[];
  onClose: () => void;
  onRegister: (user: Omit<DirectoryUser, "id">) => void;
}) {
  const [role, setRole] = useState<UserRole>("Mahasiswa");
  const [form, setForm] = useState({
    email: profile.email,
    name: profile.name,
    major: profile.major,
    studyProgram: profile.studyProgram,
    nim: profile.nim,
    semester: String(profile.semester),
    cohort: profile.cohort,
    organization: "",
  });
  const isStudent = role === "Mahasiswa";
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onRegister({
      email: form.email.trim().toLowerCase(),
      name: form.name.trim(),
      role,
      major: form.major.trim(),
      studyProgram: form.studyProgram.trim(),
      nim: form.nim.trim(),
      semester: form.semester ? Number(form.semester) : undefined,
      cohort: form.cohort.trim(),
      organization: form.organization.trim(),
    });
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="modal registration-modal" onSubmit={submit} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><p className="eyebrow">Akun dan direktori</p><h2>Daftar pengguna</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Tutup dialog"><X size={18} /></button>
        </div>
        <p className="helper-copy profile-intro">Gunakan Gmail aktif setiap anggota. Data yang sudah terdaftar dapat diunduh sebagai CSV untuk Excel atau Google Sheets.</p>
        <label className="field-label" htmlFor="register-role">Peran pengguna</label>
        <select id="register-role" className="text-input" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
          <option>Mahasiswa</option><option>Dosen Pembimbing</option><option>Supervisor Kantor</option><option>Koordinator/Admin</option>
        </select>
        <label className="field-label" htmlFor="register-email">Gmail</label>
        <input id="register-email" className="text-input" type="email" inputMode="email" autoComplete="email" placeholder="nama@gmail.com" value={form.email} onChange={(event) => update("email", event.target.value)} onBlur={(event) => update("email", event.target.value.trim())} required />
        <label className="field-label" htmlFor="register-name">Nama lengkap</label>
        <input id="register-name" className="text-input" placeholder="Nama lengkap" value={form.name} onChange={(event) => update("name", event.target.value)} required />
        <div className="form-grid">
          <div><label className="field-label" htmlFor="register-major">Jurusan</label><input id="register-major" className="text-input" placeholder="Jurusan" value={form.major} onChange={(event) => update("major", event.target.value)} required={isStudent} /></div>
          <div><label className="field-label" htmlFor="register-study-program">Program studi</label><input id="register-study-program" className="text-input" placeholder="Program studi" value={form.studyProgram} onChange={(event) => update("studyProgram", event.target.value)} required={isStudent} /></div>
        </div>
        <div className="form-grid">
          <div><label className="field-label" htmlFor="register-nim">NIM</label><input id="register-nim" className="text-input" placeholder={isStudent ? "NIM mahasiswa" : "Opsional"} value={form.nim} onChange={(event) => update("nim", event.target.value)} required={isStudent} /></div>
          <div><label className="field-label" htmlFor="register-semester">Semester</label><input id="register-semester" className="text-input" type="number" min="1" max="20" placeholder="Opsional" value={form.semester} onChange={(event) => update("semester", event.target.value)} required={isStudent} /></div>
        </div>
        <div className="form-grid">
          <div><label className="field-label" htmlFor="register-cohort">Angkatan</label><input id="register-cohort" className="text-input" placeholder={isStudent ? "Contoh: 2022" : "Opsional"} value={form.cohort} onChange={(event) => update("cohort", event.target.value)} required={isStudent} /></div>
          <div><label className="field-label" htmlFor="register-organization">Instansi/unit</label><input id="register-organization" className="text-input" placeholder="Fakultas atau perusahaan" value={form.organization} onChange={(event) => update("organization", event.target.value)} /></div>
        </div>
        <div className="directory-toolbar"><strong>{users.length} pengguna terdaftar</strong><button type="button" className="ghost-button" onClick={() => downloadUsersSpreadsheet(users)} disabled={!users.length}><Download size={15} /> Unduh CSV</button></div>
        {users.length > 0 && <div className="user-list">{users.slice(0, 5).map((user) => <div className="user-list-row" key={user.email}><div className="avatar avatar-small">{user.name.slice(0, 2).toUpperCase()}</div><div><strong>{user.name}</strong><span>{user.role} · {user.email}</span></div></div>)}</div>}
        <div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose}>Batal</button><button type="submit" className="primary-button"><Check size={16} /> Daftarkan pengguna</button></div>
      </form>
    </div>
  );
}

export default function Home() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeNav, setActiveNav] = useState<NavKey>("overview");
  const [logs, setLogs] = useState<Log[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>(initialSignatures);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([]);
  const [mobileNav, setMobileNav] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [signatureRole, setSignatureRole] = useState<SignatureRole | null>(null);
  const [documents, setDocuments] = useState<SignedDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me").then(async (response) => {
      if (!active) return;
      if (response.ok) {
        const data = await response.json();
        setAuthUser(data.user as AuthUser);
      }
    }).catch(() => undefined).finally(() => {
      if (active) setAuthLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!authUser) return;
    const storagePrefix = `si-magang-${authUser.id}`;
    const accountProfile = normalizeProfile(authUser, emptyProfile);
    const accountSignatures: Signature[] = [
      { role: "supervisor", name: authUser.supervisorName || "Supervisor belum ditentukan", title: `Supervisor Magang · ${authUser.company || "Instansi belum diisi"}` },
      { role: "dosen", name: authUser.lecturerName || "Dosen pembimbing belum ditentukan", title: "Dosen Pembimbing · Universitas Tarakanita" },
    ];
    setProfile(accountProfile);
    setLogs([]);
    setSignatures(accountSignatures);
    setDocuments([]);
    setSelectedDocumentId(null);
    setDirectoryUsers([]);
    try {
      const storedLogs = window.localStorage.getItem(`${storagePrefix}-logs`);
      const storedSignatures = window.localStorage.getItem(`${storagePrefix}-signatures`);
      const storedProfile = window.localStorage.getItem(`${storagePrefix}-profile`);
      if (storedLogs) setLogs(JSON.parse(storedLogs));
      if (storedSignatures) setSignatures(JSON.parse(storedSignatures));
      if (storedProfile) setProfile(normalizeProfile(JSON.parse(storedProfile), emptyProfile));
    } catch {
      // Neon remains the source of truth; local storage only keeps an in-progress form responsive.
    }
    fetch("/api/logs").then((response) => response.ok ? response.json() : []).then((data: Log[]) => {
      if (Array.isArray(data)) {
        setLogs(data.map((item) => ({
          ...item,
          date: item.date.includes("T") ? item.date.slice(0, 10) : item.date,
        })));
      }
    }).catch(() => undefined);
    fetch("/api/signatures").then((response) => response.ok ? response.json() : []).then((data: Signature[]) => {
      if (Array.isArray(data)) setSignatures((current) => current.map((item) => data.find((remote) => remote.role === item.role) ?? item));
    }).catch(() => undefined);
    fetch("/api/documents").then((response) => response.ok ? response.json() : []).then((data: SignedDocument[]) => {
      if (Array.isArray(data)) {
        setDocuments(data);
        setSelectedDocumentId((current) => current && data.some((item) => item.id === current) ? current : data[0]?.id ?? null);
      }
    }).catch(() => undefined);
    fetch("/api/profile").then((response) => response.ok ? response.json() : null).then((data: Profile | null) => {
      if (data) setProfile(normalizeProfile(data, emptyProfile));
    }).catch(() => undefined);
    if (authUser.role === "Koordinator/Admin") {
      fetch("/api/users").then((response) => response.ok ? response.json() : []).then((data: DirectoryUser[]) => {
        if (Array.isArray(data)) setDirectoryUsers(data);
      }).catch(() => undefined);
    }
  }, [authUser]);

  useEffect(() => {
    if (authUser) window.localStorage.setItem(`si-magang-${authUser.id}-logs`, JSON.stringify(logs));
  }, [logs, authUser]);

  useEffect(() => {
    if (authUser) window.localStorage.setItem(`si-magang-${authUser.id}-signatures`, JSON.stringify(signatures));
  }, [signatures, authUser]);

  useEffect(() => {
    if (authUser) window.localStorage.setItem(`si-magang-${authUser.id}-profile`, JSON.stringify(profile));
  }, [profile, authUser]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const totalHours = useMemo(() => logs.reduce((total, log) => total + Number(log.hours), 0), [logs]);
  const completedLogs = useMemo(() => logs.filter((log) => log.status === "Selesai").length, [logs]);
  const activeSignature = signatureRole ? signatures.find((item) => item.role === signatureRole) : undefined;
  const selectedDocument = selectedDocumentId ? documents.find((item) => item.id === selectedDocumentId) : undefined;
  const profileInitials = profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "MA";

  const addLog = (log: Omit<Log, "id">) => {
    const nextLog = { ...log, id: `local-${Date.now()}` };
    setLogs((current) => [nextLog, ...current]);
    setShowLogModal(false);
    setToast("Aktivitas berhasil ditambahkan");
    fetch("/api/logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(log) }).catch(() => undefined);
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isPdf = file.name.toLowerCase().endsWith(".pdf");
    const isDocx = file.name.toLowerCase().endsWith(".docx");
    if ((!isPdf && !isDocx) || file.size > 3_000_000) {
      setToast("Gunakan PDF atau Word .docx dengan ukuran maksimal 3 MB");
      return;
    }
    setDocumentBusy(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("File tidak dapat dibaca"));
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, mimeType: file.type, data }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(result.error ?? "Dokumen gagal diunggah"));
      const document = result as SignedDocument;
      setDocuments((current) => [document, ...current]);
      setSelectedDocumentId(document.id);
      setToast("Dokumen berhasil diunggah dan siap ditandatangani");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Dokumen gagal diunggah");
    } finally {
      setDocumentBusy(false);
    }
  };

  const saveSignature = async (data: string, name: string) => {
    if (!signatureRole) return;
    const signedAt = new Date().toISOString();
    const signatureResponse = await fetch("/api/signatures", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: signatureRole, name, signatureData: data }) });
    const signatureResult = await signatureResponse.json().catch(() => ({}));
    if (!signatureResponse.ok) {
      setToast(String(signatureResult.error ?? "Tanda tangan gagal disimpan"));
      return;
    }
    setSignatures((current) => current.map((item) => item.role === signatureRole ? { ...item, name, signatureData: data, signedAt } : item));
    if (selectedDocument) {
      const documentResponse = await fetch(`/api/documents/${selectedDocument.id}/sign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: signatureRole, name, signatureData: data }) });
      const documentResult = await documentResponse.json().catch(() => ({}));
      if (!documentResponse.ok) {
        setSignatureRole(null);
        setToast(`TTD tersimpan, tetapi file belum berubah: ${String(documentResult.error ?? "coba lagi")}`);
        return;
      }
      setDocuments((current) => current.map((item) => item.id === selectedDocument.id ? documentResult as SignedDocument : item));
    }
    setSignatureRole(null);
    setToast(selectedDocument ? `TTD berhasil ditempel ke ${selectedDocument.fileName}` : "Tanda tangan elektronik tersimpan");
  };

  const saveProfile = async (nextProfile: Profile) => {
    const response = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextProfile) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setToast(String(data.error ?? "Profil gagal disimpan"));
      return;
    }
    setProfile(normalizeProfile(data, emptyProfile));
    setShowProfileModal(false);
    setToast("Profil pengguna berhasil disimpan");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setShowProfileModal(false);
    setAuthUser(null);
    setProfile(emptyProfile);
    setLogs([]);
    setSignatures(initialSignatures);
    setDocuments([]);
    setSelectedDocumentId(null);
  };

  const printPdf = () => {
    window.print();
  };

  const documentHasSigner = (role: SignatureRole) => Boolean(selectedDocument?.signatures.some((item) => item.role === role));

  const openSection = (key: NavKey) => {
    setActiveNav(key);
    setMobileNav(false);
  };

  if (authLoading) return <main className="auth-shell"><div className="auth-loading">Memuat akun pengguna...</div></main>;
  if (!authUser) return <AuthScreen onAuthenticated={(user) => { setAuthUser(user); setToast(`Selamat datang, ${user.name}`); }} />;

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Sparkles size={20} strokeWidth={2.5} /></div>
          <div><p className="brand-name">SI MAGANG</p><p className="brand-campus">UNIVERSITAS TARAKANITA</p></div>
        </div>
        <div className="profile-mini profile-trigger" role="button" tabIndex={0} onClick={() => setShowProfileModal(true)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setShowProfileModal(true); }}><div className="avatar">{profileInitials}</div><div><p className="profile-name">{profile.name}</p><p className="profile-role">{authUser.role}</p></div><ChevronDown size={15} className="muted-icon" /></div>
        <div className="nav-label">Workspace</div>
        <nav className="nav-list">
          {navItems.map((item) => { const Icon = item.icon; return <button key={item.key} className={`nav-item ${activeNav === item.key ? "nav-item-active" : ""}`} onClick={() => openSection(item.key)}><Icon size={18} /><span>{item.label}</span>{item.key === "daily" && <span className="nav-count">{logs.length}</span>}</button>; })}
        </nav>
        <div className="sidebar-bottom"><div className="support-card"><div className="support-icon"><ShieldCheck size={17} /></div><p className="support-title">Data kamu aman</p><p className="support-copy">Tersimpan rapi dan siap direview.</p></div><button className="nav-item muted-nav" onClick={() => setShowProfileModal(true)}><Settings2 size={18} /><span>Profil & pengguna</span></button><div className="sidebar-footnote"><span className="online-dot" /> Sistem aktif · 2026</div></div>
      </aside>

      <section className="main-area">
        <header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav((open) => !open)} aria-label="Buka menu"><Menu size={20} /></button><div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{navItems.find((item) => item.key === activeNav)?.label}</strong></div><div className="topbar-actions"><button className="icon-button notification-button" aria-label="Notifikasi"><Bell size={18} /><span className="notification-dot" /></button><div className="topbar-divider" /><div className="topbar-user"><div className="avatar avatar-small">{profileInitials}</div><span>{profile.name.split(/\s+/)[0] || "Pengguna"}</span><ChevronDown size={14} /></div></div></header>

        <div className="content-wrap">
          <section className="hero-row"><div><p className="eyebrow">Selamat pagi, {profile.name || "Pengguna"} <span className="wave">✦</span></p><h1>{activeNav === "overview" ? "Progress magangmu terlihat baik." : navItems.find((item) => item.key === activeNav)?.label}</h1><p className="hero-subtitle">Pantau aktivitas, review, dan persetujuan magang dalam satu ruang kerja.</p></div><div className="hero-actions"><button className="secondary-button" onClick={printPdf}><Download size={17} /> Cetak / PDF</button><button className="primary-button" onClick={() => setShowLogModal(true)}><Plus size={17} /> Tambah aktivitas</button></div></section>

          {activeNav === "overview" && <>
            <section className="metric-grid"><div className="metric-card metric-card-sage"><div className="metric-icon"><Clock3 size={18} /></div><div><p className="metric-label">Total jam</p><p className="metric-value">{totalHours}<span> jam</span></p><p className="metric-trend"><ArrowUpRight size={14} /> 12% dari minggu lalu</p></div><div className="metric-spark spark-sage"><span /><span /><span /><span /><span /><span /><span /></div></div><div className="metric-card metric-card-yellow"><div className="metric-icon"><CheckCircle2 size={18} /></div><div><p className="metric-label">Aktivitas selesai</p><p className="metric-value">{completedLogs}<span> / {logs.length}</span></p><p className="metric-trend"><ArrowUpRight size={14} /> Konsisten minggu ini</p></div><div className="metric-spark spark-yellow"><span /><span /><span /><span /><span /><span /><span /></div></div><div className="metric-card metric-card-blue"><div className="metric-icon"><BriefcaseBusiness size={18} /></div><div><p className="metric-label">Sisa masa magang</p><p className="metric-value">80<span> hari</span></p><p className="metric-trend neutral-trend"><CalendarDays size={14} /> s/d 31 Okt 2026</p></div><div className="metric-spark spark-blue"><span /><span /><span /><span /><span /><span /><span /></div></div></section>
            <section className="dashboard-grid"><div className="panel activity-panel"><div className="panel-head"><div><p className="eyebrow">Aktivitas terbaru</p><h2>Tracking harian</h2></div><button className="text-button" onClick={() => openSection("daily")}>Lihat semua <ArrowUpRight size={15} /></button></div><div className="activity-list">{logs.slice(0, 4).map((log) => <div className="activity-row" key={log.id}><div className="date-box"><strong>{new Date(`${log.date}T00:00:00`).getDate()}</strong><span>{new Intl.DateTimeFormat("id-ID", { month: "short" }).format(new Date(`${log.date}T00:00:00`))}</span></div><div className="activity-info"><div className="activity-title-row"><h3>{log.title}</h3><Badge status={log.status} /></div><p>{log.description}</p><div className="activity-meta"><span>{log.category}</span><span className="meta-dot">·</span><span>{log.hours} jam kerja</span></div></div><ArrowUpRight size={16} className="row-arrow" /></div>)}</div></div><div className="panel progress-panel"><div className="panel-head"><div><p className="eyebrow">Target bulan ini</p><h2>Progress magang</h2></div><span className="progress-percent">72%</span></div><div className="big-progress"><div className="progress-ring"><div className="ring-inner"><strong>72</strong><span>%</span></div></div><div className="progress-copy"><p>Bagus, tinggal sedikit lagi!</p><span>18 dari 25 aktivitas tercatat</span><div className="tiny-progress"><span style={{ width: "72%" }} /></div></div></div><div className="goal-list"><div><span className="goal-check goal-done"><Check size={12} /></span><span>Onboarding & orientasi</span><strong>✓</strong></div><div><span className="goal-check goal-done"><Check size={12} /></span><span>Dokumentasi proses kerja</span><strong>✓</strong></div><div><span className="goal-check goal-current" /><span>Review bersama supervisor</span><strong>04 hari</strong></div></div></div></section>
            <section className="lower-grid"><div className="panel weekly-panel"><div className="panel-head"><div><p className="eyebrow">Ringkasan periode</p><h2>Review mingguan</h2></div><button className="text-button" onClick={() => openSection("weekly")}>Detail <ArrowUpRight size={15} /></button></div><div className="week-bars">{weeklyData.map((item) => <div className="week-bar" key={item.week}><div className="week-bar-top"><span>{item.week}</span><strong>{item.progress}%</strong></div><div className="bar-track"><span className={`bar-fill bar-${item.tone}`} style={{ height: `${item.progress}%` }} /></div><small>{item.range}</small></div>)}</div></div><div className="panel signature-summary-panel"><div className="panel-head"><div><p className="eyebrow">Persetujuan dokumen</p><h2>Tanda tangan</h2></div><button className="text-button" onClick={() => openSection("signatures")}>Kelola <ArrowUpRight size={15} /></button></div><div className="signature-summary-list">{signatures.map((signature) => <div className="signature-summary-row" key={signature.role}><div className={`signature-avatar ${signature.role}`}><PenLine size={16} /></div><div><p>{signature.role === "supervisor" ? "Supervisor kantor" : "Dosen pembimbing"}</p><span>{signature.signedAt ? "Sudah ditandatangani" : "Menunggu tanda tangan"}</span></div><span className={`signature-status ${signature.signedAt ? "signed" : "waiting"}`}>{signature.signedAt ? <Check size={13} /> : <Clock3 size={13} />}</span></div>)}</div><button className="full-button" onClick={() => openSection("signatures")}><PenLine size={16} /> Buka ruang tanda tangan</button></div></section>
          </>}

          {activeNav === "daily" && <section className="panel page-panel"><div className="page-panel-head"><div><p className="eyebrow">Log aktivitas</p><h2>Tracking harian</h2><p className="panel-description">Catat apa yang kamu kerjakan setiap hari dan siapkan dokumentasi untuk review.</p></div><button className="primary-button" onClick={() => setShowLogModal(true)}><Plus size={17} /> Aktivitas baru</button></div><div className="filter-row"><div className="search-input"><Search size={16} /><input placeholder="Cari aktivitas..." /><span>⌘ K</span></div><button className="filter-button">Semua status <ChevronDown size={15} /></button><button className="filter-button">Agustus 2026 <ChevronDown size={15} /></button></div><div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Aktivitas</th><th>Kategori</th><th>Durasi</th><th>Status</th><th /></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td><strong>{formatDate(log.date)}</strong></td><td><div className="table-title">{log.title}</div><span className="table-subtitle">{log.description}</span></td><td><span className="category-pill">{log.category}</span></td><td>{log.hours} jam</td><td><Badge status={log.status} /></td><td><button className="row-menu" aria-label={`Buka ${log.title}`}><ArrowUpRight size={16} /></button></td></tr>)}</tbody></table></div></section>}

          {activeNav === "weekly" && <section className="panel page-panel"><div className="page-panel-head"><div><p className="eyebrow">Refleksi dan evaluasi</p><h2>Review mingguan</h2><p className="panel-description">Lihat perkembangan setiap minggu dan siapkan catatan untuk supervisor.</p></div><button className="secondary-button" onClick={printPdf}><Download size={17} /> Cetak review</button></div><div className="weekly-detail-grid">{weeklyData.map((item, index) => <div className="week-detail-card" key={item.week}><div className="week-detail-head"><div><span className={`week-dot dot-${item.tone}`} /> <strong>{item.week}</strong><p>{item.range} · 2026</p></div><span className="detail-percent">{item.progress}%</span></div><div className="detail-bar"><span className={`bar-fill bar-${item.tone}`} style={{ width: `${item.progress}%` }} /></div><p className="detail-copy">{index === 0 ? "Berhasil memahami lingkungan kerja dan alur koordinasi tim." : index === 1 ? "Mulai konsisten mengelola data dan dokumentasi tugas." : "Belum dimulai — review akan tersedia setelah periode berjalan."}</p><button className="outline-small">{index < 2 ? "Buka catatan" : "Tambah refleksi"} <ArrowUpRight size={14} /></button></div>)}</div></section>}

          {activeNav === "signatures" && <section className="panel page-panel"><div className="page-panel-head"><div><p className="eyebrow">Approval digital</p><h2>Ruang tanda tangan</h2><p className="panel-description">Unggah dokumen PDF atau Word .docx, pilih file, lalu bubuhkan TTD. Tanda tangan akan ditempel langsung ke file dan bisa diunduh kembali.</p></div><button className="secondary-button" onClick={printPdf}><Download size={17} /> Cetak halaman</button></div><div className="signature-notice"><div className="notice-icon"><ShieldCheck size={20} /></div><div><strong>Dokumen aman per akun</strong><p>File hanya bisa dibuka oleh akun yang mengunggahnya. Maksimal 3 MB per dokumen.</p></div><span className="notice-status">Privat</span></div><div className="document-upload-panel"><div><p className="eyebrow">Dokumen yang akan ditandatangani</p><h3>Upload PDF / Word</h3><p>Gunakan PDF atau Word modern (.docx). Isi dokumen tetap dipertahankan.</p></div><input id="document-upload" className="document-file-input" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleDocumentUpload} disabled={documentBusy} /><label className="primary-button document-upload-button" htmlFor="document-upload"><FileText size={16} /> {documentBusy ? "Mengunggah..." : "Pilih dokumen"}</label></div>{documents.length > 0 ? <div className="document-list">{documents.map((document) => { const selected = selectedDocumentId === document.id; return <div className={`document-row ${selected ? "document-row-selected" : ""}`} key={document.id}><div className="document-icon"><FileText size={18} /></div><div className="document-info"><strong>{document.fileName}</strong><span>{document.mimeType.includes("word") || document.fileName.toLowerCase().endsWith(".docx") ? "Word .docx" : "PDF"} · {document.signatures.length}/2 TTD · {document.status === "signed" ? "Sudah ada TTD" : "Belum ditandatangani"}</span></div><div className="document-actions"><button className="outline-small" onClick={() => setSelectedDocumentId(document.id)}>{selected ? "Dokumen dipilih" : "Pilih untuk TTD"}</button><a className="outline-small" href={`/api/documents/${document.id}?version=original`}>Asli</a>{document.hasSignedData && <a className="outline-small document-download-link" href={`/api/documents/${document.id}?version=signed`}>Unduh TTD</a>}</div></div>; })}</div> : <div className="document-empty"><FileText size={19} /><span>Belum ada dokumen. Upload file di atas untuk mulai.</span></div>}<div className="selected-document-note">{selectedDocument ? <><CheckCircle2 size={16} /><span>Dokumen aktif: <strong>{selectedDocument.fileName}</strong>. Pilih kartu supervisor atau dosen untuk menempelkan TTD ke file ini.</span></> : <><FileText size={16} /><span>Upload dan pilih satu dokumen agar TTD berikutnya langsung masuk ke file.</span></>}</div><div className="signature-cards">{signatures.map((signature) => { const alreadySigned = documentHasSigner(signature.role); return <div className="signature-card" key={signature.role}><div className="signature-card-head"><div className={`signature-avatar large ${signature.role}`}><PenLine size={20} /></div><div><p className="eyebrow">{signature.role === "supervisor" ? "Supervisor kantor" : "Dosen pembimbing"}</p><h3>{signature.name}</h3><p>{signature.title}</p></div><span className={`signature-status ${signature.signedAt ? "signed" : "waiting"}`}>{signature.signedAt ? <><Check size={13} /> Tersimpan</> : <><Clock3 size={13} /> Menunggu</>}</span></div><div className="signature-preview">{signature.signatureData ? <img src={signature.signatureData} alt={`Tanda tangan ${signature.name}`} /> : <div className="signature-placeholder"><PenLine size={18} /><span>Belum ada tanda tangan elektronik</span></div>}<span className="signature-line-label">{signature.signedAt ? `Ditandatangani ${formatDate(signature.signedAt.slice(0, 10))}` : "Area tanda tangan"}</span></div><button className="full-button" disabled={alreadySigned} onClick={() => setSignatureRole(signature.role)}><PenLine size={16} /> {alreadySigned ? "Sudah TTD di dokumen" : signature.signedAt ? "Perbarui tanda tangan" : "Bubuhkan tanda tangan"}</button></div>; })}</div><div className="document-footer"><div><FileText size={20} /><div><strong>{selectedDocument ? selectedDocument.fileName : "Belum ada dokumen"}</strong><span>{selectedDocument ? `${selectedDocument.signatures.length}/2 pihak sudah menandatangani file.` : "Upload dokumen untuk memulai proses TTD."}</span></div></div>{selectedDocument?.hasSignedData ? <a className="primary-button document-download-link" href={`/api/documents/${selectedDocument.id}?version=signed`}><Download size={16} /> Unduh file bertanda tangan</a> : <button className="primary-button" onClick={printPdf}><Download size={16} /> Cetak halaman</button>}</div></section>}
        </div>
      </section>
      {showLogModal && <AddLogModal onClose={() => setShowLogModal(false)} onSave={addLog} />}
      {showProfileModal && <ProfileModal profile={profile} role={authUser.role} onClose={() => setShowProfileModal(false)} onSave={saveProfile} onLogout={logout} />}
      {activeSignature && signatureRole && <SignatureModal signature={activeSignature} documentName={selectedDocument?.fileName} onClose={() => setSignatureRole(null)} onSave={saveSignature} />}
      {toast && <div className="toast"><CheckCircle2 size={17} /> {toast}</div>}
    </main>
  );
}
