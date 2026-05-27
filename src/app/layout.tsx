import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "礼达 · 节日福利发放系统",
  description: "让每一份节日心意准确送达每一位同事",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-background font-sans">{children}</body>
    </html>
  );
}
