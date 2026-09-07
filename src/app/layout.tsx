import type { Metadata } from "next";
import "./globals.css";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "WeOn AI Process",
  description: "Mapeamento inteligente de processos empresariais.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <TopBar />
        {children}
      </body>
    </html>
  );
}
