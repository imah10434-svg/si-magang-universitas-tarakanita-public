import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SI Magang | Universitas Tarakanita",
  description: "Sistem Informasi Magang Universitas Tarakanita",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
