import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

// Cifra simétrica para a API key do tenant (PD-26).
//
// POR QUE CIFRA E NÃO HASH
// Hash é via de mão única: serve para senha, que só precisa ser COMPARADA. A API
// key precisa ser REENVIADA ao Google/OpenAI a cada chamada — de um hash não sai
// nada. O pedido "após incluir, nem o dono vê a chave" se cumpre não guardando
// hash, mas cifrando e NÃO EXPONDO caminho de leitura: nenhuma action devolve o
// valor decifrado à UI. O único ponto que decifra é a chamada ao provedor.
//
// POR QUE NA APLICAÇÃO E NÃO NO `vault`/pgsodium DO SUPABASE
// O Vault amarra ao Supabase, e sair do Cloud está em avaliação (PD-24). Cifra
// na aplicação é portátil, e o banco nunca vê a chave em claro — um dump vazado
// sozinho não entrega nada. A ressalva honesta: quem tiver o banco E o
// PROVIDER_KEY_SECRET recupera a chave. Isso é inerente a qualquer sistema que
// chame API de terceiro em nome do cliente (é o que GitHub/Stripe fazem).
//
// FORMATO em `chave_cifrada`: v1.<salt>.<iv>.<authTag>.<ciphertext>, tudo base64url.
// O `salt` por registro deixa cada chave num espaço derivado próprio; o prefixo
// de versão abre espaço para rotação de esquema sem migração de dado.

const VERSION = "v1";
const KEY_LEN = 32; // AES-256
const IV_LEN = 12; // GCM recomenda 96 bits
const SALT_LEN = 16;

function masterSecret(): string {
  const secret = process.env.PROVIDER_KEY_SECRET;
  if (!secret || secret.length < 16) {
    // Falha ALTO e cedo: sem segredo forte, cifrar daria falsa sensação de
    // proteção. Não há default — um default seria o mesmo que texto puro.
    throw new Error(
      "PROVIDER_KEY_SECRET ausente ou curto (mín. 16 chars). " +
        "Defina uma string longa e aleatória no ambiente do servidor."
    );
  }
  return secret;
}

function deriveKey(salt: Buffer): Buffer {
  // scrypt encarece a força bruta caso o segredo vaze sem o banco.
  return scryptSync(masterSecret(), salt, KEY_LEN);
}

const b64 = (b: Buffer) => b.toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url");

export function encryptProviderKey(plaintext: string): string {
  if (!plaintext) throw new Error("chave vazia");

  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(salt);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [VERSION, b64(salt), b64(iv), b64(authTag), b64(ciphertext)].join(".");
}

export function decryptProviderKey(stored: string): string {
  const parts = stored.split(".");
  if (parts.length !== 5 || parts[0] !== VERSION) {
    throw new Error("formato de chave cifrada inválido ou versão desconhecida");
  }
  const [, saltB64, ivB64, tagB64, ctB64] = parts;

  const key = deriveKey(unb64(saltB64));
  const decipher = createDecipheriv("aes-256-gcm", key, unb64(ivB64));
  decipher.setAuthTag(unb64(tagB64));

  // Se o segredo estiver errado ou o texto adulterado, `final()` lança — o
  // authTag do GCM é o que garante integridade, não só sigilo.
  return Buffer.concat([decipher.update(unb64(ctB64)), decipher.final()]).toString("utf8");
}

/** Os 4 últimos caracteres, para a UI mostrar `••••4f2c` sem decifrar nada. */
export function lastFour(plaintext: string): string {
  return plaintext.slice(-4);
}
