import { prisma } from "@/lib/prisma";
import { compararCampos } from "@/domain/auditoria/evento";
import { validarCadastroEmpresa, type EntradaCadastroEmpresa } from "@/domain/crm/cadastro";

/**
 * Edita o cadastro da empresa a partir da ficha. Mesmas regras do cadastro de clientes
 * (CNPJ único, vínculos de fábrica sincronizados, auditoria por campo), mas aceita empresa
 * em prospecção sem fábrica e grava também local, site e as demais propriedades.
 */
export async function editarCadastroEmpresa(usuarioId: string, id: string, entrada: EntradaCadastroEmpresa): Promise<{ erros: string[] }> {
  const atual = await prisma.cliente.findUnique({ where: { id }, include: { fabricas: { select: { fabricaId: true } } } });
  if (!atual) return { erros: ["Empresa não encontrada."] };

  const fabricasIds = [...new Set(entrada.fabricasIds)].sort();
  const { erros, dados } = validarCadastroEmpresa({ ...entrada, fabricasIds }, atual.situacao);
  if (erros.length > 0) return { erros };

  if (dados.cnpj) {
    const dono = await prisma.cliente.findUnique({ where: { cnpj: dados.cnpj }, select: { id: true, nomeFantasia: true } });
    if (dono && dono.id !== id) return { erros: [`Já existe uma empresa com este CNPJ: ${dono.nomeFantasia}.`] };
  }
  if (fabricasIds.length > 0 && (await prisma.fabrica.count({ where: { id: { in: fabricasIds } } })) !== fabricasIds.length) {
    return { erros: ["Uma das fábricas selecionadas não existe mais. Recarregue a página."] };
  }

  const fabricasAtuais = atual.fabricas.map((f) => f.fabricaId).sort();
  const antes = { ...Object.fromEntries(Object.keys(dados).map((k) => [k, atual[k as keyof typeof dados]])), fabricasIds: fabricasAtuais.join(",") };
  const depois = { ...dados, fabricasIds: fabricasIds.join(",") };

  await prisma.$transaction(async (tx) => {
    await tx.cliente.update({ where: { id }, data: dados });
    // Vínculos removidos saem; os novos entram com o padrão (RN23); os mantidos ficam como estão.
    await tx.clienteFabrica.deleteMany({ where: { clienteId: id, fabricaId: { notIn: fabricasIds } } });
    await tx.clienteFabrica.createMany({ data: fabricasIds.filter((f) => !fabricasAtuais.includes(f)).map((fabricaId) => ({ clienteId: id, fabricaId })) });
    await tx.eventoAuditoria.createMany({ data: compararCampos("Cliente", id, usuarioId, antes, depois) });
  });
  return { erros: [] };
}
