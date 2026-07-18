import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Processa o link de e-mail do Supabase (convite, recuperação, magic link) e
// estabelece a sessão. É para onde os templates de e-mail devem apontar:
//
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=/definir-senha
//
// POR QUE token_hash + verifyOtp (e não o `code`/PKCE)
// O fluxo PKCE precisa de um `code_verifier` gravado no navegador quando o fluxo
// COMEÇA. Um link de e-mail (convite mandado pelo admin, "esqueci a senha") não
// tem esse início no browser do usuário — então o `exchangeCodeForSession`
// falharia. O `verifyOtp` com token_hash é o fluxo desenhado para links de
// e-mail com SSR. Mantemos um fallback para `code` por robustez.

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  // `next` sempre relativo (começa com "/"), para não virar open-redirect.
  const nextParam = searchParams.get("next") ?? "/definir-senha";
  const next = nextParam.startsWith("/") ? nextParam : "/definir-senha";

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/login?error=link_invalido", origin));
}
