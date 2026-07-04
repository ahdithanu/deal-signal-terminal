import { redirect } from "next/navigation";

import { DeploymentSettingsConsole } from "@/components/deployment-settings-console";
import { getAuthSession } from "@/lib/auth";
import {
  getWorkspaceDeploymentConfig,
  listWorkspaceDeploymentConfigHistory,
} from "@/lib/deployment-config";

export default async function DeploymentSettingsPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "admin") {
    redirect("/");
  }

  const [config, history] = await Promise.all([
    getWorkspaceDeploymentConfig(session.orgId),
    listWorkspaceDeploymentConfigHistory(session.orgId),
  ]);

  return <DeploymentSettingsConsole initialConfig={config} initialHistory={history} />;
}
