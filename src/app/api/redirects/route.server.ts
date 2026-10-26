import { getRedirects } from "@/lib/content";

/** Карта «прежний slug → актуальный» для middleware. Кешируется вместе с данными раздела. */
export const dynamic = "force-static";
export const revalidate = 300;

export async function GET() {
  return Response.json(await getRedirects());
}
