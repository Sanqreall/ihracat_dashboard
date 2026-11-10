import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/providers";

export const metadata: Metadata = {
  title: "İhracat Yönetimi",
  description: "Sipariş, ödeme planı ve tahsilat takibi",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
