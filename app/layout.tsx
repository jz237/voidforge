import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol.split(",")[0]}://${host.split(",")[0]}`;
  const title = "VOIDFORGE — The Dread Engine Awaits";
  const description = "Mine Flux Shards, stop the Dread Engine, and survive a high-resolution multidirectional arcade battle.";

  return {
    title: {
      default: "VOIDFORGE",
      template: "%s · VOIDFORGE",
    },
    description,
    openGraph: {
      type: "website",
      title,
      description,
      images: [{ url: `${origin}/og.png`, width: 1672, height: 941, alt: "VOIDFORGE key art" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#03040b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
