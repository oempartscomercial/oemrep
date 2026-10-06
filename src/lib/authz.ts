export type PerfilUsuario = "OPERADOR" | "ANALISTA" | "ADMIN";

export type UsuarioAcesso = {
  perfil: PerfilUsuario;
  fabricasIds: string[];
};

export function podeAcessarFabrica(usuario: UsuarioAcesso, fabricaId: string): boolean {
  if (usuario.perfil === "ADMIN") return true;
  return usuario.fabricasIds.includes(fabricaId);
}

export function filtroFabricasPermitidas(usuario: UsuarioAcesso): string[] | null {
  if (usuario.perfil === "ADMIN") return null;
  return usuario.fabricasIds;
}

// CRM (ADR-013 §6): ADMIN e ANALISTA veem todas as empresas e os funis; OPERADOR não vê o CRM.
export function podeVerCrm(usuario: Pick<UsuarioAcesso, "perfil">): boolean {
  return usuario.perfil !== "OPERADOR";
}
