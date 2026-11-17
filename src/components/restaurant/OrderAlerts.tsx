// Alerts on this phone when an order is ready or on its way (owner, 17 Nov; doc 15 §23.6-§23.7):
// the store pushes to every member's signed-in browser. Subscribing while signed in links the
// browser to this person (the store reads the session on POST /public/push/subscribe). Already
// allowed: re-linked quietly once per visit, in case the browser was first subscribed for a shop
// order. Not supported or blocked: nothing is shown.
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { Muted, PortalButton, PortalCard } from "./portalUi";
import { getPushPermissionState, subscribeToPush } from "@/lib/pushNotifications";
import { getPublicVapidPublicKey, subscribeCustomerPush } from "@/services/pushApi";

const LINKED_KEY = "mpk_restaurant_push_linked";

async function subscribeMe() {
  const key = await getPublicVapidPublicKey();
  if (!key) throw new Error("Alerts aren't set up yet. Try again later.");
  await subscribeCustomerPush(await subscribeToPush(key));
}

export function OrderAlerts() {
  const [state, setState] = useState(() => getPushPermissionState());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state !== "granted") return;
    try {
      if (window.sessionStorage.getItem(LINKED_KEY)) return;
      window.sessionStorage.setItem(LINKED_KEY, "1");
    } catch {
      /* storage blocked: link anyway */
    }
    void subscribeMe().catch(() => undefined);
  }, [state]);

  if (state !== "default") return null;

  async function enable() {
    setBusy(true);
    try {
      await subscribeMe();
      setState(getPushPermissionState());
      toast.success("Alerts are on for this phone.");
    } catch (e) {
      setState(getPushPermissionState());
      toast.error(e instanceof Error ? e.message : "Couldn't turn on alerts.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalCard aria-labelledby="h-alerts">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="h-alerts" className="text-[16px] font-bold">
            Get an alert when an order is on its way
          </h2>
          <Muted className="mt-0.5 text-[13.5px]">
            On this phone or computer, when Moments has your order ready or sends it out.
          </Muted>
          <PortalButton
            variant="secondary"
            className="mt-2"
            onClick={() => void enable()}
            disabled={busy}
          >
            {busy ? "Turning on…" : "Turn on alerts"}
          </PortalButton>
        </div>
      </div>
    </PortalCard>
  );
}
