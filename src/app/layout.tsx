import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Psychologist",
  description:
    "A voice-based, solution-focused coaching companion. Not a substitute for professional care.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
