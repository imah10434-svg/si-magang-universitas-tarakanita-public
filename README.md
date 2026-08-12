# SI Magang · Universitas Tarakanita

Dashboard modern untuk tracking kegiatan magang harian, review mingguan, TTD elektronik supervisor/dosen, dan cetak dokumen ke PDF.

## Jalankan lokal

```bash
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Tanpa `DATABASE_URL`, aplikasi tetap bisa dicoba dengan data demo dan menyimpan perubahan di browser. Agar data persisten, jalankan [`db/schema.sql`](./db/schema.sql) di SQL Editor Neon lalu isi `DATABASE_URL` di `.env.local`.

## Neon

Gunakan connection string pooled dari Neon untuk deployment serverless/Vercel. Simpan hanya di environment variable `DATABASE_URL`; jangan commit file `.env.local`.

## Deploy ke Vercel

1. Push folder ini ke GitHub atau import project lokal ke Vercel.
2. Tambahkan environment variable `DATABASE_URL` untuk Preview dan Production.
3. Deploy/redeploy project.
4. Buka URL deployment Vercel untuk akses publik.

Next.js terdeteksi otomatis oleh Vercel. Tombol `Cetak / PDF` memakai dialog print browser sehingga pengguna dapat memilih `Save as PDF`.
