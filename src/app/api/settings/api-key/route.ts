import { requireUser } from "@/lib/auth/guards";
import { setApiKey, clearApiKey, getPreferences } from "@/lib/preferences/service";
import { setApiKeySchema, clearApiKeySchema } from "@/lib/validation/settings";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/**
 * Store an API key for a provider. The key is encrypted server-side before it
 * is persisted and is never echoed back — the response only reports which
 * providers now have a key.
 */
export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const { providerId, key } = await parseJson(req, setApiKeySchema);
    await setApiKey(user.id, providerId, key);
    const prefs = await getPreferences(user.id);
    return json({ providersWithKey: prefs.providersWithKey });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Remove a stored key for a provider. */
export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const { providerId } = await parseJson(req, clearApiKeySchema);
    await clearApiKey(user.id, providerId);
    const prefs = await getPreferences(user.id);
    return json({ providersWithKey: prefs.providersWithKey });
  } catch (err) {
    return handleRouteError(err);
  }
}
