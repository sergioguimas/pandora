"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Rede de segurança para o fluxo IMPLÍCITO do Supabase (PD-28).
//
// O template padrão usa `{{ .ConfirmationURL }}`, que devolve o token num HASH
// da URL (`#access_token=...&refresh_token=...&type=recovery`) na Site URL. O
// hash NÃO chega ao servidor — só ao navegador —, então a rota /auth/confirm
// (que lê query param via token_hash) não é acionada nesse formato.
//
// Este handler roda no cliente, detecta esse hash, estabelece a sessão e manda
// para /definir-senha. Assim o e-mail funciona mesmo com o template padrão. O
// caminho mais limpo continua sendo o template apontar direto para
// /auth/confirm?token_hash=... (aí este handler nem entra em ação).
//
// Não renderiza nada e não guarda estado (o redirect é imediato) — de propósito,
// para não cair na regra do React Compiler de setState dentro de efeito.

export function AuthHashHandler() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token")) return;

    const params = new URLSearchParams(hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) return;

    const supabase = createClient();
    supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      // Tira o token da barra de endereço de qualquer forma (não fica no
      // histórico), e segue para definir a senha se deu certo.
      window.location.replace(error ? "/login?error=link_invalido" : "/definir-senha");
    });
  }, []);

  return null;
}
