import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-user";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/chat");
  }

  redirect("/login");
}