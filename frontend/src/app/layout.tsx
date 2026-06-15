import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Document Analysis & Case Strategy",
  description: "7-Step AI-powered legal document analysis workflow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
