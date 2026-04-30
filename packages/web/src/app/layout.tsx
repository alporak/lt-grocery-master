import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ClientProviders } from "@/components/client-providers";

const inter = Inter({ subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Krepza - Price Checker",
  description: "Krepza — Lithuanian grocery price comparison and shopping list tool",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: { url: "/icon.png" },
  },
  other: process.env.NEXT_PUBLIC_ADSENSE_ID
    ? { "google-adsense-account": `ca-${process.env.NEXT_PUBLIC_ADSENSE_ID}` }
    : undefined,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="lt" suppressHydrationWarning>
      <body className={inter.className}>
        {process.env.NEXT_PUBLIC_ADSENSE_ID && (
          <Script
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-${process.env.NEXT_PUBLIC_ADSENSE_ID}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        )}
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
