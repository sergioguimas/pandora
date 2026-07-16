"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationIdForUser } from "@/server/repositories/organization-members-repository";
import { DEFAULT_RESPONSE_MODE, isResponseMode } from "@/lib/response-mode";

type UpdateAgentState = {
  ok: boolean;
  error?: string;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function generateUniqueAgentSlug(baseName: string): Promise<string> {
  const supabase = await createClient();
  const baseSlug = slugify(baseName) || "novo-agente";

  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const { data, error } = await supabase
      .from("agents")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      throw new Error("Erro ao validar slug do agente.");
    }

    if (!data) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export async function updateAgent(
  _prevState: UpdateAgentState,
  formData: FormData
): Promise<UpdateAgentState> {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const promptBase = String(formData.get("prompt_base") ?? "").trim();
  const ativoValue = String(formData.get("ativo") ?? "false");

  const knowledgeSpaceIdRaw = String(
    formData.get("knowledge_space_id") ?? ""
  ).trim();

  const category = String(formData.get("category") ?? "").trim();

  const modoRespostaRaw = String(formData.get("modo_resposta") ?? "").trim();

  const tagsRaw = String(formData.get("tags") ?? "").trim();

  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  const ativo = ativoValue === "true" || ativoValue === "on";

  if (!id) {
    return {
      ok: false,
      error: "Agente inválido.",
    };
  }

  if (!nome) {
    return {
      ok: false,
      error: "O nome do agente é obrigatório.",
    };
  }

  if (!promptBase) {
    return {
      ok: false,
      error: "O prompt base é obrigatório.",
    };
  }

  // Valida no servidor: o <select> é só conveniência, e um valor inválido bateria
  // na constraint do banco com erro genérico.
  if (!isResponseMode(modoRespostaRaw)) {
    return {
      ok: false,
      error: "Modo de resposta inválido.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("agents")
    .update({
      nome,
      descricao: descricao || null,
      prompt_base: promptBase,
      ativo,
      modo_resposta: modoRespostaRaw,
      knowledge_space_id: knowledgeSpaceIdRaw || null,
      category: category || null,
      tags,
    })
    .eq("id", id);

  if (error) {
    return {
      ok: false,
      error: "Não foi possível salvar o agente.",
    };
  }

  revalidatePath("/agentes");
  revalidatePath("/chat");

  return {
    ok: true,
  };
}

export async function createAgent(): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  const organizationId = await getOrganizationIdForUser(user.id);

  // Space padrão da organização do usuário. Antes isto era o UUID fixo da
  // "Base Geral", o que quebra com spaces por organização (PD-06).
  const { data: defaultSpace } = await supabase
    .from("knowledge_spaces")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_default", true)
    .maybeSingle();

  const baseName = "Novo Agente";
  const slug = await generateUniqueAgentSlug(baseName);

  const { error } = await supabase.from("agents").insert({
    nome: baseName,
    slug,
    organization_id: organizationId,
    descricao: "Novo agente da Pandora.",
    prompt_base:
      "Você é um agente da plataforma Pandora. Responda em português do Brasil de forma clara, útil e profissional.",
    ativo: true,
    provider: "gemini",
    model: "gemini-2.5-flash",
    temperature: 0.7,
    max_history_messages: 12,
    modo_resposta: DEFAULT_RESPONSE_MODE,
    category: null,
    tags: [],
    knowledge_space_id: defaultSpace?.id ?? null,
  });

  if (error) {
    console.error("Erro ao criar agente:", error);
    throw new Error(error.message || "Não foi possível criar o agente.");
  }
  revalidatePath("/agentes");
  revalidatePath("/chat");

  redirect(`/agentes?slug=${slug}`);
}

export async function deleteAgent(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    throw new Error("Agente inválido.");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("agents")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error("Não foi possível excluir o agente.");
  }

  revalidatePath("/agentes");
  revalidatePath("/chat");

  redirect("/agentes");
}