import type { Metadata } from "next";
import { RootLayoutWrapper } from "@/components/RootLayoutWrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sanctuary Session",
  description:
    "A voice-based, solution-focused coaching companion. Not a substitute for professional care.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <RootLayoutWrapper>{children}</RootLayoutWrapper>
      </body>
    </html>
  );
}

