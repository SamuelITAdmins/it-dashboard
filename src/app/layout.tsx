import type { Metadata } from "next";
import { Carlito } from "next/font/google";
import "./globals.css";

// TODO: switch to Calibri
const carlito = Carlito({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "IT Team Dashboard",
  description: "A dahsboard for displaying and interacting with SE's IT Team services data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${carlito.className}`}
      >
        {children}
      </body>
    </html>
  );
}
