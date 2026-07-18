"use client";

import { useActionState } from "react";
import {
  createOrganizationAction,
  setOrgActiveAction,
} from "@/server/actions/admin-actions";
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="dias_ativos" className="text-xs font-medium text-foreground">
                Dias ativos
              </label>
              <input
                id="dias_ativos"
                name="dias_ativos"
                type="number"
                min={1}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                placeholder="ex.: 30 (vazio = sem prazo)"
              />
            </div>
            <div>
              <label htmlFor="key_mode" className="text-xs font-medium text-foreground">
                Chave de API
              </label>
              <select
                id="key_mode"
                name="key_mode"
                defaultValue="platform"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="platform">Do sistema (plataforma)</option>
                <option value="own">Própria (a org cadastra a dela)</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            No modo <strong>própria</strong>, a org precisa cadastrar a chave antes de gerar —
            a geração é bloqueada até lá.
          </p>

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
            <OrgRow key={org.id} org={org} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function prazoLabel(org: OrganizationSummary): string {
  if (org.diasRestantes === null) return "sem prazo";
  if (org.diasRestantes <= 0) return "expirada";
  return `${org.diasRestantes} ${org.diasRestantes === 1 ? "dia" : "dias"} restantes`;
}

function OrgRow({ org }: { org: OrganizationSummary }) {
  const [state, toggle, pending] = useActionState(setOrgActiveAction, initial);

  const expirada = org.diasRestantes !== null && org.diasRestantes <= 0;
  const efetivamenteAtiva = org.isActive && !expirada;

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground">{org.name}</span>
          {org.isSystem && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
              sistema
            </span>
          )}
          {!efetivamenteAtiva && !org.isSystem && (
            <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] uppercase text-destructive">
              {expirada ? "expirada" : "desativada"}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span>{org.memberCount} {org.memberCount === 1 ? "membro" : "membros"}</span>
          <span>{prazoLabel(org)}</span>
          <span>
            chave: {org.hasOwnKey ? "própria" : "do sistema"}
            {org.keyMode === "own" && !org.hasOwnKey ? " (pendente!)" : ""}
          </span>
        </div>
      </div>

      {!org.isSystem && (
        <form action={toggle} className="shrink-0">
          <input type="hidden" name="organization_id" value={org.id} />
          <input type="hidden" name="active" value={(!org.isActive).toString()} />
          <button
            type="submit"
            disabled={pending}
            className={
              org.isActive
                ? "text-xs text-destructive hover:underline disabled:opacity-50"
                : "text-xs text-emerald-600 hover:underline disabled:opacity-50 dark:text-emerald-400"
            }
          >
            {pending ? "…" : org.isActive ? "Desativar" : "Reativar"}
          </button>
          {state.error && <span className="ml-2 text-xs text-destructive">{state.error}</span>}
        </form>
      )}
    </li>
  );
}
