import type { Metadata } from "next";
import { PwaRegister } from "@/components/pwa-register";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "FaryTale",
  description: "A private family storybook shelf.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
