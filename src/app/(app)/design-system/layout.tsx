import { notFound } from "next/navigation";

// Catálogo visual para desenvolvimento: não existe em produção.
export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
