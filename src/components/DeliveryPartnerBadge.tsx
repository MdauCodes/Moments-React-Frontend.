import type { DeliveryPartner } from "@/data/deliveryPartners";

/** Real rider photo + name — shown wherever we need to build trust that deliveries actually happen. */
export function DeliveryPartnerBadge({
  partner,
  className = "",
}: {
  partner: DeliveryPartner;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={partner.photo}
        alt={`${partner.name} rider`}
        className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-background"
      />
      <span className="text-xs text-muted-foreground">Delivered by real {partner.name} riders</span>
    </div>
  );
}
