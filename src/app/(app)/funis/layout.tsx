import { GuardaCrm } from "@/components/crm/guarda-crm";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <GuardaCrm>{children}</GuardaCrm>;
}
