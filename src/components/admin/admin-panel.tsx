"use client";

import { useActionState } from "react";
import { createOrganizationAction } from "@/server/actions/admin-actions";
import type { OrganizationSummary } from "@/server/repositories/organizations-repository";

const initial = {
  ok: false as boolean,
  error: undefined as string | undefined,
  mensagem: undefined as string | undefined,
};

export function AdminPanel({ organizacoes }: { organizacoes: OrganizationSummary[] }) {
  const [state, action, pending] = useActionState(createOrganizationAction, initial);

  return (
    <div className="mt-6 space-y-8">
      <section className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Nova organização</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          O dono recebe um e-mail para definir a senha e já entra como responsável pela org.
        </p>

        <form action={action} className="mt-4 space-y-3">
          <div>
            <label htmlFor="nome" className="text-xs font-medium text-foreground">
              Nome da organização
            </label>
            <input
              id="nome"
              name="nome"
              required
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="Empresa Exemplo Ltda."
            />
          </div>
          <div>
            <label htmlFor="owner_email" className="text-xs font-medium text-foreground">
              E-mail do dono
            </label>
            <input
              id="owner_email"
              name="owner_email"
              type="email"
              required
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="dono@empresa.com"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Criando…" : "Criar organização e convidar dono"}
          </button>

          {state.error && <p className="text-xs text-destructive">{state.error}</p>}
          {state.mensagem && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">{state.mensagem}</p>
          )}
        </form>
      </section>

      <section>
        <h2 className="text-sm font-medium text-foreground">
          Organizações ({organizacoes.length})
        </h2>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {organizacoes.map((org) => (
            <li key={org.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="text-sm text-foreground">{org.name}</span>
                {org.isSystem && (
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    sistema
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {org.memberCount} {org.memberCount === 1 ? "membro" : "membros"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
