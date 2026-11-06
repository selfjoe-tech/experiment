import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default function UploadLayout({ children }: { children: React.ReactNode }) {
  return <div className="relative min-h-screen bg-black text-white">
    <div className="pt-14 lg:pt-20 lg:ml-64 lg:mr-80">{children}</div>
  </div>;
}
