import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FaryTale — семейные сказки",
    short_name: "FaryTale",
    description: "Приватная семейная библиотека персональных детских историй.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f2e8",
    theme_color: "#f7f2e8",
    orientation: "any",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
