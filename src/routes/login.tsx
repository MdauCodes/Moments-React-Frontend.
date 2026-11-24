import { useSearchParams } from "react-router-dom";
import { StaffLinkGate } from "@/components/StaffLinkGate";

/** Old staff sign-in address: now only the staff overlay (or a send to the staff link). */
function LoginAliasPage() {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") ?? undefined;
  return <StaffLinkGate wantedPath={redirect?.startsWith("/admin") ? redirect : undefined} />;
}

export default LoginAliasPage;
