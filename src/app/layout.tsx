import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { getNav } from "@/lib/content";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: { default: "Backend Academy", template: "%s · Backend Academy" },
  description: "From backend fundamentals to production-grade engineering and large-scale system design.",
};

// Runs before paint so the saved theme never flashes.
const themeScript = `try{document.documentElement.dataset.theme=localStorage.getItem("academy:theme")||"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans min-h-screen">
        <Shell nav={getNav()}>{children}</Shell>
      </body>
    </html>
  );
}
