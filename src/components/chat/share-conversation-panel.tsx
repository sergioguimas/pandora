"use client";

import { useMemo, useState } from "react";
import {
  addConversationParticipantAction,
  removeConversationParticipantAction,
} from "@/server/actions/chat-actions";
import { cn } from "@/lib/utils";
import { Users, UserPlus, X, Shield, UserMinus, Check, Search } from "lucide-react";

type OrganizationMember = {
  user_id: string;
  role: "owner" | "admin" | "member";
  created_at: string;
  nome: string | null;
  email: string | null;
  avatar_url: string | null;
};

type ConversationParticipant = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "owner" | "member";
  created_at: string;
  nome: string | null;
  email: string | null;
  avatar_url: string | null;
};

type ShareConversationPanelProps = {
  conversationId: string;
  agentSlug: string;
  currentUserId: string;
  members: OrganizationMember[];
  participants: ConversationParticipant[];
  isOwner: boolean;
};

function displayName(user: {
  nome: string | null;
  email: string | null;
  user_id: string;
}) {
  return user.nome || user.email || user.user_id;
}

type MemberComboboxProps = {
  members: OrganizationMember[];
  selectedUserId: string;
  onSelect: (userId: string) => void;
};

function MemberCombobox({
  members,
  selectedUserId,
  onSelect,
}: MemberComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selectedMember = members.find(
    (member) => member.user_id === selectedUserId
  );

  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return members;

    return members.filter((member) => {
      return (
        (member.nome ?? "").toLowerCase().includes(normalized) ||
        (member.email ?? "").toLowerCase().includes(normalized) ||
        member.user_id.toLowerCase().includes(normalized)
      );
    });
  }, [members, query]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-md border border-input bg-surface-2 px-3 text-left text-sm text-foreground outline-none transition-colors hover:bg-surface-3"
      >
        <span className="min-w-0 truncate">
          {selectedMember
            ? `${displayName(selectedMember)}${
                selectedMember.email ? ` — ${selectedMember.email}` : ""
              }`
            : "Selecione um membro"}
        </span>

        {selectedMember ? (
          <X
            className="h-4 w-4 shrink-0 text-muted-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onSelect("");
              setQuery("");
            }}
          />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open ? (
        <div className="mt-2 w-full overflow-hidden rounded-md border border-border bg-surface-2 shadow-lg">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome ou email…"
                className="h-9 w-full rounded-md border border-input bg-surface-1 px-9 text-sm text-foreground outline-none transition-colors focus:border-ring"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {filteredMembers.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                Nenhum membro encontrado.
              </div>
            ) : (
              filteredMembers.map((member) => {
                const selected = member.user_id === selectedUserId;

                return (
                  <button
                    key={member.user_id}
                    type="button"
                    onClick={() => {
                      onSelect(member.user_id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition",
                      selected
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {displayName(member)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.email || member.user_id}
                      </p>
                    </div>

                    {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ShareConversationPanel({
  conversationId,
  agentSlug,
  currentUserId,
  members,
  participants,
  isOwner,
}: ShareConversationPanelProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  const participantIds = useMemo(
    () => new Set(participants.map((p) => p.user_id)),
    [participants]
  );

  const availableMembers = useMemo(
    () => members.filter((m) => !participantIds.has(m.user_id)),
    [members, participantIds]
  );

  async function copyConversationLink() {
    const url = `${window.location.origin}/chat/${agentSlug}?conversation=${conversationId}`;

    await navigator.clipboard.writeText(url);

    setCopied(true);

    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground active:scale-[0.99]"
      >
        <Users className="h-4 w-4" />
        Compartilhar
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface-1 shadow-lg">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                  <UserPlus className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    Participantes
                  </h3>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    gestão de acesso
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] space-y-5 overflow-y-auto px-5 py-5">
              <button
                type="button"
                onClick={copyConversationLink}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
              >
                {copied ? "Link copiado ✓" : "Copiar link da conversa"}
              </button>
              
              {/* Listagem de Participantes */}
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {participants.length} participante(s) nesta conversa
                </p>
                
                {participants.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum participante encontrado.
                  </div>
                ) : (
                  participants.map((participant) => {
                    const isSelf = participant.user_id === currentUserId;
                    const removable = isOwner && participant.role !== "owner" && !isSelf;

                    return (
                      <div
                        key={participant.id}
                        className="group flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2.5 transition-colors hover:border-border-strong"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-3 font-mono text-xs font-semibold text-muted-foreground">
                            {participant.nome?.slice(0, 2).toUpperCase() || "UN"}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {displayName(participant)}{" "}
                              {isSelf && (
                                <span className="font-mono text-xs text-subtle-foreground">
                                  (você)
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="truncate font-mono text-[11px] text-subtle-foreground">
                                {participant.email || "sem e-mail"}
                              </span>
                              <span
                                className={cn(
                                  "flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                                  participant.role === "owner"
                                    ? "bg-primary-soft text-primary"
                                    : "bg-surface-3 text-muted-foreground"
                                )}
                              >
                                <Shield className="h-2.5 w-2.5" />
                                {participant.role === "owner" ? "dono" : "membro"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {removable && (
                          <form action={removeConversationParticipantAction}>
                            <input type="hidden" name="conversationId" value={conversationId} />
                            <input type="hidden" name="agentSlug" value={agentSlug} />
                            <input type="hidden" name="participantUserId" value={participant.user_id} />
                            <button
                              type="submit"
                              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-90"
                              aria-label="Remover participante"
                            >
                              <UserMinus className="h-4 w-4" />
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })
                )}
              </div>



              {/* Adicionar Novo Membro */}
              {isOwner && (
                <div className="border-t border-border pt-5">
                  <p className="mb-3 px-0.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    convidar membro
                  </p>

                  {availableMembers.length === 0 ? (
                    <div className="rounded-md bg-surface-2 px-4 py-4 text-center text-xs text-muted-foreground">
                      Todos os membros já participam desta conversa.
                    </div>
                  ) : (
                    <form
                    action={async (formData) => {
                      setLoading(true);
                      await addConversationParticipantAction(formData);
                      setLoading(false);
                    }} className="space-y-3">
                      <input type="hidden" name="conversationId" value={conversationId} />
                      <input type="hidden" name="agentSlug" value={agentSlug} />

                      <input type="hidden" name="participantUserId" value={selectedUserId} />

                      <MemberCombobox
                        members={availableMembers}
                        selectedUserId={selectedUserId}
                        onSelect={setSelectedUserId}
                      />

                      <button
                        type="submit"
                        disabled={!selectedUserId || loading}
                        className="h-10 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? "Adicionando…" : "Adicionar participante"}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Footer Informativo */}
            {!isOwner && (
              <div className="flex items-center gap-2 border-t border-border bg-surface-2 px-5 py-3">
                <Shield className="h-3 w-3 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground">
                  Somente donos podem gerenciar permissões.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
