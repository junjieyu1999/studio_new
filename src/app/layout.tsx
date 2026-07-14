import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit, JetBrains_Mono } from "next/font/google";
import { ContactWidget } from "@/components/ContactWidget";
import "./globals.css";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--ff-serif",
  display: "swap",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--ff-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--ff-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Gallery",
  description: "A walk-through 3D gallery of original artwork.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <ContactWidget />
      </body>
    </html>
  );
}
