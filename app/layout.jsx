import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata = {
  title: "tego · Verify",
  description: "Verify before sending a private message to tego.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
