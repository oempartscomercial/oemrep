import { redirect } from "next/navigation";

// "Cadastros" no menu lateral é um agrupamento: quem chega em /cadastros vai para a
// primeira aba. Sem esta página, o trecho tem só layout.tsx e o App Router devolve 404.
export default function CadastrosPage() {
  redirect("/cadastros/fabricas");
}
