import { requireUser } from "@/lib/auth/guards";
import { getPreferences, updatePreferences } from "@/lib/preferences/service";
import { getUsageSummary } from "@/lib/usage/service";
import { PROVIDERS } from "@/lib/ai/catalog";
import { updateSettingsSchema } from "@/lib/validation/settings";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/** Current settings + token usage + the provider/model catalog. */
export async function GET() {
  try {
    const user = await requireUser();
    const prefs = await getPreferences(user.id);
    const usage = await getUsageSummary(user.id, prefs.aiProvider, prefs.aiModel);
    return json({ preferences: prefs, usage, providers: PROVIDERS });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Update provider/model/language/theme/prompt customization. No keys here. */
export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const patch = await parseJson(req, updateSettingsSchema);
    const prefs = await updatePreferences(user.id, patch);
    return json({ preferences: prefs });
  } catch (err) {
    return handleRouteError(err);
  }
}
