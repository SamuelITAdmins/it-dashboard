import type { Metadata } from "next";
import { Carlito } from "next/font/google";
import "./globals.css";

// TODO: switch to Calibri
const carlito = Carlito({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-carlito',
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
    <html lang="en" className={carlito.className}>
      <body>
        {children}
      </body>
    </html>
  );
}
