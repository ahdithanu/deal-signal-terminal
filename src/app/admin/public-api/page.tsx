import { redirect } from "next/navigation";

import { PublicApiConsole } from "@/components/public-api-console";
import { getAuthSession, isDemoSession } from "@/lib/auth";
import {
  listPublicApiKeys,
  listPublicApiRequestLogs,
  publicApiScopes,
} from "@/lib/public-api";

export default async function PublicApiAdminPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  if (isDemoSession(session)) {
    redirect("/login");
  }

  if (session.role !== "admin") {
    redirect("/");
  }

  const [keys, requestLogs] = await Promise.all([
    listPublicApiKeys(session.orgId),
    listPublicApiRequestLogs(session.orgId),
  ]);

  return (
    <PublicApiConsole
      initialKeys={keys}
      initialRequestLogs={requestLogs}
      scopes={publicApiScopes}
    />
  );
}
