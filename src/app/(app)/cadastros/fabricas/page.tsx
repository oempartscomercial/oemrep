import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function FabricasPage() {
  const fabricas = await prisma.fabrica.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Fábricas</h1>
        <Link href="/cadastros/fabricas/novo" className="rounded bg-black px-3 py-2 text-white">
          Nova fábrica
        </Link>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="border-b p-2">Nome</th>
            <th className="border-b p-2">CNPJ</th>
          </tr>
        </thead>
        <tbody>
          {fabricas.map((f) => (
            <tr key={f.id}>
              <td className="border-b p-2">{f.nome}</td>
              <td className="border-b p-2">{f.cnpj}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
