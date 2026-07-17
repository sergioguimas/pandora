import Link from "next/link";
import { cn } from "@/lib/utils";

// Nav das telas de configuração/admin. Server component puro. Não é injetada no
// layout do dashboard de propósito — o chat é full-screen e não deve ganhar uma
// barra global. Cada página de config renderiza isto no topo, então uma leva à
// outra sem depender de um menu central (que fica como follow-up de navegação).

type Props = {
  active: "admin" | "membros" | "chaves";
  isPlatformAdmin?: boolean;
};

const linkClass = (isActive: boolean) =>
  cn(
    "rounded-md px-3 py-1.5 text-sm transition-colors",
    isActive
      ? "bg-primary-soft text-foreground"
      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
  );

export function SettingsNav({ active, isPlatformAdmin }: Props) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1 border-b border-border pb-3">
      <Link href="/chat" className={linkClass(false)}>
        ← Voltar
      </Link>
      <span className="mx-1 text-border">|</span>
      <Link href="/configuracoes/membros" className={linkClass(active === "membros")}>
        Membros
      </Link>
      <Link href="/configuracoes/chaves" className={linkClass(active === "chaves")}>
        Chaves de API
      </Link>
      {isPlatformAdmin && (
        <Link href="/admin" className={linkClass(active === "admin")}>
          Admin da plataforma
        </Link>
      )}
    </nav>
  );
}
