import { useSearchParams } from "react-router-dom";
import { StaffLinkGate } from "@/components/StaffLinkGate";

/** No form any more (handover doc 18 §16): the staff overlay, or a send to the staff link. */
export function AdminLoginPage({ redirect }: { redirect?: string }) {
  return <StaffLinkGate wantedPath={redirect?.startsWith("/admin") ? redirect : undefined} />;
}

function AdminLoginRoute() {
  const [searchParams] = useSearchParams();
  return <AdminLoginPage redirect={searchParams.get("redirect") ?? undefined} />;
}

export default AdminLoginRoute;
