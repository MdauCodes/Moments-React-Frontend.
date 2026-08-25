import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { CheckCircle2, Camera, Loader2, X } from "lucide-react";
import { scanRiderForOrder } from "@/services/commerceApi";
import { reportAdminError } from "@/lib/adminErrorToast";

interface Props {
  orderId: string;
  /** ISO timestamp — set once TumaBoda's scan endpoint has verified the rider, null/undefined
   *  otherwise. Lifted to the parent so it survives this component staying mounted across
   *  re-renders driven by the order prop refreshing. */
  verifiedAt: string | null | undefined;
  onVerified: (verifiedAt: string) => void;
}

const SCANNER_ELEMENT_ID = "rider-qr-scanner";

/**
 * Staff-side rider-identity verification at pickup — TumaBoda's advised security mechanism
 * since their API exposes no rider name/phone. Scans the QR code shown in the rider's own
 * TumaBoda app (not something we generate) and forwards it byte-for-byte to
 * POST /api/v1/admin/orders/{id}/scan-rider. Manual code entry is deliberately not offered as a
 * fallback — the endpoint only accepts the exact scanned signed token, not a human-readable code.
 */
export function RiderScanPanel({ orderId, verifiedAt, onVerified }: Props) {
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const stoppingRef = useRef(false);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, []);

  async function stopScanner() {
    if (scannerRef.current && !stoppingRef.current) {
      stoppingRef.current = true;
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        /* already stopped/torn down — nothing to clean up */
      } finally {
        stoppingRef.current = false;
        scannerRef.current = null;
      }
    }
  }

  function startScanner() {
    setScanning(true);
    // The scanner target div only exists once React commits the `scanning` state above — defer
    // binding to the next tick so Html5Qrcode has an element to attach to.
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            void handleDecoded(decodedText);
          },
          () => {
            /* per-frame decode miss while aiming — expected constantly, not an error */
          },
        );
      } catch (err) {
        reportAdminError(err, "Couldn't access the camera — check permissions");
        setScanning(false);
      }
    }, 0);
  }

  async function handleDecoded(decodedText: string) {
    if (submitting) return; // ignore repeat frames while a submit is already in flight
    setSubmitting(true);
    await stopScanner();
    setScanning(false);
    try {
      const { order } = await scanRiderForOrder(orderId, decodedText);
      if (order?.tumabodaRiderVerifiedAt) {
        onVerified(order.tumabodaRiderVerifiedAt);
      }
    } catch (err) {
      reportAdminError(err, "Rider verification failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelScan() {
    await stopScanner();
    setScanning(false);
  }

  if (verifiedAt) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          background: "#f0faf2",
          border: "1px solid #a8d5b0",
          borderRadius: 8,
          fontSize: 13,
        }}
      >
        <CheckCircle2 size={16} color="#2d7a3a" style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 600, color: "#2d7a3a" }}>Rider verified</div>
          <div style={{ color: "var(--admin-muted)", fontSize: 12 }}>
            {new Date(verifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {!scanning ? (
        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={startScanner}
          disabled={submitting}
        >
          {submitting ? (
            <Loader2 size={14} className="animate-spin" style={{ marginRight: 6 }} />
          ) : (
            <Camera size={14} style={{ marginRight: 6 }} />
          )}
          {submitting ? "Verifying…" : "Scan rider QR"}
        </button>
      ) : (
        <>
          <div
            id={SCANNER_ELEMENT_ID}
            style={{ width: "100%", borderRadius: 10, overflow: "hidden", background: "#000" }}
          />
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => void cancelScan()}
          >
            <X size={14} style={{ marginRight: 6 }} />
            Cancel
          </button>
        </>
      )}
      <p style={{ fontSize: 12, color: "var(--admin-muted)", margin: 0 }}>
        Point the camera at the QR code shown in the rider's own TumaBoda app to confirm their
        identity before handing over the package.
      </p>
    </div>
  );
}
