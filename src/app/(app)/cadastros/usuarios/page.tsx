import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";

export default async function UsuariosPage() {
  const usuarioLogado = await obterUsuarioLogado();

  if (!usuarioLogado || usuarioLogado.perfil !== "ADMIN") {
    return <p className="text-sm text-red-600">Acesso restrito a administradores.</p>;
  }

  const usuarios = await prisma.usuario.findMany({
    orderBy: { nome: "asc" },
    include: { fabricas: { include: { fabrica: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Usuários</h1>
        <Link href="/cadastros/usuarios/novo" className="rounded bg-black px-3 py-2 text-white">
          Novo usuário
        </Link>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="border-b p-2">Nome</th>
            <th className="border-b p-2">E-mail</th>
            <th className="border-b p-2">Perfil</th>
            <th className="border-b p-2">Fábricas</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id}>
              <td className="border-b p-2">{u.nome}</td>
              <td className="border-b p-2">{u.email}</td>
              <td className="border-b p-2">{u.perfil}</td>
              <td className="border-b p-2">
                {u.fabricas.map((uf) => uf.fabrica.nome).join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
