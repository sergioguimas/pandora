"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type UpdateAgentState = {
  ok: boolean;
  error?: string;
};

export async function updateAgent(
  _prevState: UpdateAgentState,
  formData: FormData
): Promise<UpdateAgentState> {
  const id = String(formData.get("id") ?? "");
  const descricao = String(formData.get("descricao") ?? "").trim();
  const promptBase = String(formData.get("prompt_base") ?? "").trim();
  const ativoValue = String(formData.get("ativo") ?? "false");

  const ativo = ativoValue === "true" || ativoValue === "on";

  if (!id) {
    return {
      ok: false,
      error: "Agente inválido.",
    };
  }

  if (!promptBase) {
    return {
      ok: false,
      error: "O prompt base é obrigatório.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("agents")
    .update({
      descricao: descricao || null,
      prompt_base: promptBase,
      ativo,
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