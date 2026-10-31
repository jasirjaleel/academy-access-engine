import type { Metadata } from "next";
import { Inter, Noto_Naskh_Arabic } from "next/font/google";
import { BackgroundPattern } from "@/components/background-pattern";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const naskh = Noto_Naskh_Arabic({
  variable: "--font-naskh",
  subsets: ["arabic"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Demo Academy",
  description: "Learn Arabic and the Islamic sciences, at your pace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${naskh.variable} h-full antialiased`}
    >
      <body className="relative flex min-h-full flex-col font-sans">
        <BackgroundPattern />
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
