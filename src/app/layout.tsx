import type { Metadata } from "next";
import "./globals.css";

import CookieBanner from "@/components/CookieBanner";

export const metadata: Metadata = {
  title: "Reserva Quadra - Condomínio Júlio Prestes",
  description: "Agendamento de horários para a quadra",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased text-gray-900 bg-gray-50">
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
