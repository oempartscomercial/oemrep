import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function ClientesPage() {
  const clientes = await prisma.cliente.findMany({
    orderBy: { nomeFantasia: "asc" },
    include: { fabricas: { include: { fabrica: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Clientes</h1>
        <Link href="/cadastros/clientes/novo" className="rounded bg-black px-3 py-2 text-white">
          Novo cliente
        </Link>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="border-b p-2">Nome fantasia</th>
            <th className="border-b p-2">CNPJ</th>
            <th className="border-b p-2">Fábricas</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.id}>
              <td className="border-b p-2">{c.nomeFantasia}</td>
              <td className="border-b p-2">{c.cnpj}</td>
              <td className="border-b p-2">
                {c.fabricas.map((cf) => cf.fabrica.nome).join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
