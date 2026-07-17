"use client";

import { useActionState } from "react";
import {
  inviteMemberAction,
  removeMemberAction,
} from "@/server/actions/members-actions";

type Member = {
  user_id: string;
  role: "owner" | "admin" | "member";
  nome: string | null;
  email: string | null;
};

const initial = {
  ok: false as boolean,
  error: undefined as string | undefined,
  mensagem: undefined as string | undefined,
};

const ROLE_LABEL: Record<Member["role"], string> = {
  owner: "Dono",
  admin: "Admin",
  member: "Membro",
};

export function MembersPanel({
  membros,
  currentUserId,
}: {
  membros: Member[];
  currentUserId: string;
}) {
  const [inviteState, invite, inviting] = useActionState(inviteMemberAction, initial);

  return (
    <div className="mt-6 space-y-6">
      <form action={invite} className="flex gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="email@empresa.com"
          className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <button
          type="submit"
          disabled={inviting}
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {inviting ? "Convidando…" : "Convidar"}
        </button>
      </form>
      {inviteState.error && <p className="text-xs text-destructive">{inviteState.error}</p>}
      {inviteState.mensagem && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">{inviteState.mensagem}</p>
      )}

      <ul className="divide-y divide-border rounded-lg border border-border">
        {membros.map((m) => (
          <MemberRow key={m.user_id} member={m} isSelf={m.user_id === currentUserId} />
        ))}
      </ul>
    </div>
  );
}

function MemberRow({ member, isSelf }: { member: Member; isSelf: boolean }) {
  const [state, remove, removing] = useActionState(removeMemberAction, initial);

  return (
    <li className="flex items-center justify-between px-4 py-3">
      <div className="min-w-0">
        <span className="text-sm text-foreground">
          {member.nome || member.email || member.user_id}
        </span>
        {member.email && member.nome && (
          <span className="ml-2 text-xs text-muted-foreground">{member.email}</span>
        )}
        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
          {ROLE_LABEL[member.role]}
        </span>
      </div>

      {/* Dono não se remove daqui; nem a si mesmo. Some o botão nesses casos. */}
      {member.role !== "owner" && !isSelf ? (
        <form action={remove}>
          <input type="hidden" name="user_id" value={member.user_id} />
          <button
            type="submit"
            disabled={removing}
            className="text-xs text-destructive hover:underline disabled:opacity-50"
          >
            {removing ? "Removendo…" : "Remover"}
          </button>
          {state.error && <span className="ml-2 text-xs text-destructive">{state.error}</span>}
        </form>
      ) : null}
    </li>
  );
}
