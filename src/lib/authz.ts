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
