-- Schema SI Magang Universitas Tarakanita
-- Jalankan sekali pada SQL Editor Neon sebelum deployment.

CREATE TABLE IF NOT EXISTS interns (
  id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  program TEXT NOT NULL,
  major TEXT,
  study_program TEXT,
  semester INTEGER,
  cohort TEXT,
  company TEXT NOT NULL,
  supervisor_name TEXT NOT NULL,
  lecturer_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE interns ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE interns ADD COLUMN IF NOT EXISTS major TEXT;
ALTER TABLE interns ADD COLUMN IF NOT EXISTS study_program TEXT;
ALTER TABLE interns ADD COLUMN IF NOT EXISTS semester INTEGER;
ALTER TABLE interns ADD COLUMN IF NOT EXISTS cohort TEXT;

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Mahasiswa', 'Dosen Pembimbing', 'Supervisor Kantor', 'Koordinator/Admin')),
  major TEXT NOT NULL DEFAULT '',
  study_program TEXT NOT NULL DEFAULT '',
  nim TEXT NOT NULL DEFAULT '',
  semester INTEGER,
  cohort TEXT NOT NULL DEFAULT '',
  organization TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_users_role_idx
  ON app_users (role, created_at DESC);

CREATE TABLE IF NOT EXISTS app_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_sessions_expiry_idx
  ON app_sessions (expires_at);

ALTER TABLE interns ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES app_users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS interns_user_unique_idx
  ON interns (user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS interns_email_unique_idx
  ON interns (LOWER(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE TABLE IF NOT EXISTS directory_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Mahasiswa', 'Dosen Pembimbing', 'Supervisor Kantor', 'Koordinator/Admin')),
  major TEXT NOT NULL DEFAULT '',
  study_program TEXT NOT NULL DEFAULT '',
  nim TEXT NOT NULL DEFAULT '',
  semester INTEGER,
  cohort TEXT NOT NULL DEFAULT '',
  organization TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS directory_users_role_idx
  ON directory_users (role, created_at DESC);

CREATE TABLE IF NOT EXISTS daily_logs (
  id TEXT PRIMARY KEY,
  intern_id TEXT NOT NULL REFERENCES interns(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  hours NUMERIC(4, 1) NOT NULL DEFAULT 8,
  category TEXT NOT NULL DEFAULT 'Lainnya',
  status TEXT NOT NULL DEFAULT 'Selesai',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS daily_logs_intern_date_idx
  ON daily_logs (intern_id, work_date DESC);

CREATE TABLE IF NOT EXISTS weekly_reviews (
  id TEXT PRIMARY KEY,
  intern_id TEXT NOT NULL REFERENCES interns(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  reflection TEXT NOT NULL DEFAULT '',
  supervisor_note TEXT NOT NULL DEFAULT '',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (intern_id, week_number)
);

CREATE TABLE IF NOT EXISTS signatures (
  id TEXT PRIMARY KEY,
  intern_id TEXT NOT NULL REFERENCES interns(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('supervisor', 'dosen')),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  signature_data TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (intern_id, role)
);

CREATE TABLE IF NOT EXISTS signed_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES app_users(id) ON DELETE CASCADE,
  intern_id TEXT REFERENCES interns(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  original_data TEXT NOT NULL,
  signed_data TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'signed')),
  signatures_json TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE signed_documents ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES app_users(id) ON DELETE CASCADE;
ALTER TABLE signed_documents ALTER COLUMN intern_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS signed_documents_intern_created_idx
  ON signed_documents (intern_id, created_at DESC);

CREATE INDEX IF NOT EXISTS signed_documents_user_created_idx
  ON signed_documents (user_id, created_at DESC);

INSERT INTO interns (
  id, name, student_id, program, company, supervisor_name, lecturer_name, start_date, end_date
)
VALUES (
  'demo-intern',
  'Nadya Kirana Putri',
  '2022010123',
  'Sistem Informasi',
  'PT Solusi Digital Nusantara',
  'Raka Pratama, S.Kom.',
  'Dr. Maria Lestari, M.Kom.',
  '2026-08-01',
  '2026-10-31'
)
ON CONFLICT (id) DO NOTHING;
