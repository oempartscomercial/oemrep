import { PageContainer } from "@/components/layouts/page-container";
import { CadastrosNav } from "./cadastros-nav";

export default function CadastrosLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer>
      <CadastrosNav />
      {children}
    </PageContainer>
  );
}
