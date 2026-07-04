import { NavLateral } from "@/components/NavLateral";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <NavLateral />
      <div className="flex-1 p-8">{children}</div>
    </div>
  );
}
