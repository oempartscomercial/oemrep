import { NavLateral } from "@/components/NavLateral";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <NavLateral />
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
