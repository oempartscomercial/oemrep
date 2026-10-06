"use client";

// Último recurso: falha no próprio layout raiz. Sem os componentes do app (eles
// podem ser a causa), só HTML simples.
export default function ErroGeral({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 32 }}>
        <h1 style={{ fontSize: 20 }}>O sistema não conseguiu abrir</h1>
        <p>Tente de novo em instantes. Se continuar, avise o administrador{error.digest ? ` (código ${error.digest})` : ""}.</p>
        <button onClick={reset} style={{ marginTop: 12, padding: "8px 16px" }}>
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
