import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAG } from "@/lib/config";

/**
 * Вебхук мгновенной ревалидации (ТЗ, задача 3). WP-плагин unitr-articles вызывает его при публикации,
 * изменении, снятии с публикации и удалении статьи рубрики, а также при изменении рубрик.
 * Даже если вебхук не дошёл, кеш истекает сам не позже чем через REVALIDATE_SECONDS (≤ 900 с).
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const given = req.headers.get("x-revalidate-secret") || new URL(req.url).searchParams.get("secret");
  if (!secret || given !== secret) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  revalidateTag(CACHE_TAG);
  revalidatePath("/", "layout");
  return Response.json({ ok: true, revalidated: new Date().toISOString() });
}
