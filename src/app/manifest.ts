import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cloud Duet",
    short_name: "Duet",
    description: "主动帮你做事的工作助手：每天给你简报，在后台干活，动手前先问你。",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F4F4",
    theme_color: "#F4F4F4",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
