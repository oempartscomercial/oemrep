import { NextResponse } from "next/server";

const CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function respostaXlsx(buffer: Buffer, arquivo: string) {
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: { "Content-Type": CONTENT_TYPE, "Content-Disposition": `attachment; filename="${arquivo}"` },
  });
}
