import type { Metadata } from "next";
import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";
import { Providers } from "@/components/providers";
import { getAuthSession } from "@/lib/auth";

import "./globals.css";

export const metadata: Metadata = {
  title: "Build Signals",
  description:
    "A real estate intelligence app that ranks public permit signals into decision-ready opportunities.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAuthSession();

  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="shell">
            <header className="site-header">
              <div className="header-inner">
                <div className="brand-block">
                  <p className="brand-mark">Build Signals</p>
                  <Link className="brand-title" href={session ? "/" : "/demo"}>
                    Find what changed before everyone else does.
                  </Link>
                </div>

                <div className="nav-block">
                  <div className="status-pill">
                    {session ? `${session.orgName} · ${session.role}` : "Live markets: El Dorado + San Diego"}
                  </div>
                  <nav className="nav-links">
                    {session ? (
                      <>
                        <Link className="nav-link" href="/">
                          Home feed
                        </Link>
                        <Link className="nav-link" href="/watchlist">
                          Watchlist
                        </Link>
                        {session.role === "admin" ? (
                          <>
                            <Link className="nav-link" href="/admin/pilot-leads">
                              Pipeline
                            </Link>
                            <Link className="nav-link" href="/admin/data-health">
                              Data
                            </Link>
                            <Link className="nav-link" href="/admin/deployment-settings">
                              Settings
                            </Link>
                            <Link className="nav-link" href="/admin/evals">
                              Evals
                            </Link>
                            <Link className="nav-link" href="/admin/observability">
                              Observability
                            </Link>
                            <Link className="nav-link" href="/admin/events">
                              Events
                            </Link>
                            <Link className="nav-link" href="/admin/audit">
                              Admin
                            </Link>
                          </>
                        ) : null}
                        <LogoutButton />
                      </>
                    ) : (
                      <>
                        <Link className="nav-link" href="/pilot">
                          Pilot
                        </Link>
                        <Link className="nav-link" href="/demo">
                          Live demo
                        </Link>
                        <Link className="nav-link" href="/privacy">
                          Privacy
                        </Link>
                        <Link className="nav-link" href="/login">
                          Sign in
                        </Link>
                      </>
                    )}
                  </nav>
                </div>
              </div>
            </header>

            <main className="page">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
