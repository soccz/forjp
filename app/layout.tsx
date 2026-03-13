import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "COUPLE | Transit-first date planner",
  description:
    "대중교통 기반 데이트 코스를 설계하고 P/J 모드로 운영하는 한국형 데이트 플래너",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
