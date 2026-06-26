import Link from "next/link";

export default function CadastrosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-4 border-b pb-2">
        <Link href="/cadastros/fabricas">Fábricas</Link>
        <Link href="/cadastros/clientes">Clientes</Link>
        <Link href="/cadastros/usuarios">Usuários</Link>
      </nav>
      {children}
    </div>
  );
}
