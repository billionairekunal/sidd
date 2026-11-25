import { Manrope } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";

const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata = {
  title: "Siddheshwer Transport — Transport ERP",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
