import Link from "next/link";
import { RecoverForm } from "./recover-form";

export default function RecuperarSenhaPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="text-lg font-semibold text-foreground">Acesso à conta</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Informe seu e-mail e enviaremos um link para definir sua senha. Serve tanto para o
        primeiro acesso (convite) quanto para recuperar a senha.
      </p>

      <RecoverForm />

      <Link href="/login" className="mt-6 text-center text-sm text-primary hover:underline">
        Voltar para o acesso
      </Link>
    </main>
  );
}
