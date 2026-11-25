import { SolaSeal } from "@/components/layout/sola-seal";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <SolaSeal className="absolute bottom-6 left-1/2 -translate-x-1/2" />
    </div>
  );
}
