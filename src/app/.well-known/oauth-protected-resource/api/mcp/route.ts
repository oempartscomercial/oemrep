import { GET as metadados, OPTIONS as preflight } from "../../route";

// Variante com o caminho do recurso (RFC 9728 §3.1): o Claude Code procura aqui primeiro.
export const dynamic = "force-dynamic";
export const GET = metadados;
export const OPTIONS = preflight;
