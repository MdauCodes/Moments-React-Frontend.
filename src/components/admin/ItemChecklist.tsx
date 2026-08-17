import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

interface ChecklistItem {
  productId: string;
  name: string;
  qty: number;
}

interface Props {
  orderId: string;
  items: ChecklistItem[];
  onAllTickedChange: (allTicked: boolean) => void;
}

const STORAGE_PREFIX = "dispatch_checklist_";

function itemKey(orderId: string, idx: number, productId: string): string {
  return `${orderId}:${productId || idx}`;
}

/**
 * Shared item-ticking checklist — same storage key convention as DispatchChecklist.tsx (a
 * checklist ticked from either place is remembered by the other), extracted so the new
 * per-fulfillment-mode order panels can gate their final action ("Mark picked up" / "Mark out
 * for delivery") on staff having actually verified contents, without duplicating the ticking
 * logic three times.
 */
export function ItemChecklist({ orderId, items, onAllTickedChange }: Props) {
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${orderId}`);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      setTicked(new Set(arr));
    } catch {
      setTicked(new Set());
    }
  }, [orderId]);

  const itemIds = useMemo(
    () => items.map((it, idx) => itemKey(orderId, idx, it.productId)),
    [orderId, items],
  );

  const allTicked = itemIds.length > 0 && itemIds.every((id) => ticked.has(id));
  const tickedCount = itemIds.filter((id) => ticked.has(id)).length;

  useEffect(() => {
    onAllTickedChange(allTicked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTicked]);

  function persist(next: Set<string>) {
    setTicked(next);
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${orderId}`, JSON.stringify(Array.from(next)));
    } catch {
      /* ignore */
    }
  }

  function toggle(id: string) {
    const next = new Set(ticked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    persist(next);
  }

  function tickAll() {
    persist(new Set(itemIds));
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {tickedCount} of {itemIds.length} items verified
        </span>
        {!allTicked ? (
          <button type="button" onClick={tickAll} className="text-xs font-medium text-primary underline">
            Tick all
          </button>
        ) : (
          <span className="flex items-center gap-1 text-xs font-medium text-green-700">
            <CheckCircle2 size={12} /> All verified
          </span>
        )}
      </div>
      <ul className="space-y-1.5">
        {items.map((it, idx) => {
          const id = itemKey(orderId, idx, it.productId);
          const checked = ticked.has(id);
          return (
            <li key={id}>
              <label className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm" style={{ borderColor: checked ? "#a8d5b0" : undefined, background: checked ? "#f0faf2" : undefined }}>
                <input type="checkbox" checked={checked} onChange={() => toggle(id)} />
                <span className="flex-1">{it.name}</span>
                <span className="text-xs text-muted-foreground">×{it.qty}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
