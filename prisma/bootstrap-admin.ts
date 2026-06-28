import { prisma } from "../src/lib/prisma";

const [supabaseUserId, nome, email] = process.argv.slice(2);

if (!supabaseUserId || !nome || !email) {
  console.error(
    'Uso: npx tsx prisma/bootstrap-admin.ts "<supabaseUserId>" "<nome>" "<email>"',
  );
  process.exit(1);
}

async function main() {
  const usuario = await prisma.usuario.upsert({
    where: { supabaseUserId },
    update: {},
    create: { supabaseUserId, nome, email, perfil: "ADMIN" },
  });
  console.log("Usuário ADMIN criado/confirmado:", usuario.email);
}

main().finally(() => prisma.$disconnect());
