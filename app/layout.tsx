import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BDS",
  description: "Website bất động sản",
  viewport: {
    width: "device-width",
    initialScale: 1,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}