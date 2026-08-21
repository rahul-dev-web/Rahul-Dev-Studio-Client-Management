import type { Metadata } from "next";
import "./globals.css";
import "./auth.css";
import "./premium.css";

export const metadata: Metadata = {
  title: "Rahul Development Studio — Client Management",
  description: "Deal, agreement, e-sign, client portal and project delivery management.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
