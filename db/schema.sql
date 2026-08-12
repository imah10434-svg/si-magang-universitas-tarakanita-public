-- Schema SI Magang Universitas Tarakanita
-- Jalankan sekali pada SQL Editor Neon sebelum deployment.

CREATE TABLE IF NOT EXISTS interns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  program TEXT NOT NULL,
  company TEXT NOT NULL,
  supervisor_name TEXT NOT NULL,
  lecturer_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
