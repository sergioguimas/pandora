import Image from "next/image";

/**
 * Selo da casa (brand/BRANDING.md §9) + assinatura da marca "Soli Deo Gloria" (§2.1):
 * sempre em latim, sem tradução, abaixo do nome.
 */
export function SolaSeal({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://solasoftware.com.br"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex shrink-0 flex-col items-center gap-1 whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground ${className}`}
    >
      <span className="inline-flex items-center gap-1.5 text-[11px]">
        <Image
          src="/brand/sola-icone-claro.webp"
          alt=""
          width={12}
          height={17}
          unoptimized
          className="block h-[17px] w-auto dark:hidden"
        />
        <Image
          src="/brand/sola-icone-escuro.webp"
          alt=""
          width={12}
          height={17}
          unoptimized
          className="hidden h-[17px] w-auto dark:block"
        />
        SolaSoftware
      </span>
      <span
        lang="la"
        className="pl-[0.3em] text-[8px] font-medium uppercase tracking-[0.3em] opacity-70"
      >
        Soli Deo Gloria
      </span>
    </a>
  );
}
