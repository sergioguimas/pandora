"use client";

import { useActionState } from "react";
import {
  removeProviderKey,
  saveProviderKey,
} from "@/server/actions/provider-keys-actions";
import type { ProviderKeyView } from "@/server/repositories/provider-keys-repository";

const PROVIDERS: Array<{ id: "gemini" | "openai"; nome: string }> = [
  { id: "gemini", nome: "Google Gemini" },
  { id: "openai", nome: "OpenAI" },
];

const initial = { ok: false as boolean, error: undefined as string | undefined, mensagem: undefined as string | undefined };

export function ProviderKeysForm({ chaves }: { chaves: ProviderKeyView[] }) {
  const porProvider = new Map(chaves.map((c) => [c.provider, c]));

  return (
    <div className="mt-6 space-y-6">
      {/* Salvaguarda: aviso explícito de sensibilidade (pedido do PD-26). */}
      <div
        role="note"
        className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200"
      >
        <strong>Informação sensível.</strong> Uma chave de API é uma credencial de
        cobrança: quem a possui consome a sua cota, e a fatura é sua. Informe-a apenas se
        estiver ciente do risco. Depois de salva, a chave é cifrada e{" "}
        <strong>não poderá ser exibida novamente</strong> — nem por você. Para trocá-la,
        basta informar uma nova.
      </div>

      {PROVIDERS.map((provider) => (
        <ProviderRow
          key={provider.id}
          providerId={provider.id}
          providerNome={provider.nome}
          atual={porProvider.get(provider.id)}
        />
      ))}
    </div>
  );
}

function ProviderRow({
  providerId,
  providerNome,
  atual,
}: {
  providerId: "gemini" | "openai";
  providerNome: string;
  atual?: ProviderKeyView;
}) {
  const [saveState, saveAction, saving] = useActionState(saveProviderKey, initial);
  const [removeState, removeAction, removing] = useActionState(removeProviderKey, initial);

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">{providerNome}</h2>
        {atual ? (
          <span className="font-mono text-xs text-muted-foreground">
            ••••••••{atual.ultimos4} · configurada
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">usando a chave da plataforma</span>
        )}
      </div>

      <form action={saveAction} className="mt-3 flex gap-2">
        <input type="hidden" name="provider" value={providerId} />
        <input
          type="password"
          name="chave"
          autoComplete="off"
          placeholder={atual ? "Informar uma nova chave para substituir" : "Colar a chave de API"}
          className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </form>

      {atual ? (
        <form action={removeAction} className="mt-2">
          <input type="hidden" name="provider" value={providerId} />
          <button
            type="submit"
            disabled={removing}
            className="text-xs text-destructive hover:underline disabled:opacity-50"
          >
            {removing ? "Removendo…" : "Remover chave (voltar à chave da plataforma)"}
          </button>
        </form>
      ) : null}

      {(saveState.error || removeState.error) && (
        <p className="mt-2 text-xs text-destructive">{saveState.error || removeState.error}</p>
      )}
      {(saveState.mensagem || removeState.mensagem) && (
        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
          {saveState.mensagem || removeState.mensagem}
        </p>
      )}
    </div>
  );
}
