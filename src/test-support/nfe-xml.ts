// XML mínimo de NFe para testes de integração (mesma estrutura lida por extrairNFeDoXml).
export type ItemXml = { referencia: string; descricao?: string; quantidade: number; valorUnitario: number };

export function montarXmlNFe(dados: {
  chaveAcesso: string;
  numero: string;
  emitenteCnpj: string;
  destinatarioCnpj: string;
  itens: ItemXml[];
}): string {
  const total = dados.itens.reduce((soma, i) => soma + i.quantidade * i.valorUnitario, 0);
  const dets = dados.itens
    .map(
      (item, i) => `
      <det nItem="${i + 1}">
        <prod>
          <cProd>${item.referencia}</cProd>
          <xProd>${item.descricao ?? "Peça"}</xProd>
          <qCom>${item.quantidade.toFixed(4)}</qCom>
          <vUnCom>${item.valorUnitario.toFixed(2)}</vUnCom>
        </prod>
      </det>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${dados.chaveAcesso}" versao="4.00">
      <ide>
        <nNF>${dados.numero}</nNF>
        <dhEmi>2026-07-01T10:00:00-03:00</dhEmi>
      </ide>
      <emit><CNPJ>${dados.emitenteCnpj}</CNPJ></emit>
      <dest><CNPJ>${dados.destinatarioCnpj}</CNPJ></dest>${dets}
      <total>
        <ICMSTot>
          <vProd>${total.toFixed(2)}</vProd>
          <vNF>${total.toFixed(2)}</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;
}
