function configuredCronSecret() {
  return process.env.CRON_SECRET?.trim() || process.env.BUILD_SIGNALS_CRON_SECRET?.trim() || "";
}

export function isAuthorizedCronRequest(request: Request) {
  const secret = configuredCronSecret();

  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization") ?? "";
  return authorization === `Bearer ${secret}`;
}
