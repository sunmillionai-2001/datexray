import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import "@fontsource/geist/latin-400.css";
import "@fontsource/geist/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "DateXray 运营工作台",
  description: "DateXray 本地内容运营工作台。",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="zh-CN"><body><AppShell>{children}</AppShell></body></html>;
}
