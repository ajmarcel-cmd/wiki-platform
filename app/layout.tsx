import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wiki - Knowledge Base",
  description: "A scalable wiki platform built with Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=1024, initial-scale=1" />
      </head>
      <body className={`${inter.className} antialiased bg-gray-50 min-w-[1024px]`}>
        <Header />
        <main className="min-h-screen max-w-[1024px] mx-auto px-4">
          {children}
        </main>
        <footer className="border-t bg-white mt-12">
          <div className="max-w-[1024px] mx-auto px-4 py-6 text-center text-sm text-gray-600">
            <p>Powered by Next.js • Scalable Wiki Platform</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
