"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Define a senha do usuário JÁ AUTENTICADO (a sessão veio do /auth/confirm).
// Serve tanto para o convite (primeira senha) quanto para a recuperação — o
// Supabase trata os dois como "atualizar a senha do usuário logado".

export function SetPasswordForm() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string>();
  const [salvando, setSalvando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) return setErro("A senha precisa de ao menos 8 caracteres.");
    if (senha !== confirma) return setErro("As senhas não coincidem.");

    setErro(undefined);
    setSalvando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);

    if (error) {
      setErro("Não foi possível definir a senha. O link pode ter expirado — peça um novo.");
      return;
    }

    router.push("/chat");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="senha" className="text-sm font-medium text-foreground">
          Nova senha
        </label>
        <input
          id="senha"
          type="password"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>
      <div>
        <label htmlFor="confirma" className="text-sm font-medium text-foreground">
          Confirmar senha
        </label>
        <input
          id="confirma"
          type="password"
          autoComplete="new-password"
          value={confirma}
          onChange={(e) => setConfirma(e.target.value)}
          required
          className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <button
        type="submit"
        disabled={salvando}
        className="h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {salvando ? "Salvando…" : "Definir senha e entrar"}
      </button>
    </form>
  );
}
