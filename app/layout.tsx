import type { Metadata } from "next";
import "./globals.css";
import "./auth.css";
import "./premium.css";
import MobileNav from "./mobile-nav";

export const metadata: Metadata = {
  title: "Rahul Development Studio — Client Management",
  description: "Deal, agreement, e-sign, client portal and project delivery management.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<MobileNav /></body>
    </html>
  );
}
