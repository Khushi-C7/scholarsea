import { requireUser } from "@/lib/auth/guards";
import { getDecryptedKey } from "@/lib/preferences/service";
import { testConnection } from "@/lib/ai/connection-test";
import { testConnectionSchema } from "@/lib/validation/settings";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/**
 * Test a provider connection. Uses a freshly-typed key if supplied, otherwise
 * the stored (decrypted, server-only) key. The key is never returned.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(req, testConnectionSchema);
    const key = input.key ?? (await getDecryptedKey(user.id, input.providerId));
    if (!key) {
      return json({
        ok: false,
        latencyMs: null,
        message: "No API key available for this provider. Save a key first.",
      });
    }
    const result = await testConnection({
      providerId: input.providerId,
      modelId: input.modelId,
      key,
      baseUrl: input.baseUrl,
    });
    return json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
