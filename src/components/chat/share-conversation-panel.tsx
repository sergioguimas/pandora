"use client";

import { useMemo, useState } from "react";
import {
  addConversationParticipantAction,
  removeConversationParticipantAction,
} from "@/server/actions/chat-actions";
import { cn } from "@/lib/utils";
import { Users, UserPlus, X, Shield, UserMinus } from "lucide-react";

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

export function ShareConversationPanel({
  conversationId,
  agentSlug,
  currentUserId,
  members,
  participants,
  isOwner,
}: ShareConversationPanelProps) {
  const [open, setOpen] = useState(false);

  const participantIds = useMemo(
    () => new Set(participants.map((p) => p.user_id)),
    [participants]
  );

  const availableMembers = useMemo(
    () => members.filter((m) => !participantIds.has(m.user_id)),
    [members, participantIds]
  );

  console.log(availableMembers);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/40 px-4 py-2 text-sm font-bold text-muted-foreground backdrop-blur-md transition-all hover:bg-accent hover:text-foreground active:scale-95 shadow-sm"
      >
        <Users className="h-4 w-4" />
        Compartilhar
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/40 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-border/60 bg-black/90 shadow-2xl backdrop-blur-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 px-6 py-5 bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-foreground">
                    Participantes
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                    Gestão de Acesso
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
              
              {/* Listagem de Participantes */}
              <div className="space-y-3">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80 px-1">
                  Membros Ativos
                </p>
                
                {participants.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum participante encontrado.
                  </div>
                ) : (
                  participants.map((participant) => {
                    const isSelf = participant.user_id === currentUserId;
                    const removable = isOwner && participant.role !== "owner" && !isSelf;

                    return (
                      <div
                        key={participant.id}
                        className="group flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-background/50 px-4 py-3 transition-all hover:border-primary/30"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
                            {participant.nome?.slice(0, 2).toUpperCase() || "UN"}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-foreground">
                              {displayName(participant)} {isSelf && "(Você)"}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground/60 truncate">
                                {participant.email || "Sem e-mail"}
                              </span>
                              <span className={cn(
                                "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
                                participant.role === "owner" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                              )}>
                                <Shield className="h-2.5 w-2.5" />
                                {participant.role === "owner" ? "Dono" : "Membro"}
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
                              className="rounded-xl p-2 text-muted-foreground transition hover:bg-red-500/10 hover:text-red-500 active:scale-90"
                              title="Remover participante"
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
                <div className="pt-6 border-t border-border/60">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80 px-1 mb-3">
                    Convidar Membro
                  </p>

                  {availableMembers.length === 0 ? (
                    <div className="rounded-2xl bg-muted/30 px-4 py-4 text-xs font-medium text-muted-foreground text-center italic">
                      Todos os membros já participam desta conversa.
                    </div>
                  ) : (
                    <form action={addConversationParticipantAction} className="space-y-4">
                      <input type="hidden" name="conversationId" value={conversationId} />
                      <input type="hidden" name="agentSlug" value={agentSlug} />

                      <select
                        name="participantUserId"
                        className="
                          w-full rounded-xl border border-border
                          bg-background text-foreground
                          px-3 py-2 text-sm
                          outline-none
                        "
                        style={{ colorScheme: "dark" }}
                        defaultValue=""
                        required
                      >
                        <option value="">Selecione um membro</option>

                        {availableMembers.map((member) => (
                          <option key={member.user_id} value={member.user_id}>
                            {displayName(member)}
                            {member.nome && member.email ? ` — ${member.email}` : ""}
                          </option>
                        ))}
                      </select>

                      <button
                        type="submit"
                        className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-[0.98]"
                      >
                        <UserPlus className="h-4 w-4 transition-transform group-hover:scale-110" />
                        Adicionar ao Contexto
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Footer Informativo */}
            {!isOwner && (
              <div className="bg-muted/30 px-6 py-4 flex items-center gap-2">
                <Shield className="h-3 w-3 text-muted-foreground" />
                <p className="text-[11px] font-medium text-muted-foreground leading-none">
                  Somente proprietários podem gerenciar permissões.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}