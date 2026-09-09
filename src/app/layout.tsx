import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Swingalyzation — Frame-by-Frame Baseball Swing Analyzer",
  description: "Advanced baseball swing analysis with skeleton overlays, drawing tools, comparison modes, and audio sync.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
