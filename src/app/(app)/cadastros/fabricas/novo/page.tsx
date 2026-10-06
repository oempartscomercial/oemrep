import { criarFabrica } from "../actions";
import { FormularioFabrica } from "../formulario-fabrica";

export default function NovaFabricaPage() {
  return <FormularioFabrica titulo="Nova fábrica" acao={criarFabrica} />;
}
