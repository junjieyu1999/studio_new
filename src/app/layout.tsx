import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";
import { ContactWidget } from "@/components/ContactWidget";
import "./globals.css";

// Cormorant Garamond is used site-wide (see globals.css, where all font tokens
// resolve to this variable).
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--ff-serif",
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
    <html lang="en" className={`${cormorant.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <ContactWidget />
      </body>
    </html>
  );
}
