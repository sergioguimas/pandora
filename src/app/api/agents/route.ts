import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agents")
    .select("id, nome")
    .eq("ativo", true);

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar agentes" }, { status: 500 });
  }

  return NextResponse.json({ agents: data });
}