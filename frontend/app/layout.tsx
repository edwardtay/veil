import type { Metadata } from "next";
import { Roboto_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Toaster } from "sonner";
import { siteConfig } from "@/config/site";
import "./globals.css";

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    title: `${siteConfig.name} — Private Payments, Full Compliance`,
    description: siteConfig.description,
    url: siteConfig.url,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — Private Payments, Full Compliance`,
    description: siteConfig.description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={robotoMono.variable}
    >
      <body className="min-h-screen bg-void-950 font-[family-name:var(--font-body)] text-void-400">
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-gold focus:text-void-950 focus:rounded-lg focus:font-medium"
          >
            Skip to content
          </a>
          <Header />
          <main id="main">{children}</main>
          <Footer />
          <Toaster
            theme="light"
            position="bottom-right"
          />
        </Providers>
      </body>
    </html>
  );
}
