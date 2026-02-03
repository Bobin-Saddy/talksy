import { useEffect, useRef, useCallback } from "react";

/* ── config ── */
const HEARTBEAT_INTERVAL_MS = 30_000;   // 30 seconds between pings
const BASE_URL              = "https://talksy-production-2e93.up.railway.app";
const ENDPOINT              = `${BASE_URL}/api/admin-heartbeat`;

export function useAdminHeartbeat(shop) {
  const intervalRef = useRef(null);

  /* ── single heartbeat POST ── */
  const ping = useCallback(async (online = true) => {
    if (!shop) return;
    try {
      await fetch(ENDPOINT, {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({ shop, isOnline: online }),
      });
    } catch (_) {
      // network error – next tick will retry automatically
    }
  }, [shop]);

  useEffect(() => {
    if (!shop) return;   // nothing to do without a shop

    /* ── 1. immediate first ping ── */
    ping(true);

    /* ── 2. repeat every 30 s ── */
    intervalRef.current = setInterval(() => ping(true), HEARTBEAT_INTERVAL_MS);

    /* ── 3. beforeunload – tab is closing ──
     * navigator.sendBeacon is the ONLY reliable way to send
     * a request during page unload.  fetch() is blocked by
     * most browsers at this point.
     * sendBeacon does NOT support custom headers, so we wrap
     * the JSON in a Blob with the correct MIME type.        */
    const onUnload = () => {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const payload = new Blob(
          [JSON.stringify({ shop, isOnline: false })],
          { type: "application/json" }
        );
        navigator.sendBeacon(ENDPOINT, payload);
      }
    };

    window.addEventListener("beforeunload", onUnload);

    /* ── 4. cleanup when React unmounts this hook ── */
    return () => {
      clearInterval(intervalRef.current);
      window.removeEventListener("beforeunload", onUnload);
      ping(false);   // tell the server we went offline
    };
  }, [shop, ping]);
}