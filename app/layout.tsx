import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import {
  isMetaLocalDevelopment,
  metaTestEventCodeForCurrentEnvironment,
} from "@/lib/metaTestEvents";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sales OS",
  description: "WhatsApp and Meta campaign analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const devMeta = isMetaLocalDevelopment();
  const metaTestCode = metaTestEventCodeForCurrentEnvironment();
  const loadPixel =
    Boolean(pixelId) && (!devMeta || Boolean(metaTestCode));

  const fbqInit = (() => {
    if (!pixelId) return "";
    const idLit = JSON.stringify(pixelId);
    if (metaTestCode) {
      return `fbq('init',${idLit},${JSON.stringify({ test_event_code: metaTestCode })});fbq('track','PageView');`;
    }
    return `fbq('init',${idLit});fbq('track','PageView');`;
  })();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {loadPixel ? (
          <Script
            id="meta-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
${fbqInit}`,
            }}
          />
        ) : null}
        {children}
      </body>
    </html>
  );
}
