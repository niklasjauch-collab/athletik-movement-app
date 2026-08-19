import type { MetadataRoute } from "next";
import { getBranding } from "@/lib/branding";

// Next.js App Router generates /manifest.webmanifest from this file.
// Because it reads from getBranding(), every tenant will eventually get
// its own installable PWA identity (name, icon, color) without a rebuild —
// see the TODO in src/lib/branding.ts.
export default function manifest(): MetadataRoute.Manifest {
  const branding = getBranding();

  return {
    name: branding.appName,
    short_name: branding.appName,
    description: branding.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: branding.primaryColor,
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
