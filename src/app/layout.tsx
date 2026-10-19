import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

// Typographie de la charte BeeRecos : Poppins (Thin, Light, Regular, SemiBold, Bold).
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["100", "300", "400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "BeeMarketing", template: "%s · BeeMarketing" },
  description: "Le système commercial Instagram de BeeRecos : contenu, conversations, visites de clubs.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
