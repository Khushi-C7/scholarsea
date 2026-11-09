import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/guards";
import { exportUserData, deleteUserData } from "@/lib/preferences/data-management";
import { handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/** Download a full JSON export of the user's research data. */
export async function GET() {
  try {
    const user = await requireUser();
    const data = await exportUserData(user.id);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="scholarsea-export-${new Date()
          .toISOString()
          .slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Permanently delete the user's research data (keeps the account). */
export async function DELETE() {
  try {
    const user = await requireUser();
    await deleteUserData(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
