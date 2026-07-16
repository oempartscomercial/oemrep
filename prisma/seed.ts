import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.parametro.upsert({
    where: { chave: "prazo_alerta_sem_nfe_dias" },
    update: { valor: "7" },
    create: { chave: "prazo_alerta_sem_nfe_dias", valor: "7" },
  });
  await prisma.parametro.upsert({
    where: { chave: "prazo_chamado_critico_dias" },
    update: { valor: "30" },
    create: { chave: "prazo_chamado_critico_dias", valor: "30" },
  });

  const motivosDivergencia = [
    "Itens errados",
    "Item faltando",
    "Item quebrado",
    "Acionar garantia",
    "NFe com valor errado",
    "Extravio",
  ];
  for (const nome of motivosDivergencia) {
    await prisma.motivoChamado.upsert({ where: { nome }, update: {}, create: { nome } });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
