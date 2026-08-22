import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./auth.css";
import "./premium.css";
import "./deal-premium.css";
import MobileNav from "./mobile-nav";

const SITE_URL = "https://rahul-dev-studio-client-management.vercel.app";
const RDS_LOGO_URL = "https://raw.githubusercontent.com/rahul-dev-web/Rahul-Dev-Studio/main/public/brand/logo.png";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "RDS Client Management",
    template: "%s | RDS Client Management",
  },
  description: "Rahul Development Studio workspace for deals, agreements, projects, client portals and delivery management.",
  applicationName: "RDS Client Management",
  icons: { icon: RDS_LOGO_URL, apple: RDS_LOGO_URL },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#111318",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<MobileNav /></body>
    </html>
  );
}
