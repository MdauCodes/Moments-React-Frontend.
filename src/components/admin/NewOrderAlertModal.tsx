import { useEffect } from "react";
import { BellRing } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAdminOrders } from "@/contexts/AdminOrdersContext";
import { startOrderAlertSound, stopOrderAlertSound } from "@/lib/orderAlertSound";

/** Interrupts whatever the admin is doing when a new website order lands and keeps ringing until
 *  they explicitly acknowledge it — no overlay-click or Esc dismissal, on purpose. */
export function NewOrderAlertModal() {
  const { newOrderAlerts, acknowledgeNewOrders } = useAdminOrders();
  const navigate = useNavigate();
  const open = newOrderAlerts.length > 0;

  useEffect(() => {
    if (!open) return;
    startOrderAlertSound();
    return () => stopOrderAlertSound();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const original = document.title;
    const count = newOrderAlerts.length;
    let on = true;
    const t = setInterval(() => {
      document.title = on ? `(${count}) NEW ORDER!` : original;
      on = !on;
    }, 800);
    return () => {
      clearInterval(t);
      document.title = original;
    };
  }, [open, newOrderAlerts.length]);

  if (!open) return null;

  return (
    <AlertDialog open>
      <AlertDialogContent
        className="border-2 border-red-500 sm:max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-red-500 text-white">
            <BellRing className="h-8 w-8" />
          </span>
          <AlertDialogTitle className="text-2xl font-bold text-red-600">
            {newOrderAlerts.length === 1
              ? "New order received!"
              : `${newOrderAlerts.length} new orders received!`}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <ul className="w-full space-y-2 text-left text-sm">
              {newOrderAlerts.slice(0, 5).map((o) => (
                <li key={o.id} className="rounded-md border bg-muted/50 p-3">
                  <div className="font-semibold text-foreground">
                    {o.reference} · KES {o.total.toLocaleString()}
                  </div>
                  <div className="text-muted-foreground">
                    {o.customerName}
                    {o.customerPhone ? ` · ${o.customerPhone}` : ""}
                  </div>
                </li>
              ))}
              {newOrderAlerts.length > 5 && (
                <li className="text-center text-muted-foreground">
                  + {newOrderAlerts.length - 5} more
                </li>
              )}
            </ul>
          </AlertDialogDescription>
        </div>
        <AlertDialogFooter className="gap-2 sm:flex-col sm:space-x-0">
          <Button
            size="lg"
            className="w-full bg-red-600 text-white hover:bg-red-700"
            onClick={() => {
              acknowledgeNewOrders();
              navigate("/admin/orders");
            }}
          >
            Acknowledge &amp; view orders
          </Button>
          <Button size="lg" variant="outline" className="w-full" onClick={acknowledgeNewOrders}>
            Acknowledge
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
