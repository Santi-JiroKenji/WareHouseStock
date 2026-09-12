import { SessionProvider } from "@/components/auth/session-provider";
import type { Metadata } from "next";
import "./globals.scss";
export const metadata: Metadata = {
    title: "WareHouse Stock (ระบบจัดการคลังสินค้า)",
    description: "ระบบรับเข้า เบิกออก และตรวจสอบสินค้าคงคลัง",
    icons: {
        icon: "/favicon.svg",
        shortcut: "/favicon.svg",
    },
};
export default function RootLayout({ children, }: Readonly<{
    children: React.ReactNode;
}>) {
    return (<html lang="th">
      <body className="antialiased"><SessionProvider>{children}</SessionProvider></body>
      {/* <body className="antialiased">{children}</body> */}
    </html>);
}
