import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

// Nunito everywhere (same family as the student app). Weights match the mobile
// theme: 400 / 600 / 700 / 800.
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "tuwon — Teacher",
  description: "Create gamified, voiced learning sessions by chatting with AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body>{children}</body>
    </html>
  );
}
