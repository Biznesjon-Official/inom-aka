import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import SessionProvider from "@/components/SessionProvider";
import { ThemeProvider } from "next-themes";
import PWARegister from "@/components/PWARegister";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Inomaka CRM",
  description: "Do'kon boshqaruv tizimi",
  manifest: "/manifest.json",
  themeColor: "#1e40af",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Inomaka CRM",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={geist.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <SessionProvider>
            {children}
            <Toaster richColors position="top-right" />
            <PWARegister />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
