import tumaBodaRiderPhoto from "@/assets/tumaboda-rider.jpg";
import tumaBodaLogo from "@/assets/tumaboda-logo.svg";

export type DeliveryPartner = {
  id: string;
  name: string;
  /** Real photo of a rider/vehicle in action — used to build trust that deliveries actually happen. */
  photo: string;
  logo: string;
};

// Only TumaBoda today; more logistics partners get added here as they're onboarded.
export const DELIVERY_PARTNERS: DeliveryPartner[] = [
  { id: "tumaboda", name: "TumaBoda", photo: tumaBodaRiderPhoto, logo: tumaBodaLogo },
];

export function getDeliveryPartner(id: string): DeliveryPartner | undefined {
  return DELIVERY_PARTNERS.find((p) => p.id === id);
}
