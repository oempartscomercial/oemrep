import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { RouteProvider } from "@/providers/router-provider";
import "./globals.css";
import { cx } from "@/utils/cx";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "OEM Representações",
  description: "Gestão de representação comercial",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={cx(inter.variable, "h-full")}>
      <body className="bg-primary text-primary flex min-h-full flex-col antialiased">
        <RouteProvider>{children}</RouteProvider>
      </body>
    </html>
  );
}
