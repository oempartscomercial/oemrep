import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist carrega um worker por caminho relativo em runtime; se o Next o empacota,
  // esse caminho quebra ("Setting up fake worker failed"). Externalizar faz o Next
  // carregá-lo do node_modules, onde o worker existe.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
