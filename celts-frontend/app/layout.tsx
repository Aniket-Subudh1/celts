// app/layout.tsx
import type React from "react";
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { Sora, Bungee_Shade, Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});


const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sora",
});

const bungee = Bungee_Shade({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bungee",
});

export const metadata: Metadata = {
  title: "CELTS - English Competency Testing Platform",
  description: "Advanced English language testing with AI-powered evaluation",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // <html lang="en" className={sora.variable}>
    <html lang="en" className={`${bungee.variable} ${sora.variable}`}>
      <body className="antialiased bg-sky-200">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
