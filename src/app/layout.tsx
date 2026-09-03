import type { Metadata, Viewport } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
});

const siteDescription =
  "Log focus sessions by activity. Name the block, swipe to start and end, see where the hours went.";

export const metadata: Metadata = {
  title: {
    default: "MyDayInLog",
    template: "%s · MyDayInLog",
  },
  description: siteDescription,
  applicationName: "MyDayInLog",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fdf6ec",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${dmSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-warm-bg font-sans text-ink">
        {children}
      </body>
    </html>
  );
}
