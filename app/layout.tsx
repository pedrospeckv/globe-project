import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  metadataBase: new URL("https://globe-project-roan.vercel.app"),
  title: {
    default: "Atlas — fronteiras de qualquer data entre 123.000 a.C. e hoje",
    template: "%s — Atlas",
  },
  description:
    "Atlas histórico e geopolítico navegável, feito para estudar: um mapa " +
    "que mostra as fronteiras de qualquer data entre 123.000 a.C. e hoje, e " +
    "dossiês por país × período com fonte obrigatória. Open source (MIT + CC BY-SA 4.0).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
