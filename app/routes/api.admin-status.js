import { json } from "@remix-run/node";
import prisma   from "../db.server";        // ← adjust path if needed

/* 60 seconds – if no heartbeat arrives in this window the admin is considered offline */
const STALE_THRESHOLD_MS = 60_000;

export const loader = async ({ request }) => {
  const url  = new URL(request.url);
  const shop = url.searchParams.get("shop");

  /* no shop param → just return offline, don't crash */
  if (!shop) {
    return json({ online: false });
  }

  const record = await prisma.adminStatus.findUnique({
    where: { shop },
  });

  /* row doesn't exist → admin has never been online */
  if (!record) {
    return json({ online: false });
  }

  /* explicit offline flag set by the admin's beforeunload handler */
  if (!record.isOnline) {
    return json({ online: false });
  }

  /* staleness check – heartbeat too old */
  const elapsed = Date.now() - new Date(record.lastHeartbeat).getTime();

  if (elapsed >= STALE_THRESHOLD_MS) {
    return json({ online: false });
  }

  /* all checks passed */
  return json({ online: true });
};