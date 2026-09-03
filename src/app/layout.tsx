import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OFFRAMP — Crypto Flow Intelligence",
  description: "Follows the money across the seam where it stops being crypto and starts being cash.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
