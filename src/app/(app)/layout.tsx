import { Suspense } from "react";
import { WatchdogPulse } from "@/components/missions/watchdog-pulse";
import { CommandBar } from "@/components/shell/command-bar";
import { MobileHeader } from "@/components/shell/mobile-header";
import { MobileNav, MobileNavView } from "@/components/shell/mobile-nav";
import { Sidebar, SidebarView } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { UserBadge, UserBadgeSkeleton } from "@/components/shell/user-badge";

/** Coquille statique (pré-rendue) ; tout ce qui dépend de la session est diffusé derrière Suspense. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Suspense fallback={<SidebarView pathname="" footer={<UserBadgeSkeleton />} />}>
        <Sidebar
          footer={
            <Suspense fallback={<UserBadgeSkeleton />}>
              <UserBadge />
            </Suspense>
          }
        />
      </Suspense>
      <div className="min-w-0 flex-1">
        <MobileHeader />
        <main id="contenu" className="px-4 pb-40 pt-4 sm:px-8 lg:pb-28 lg:pt-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4 min-h-9">
              <Suspense fallback={null}>
                <TopBar />
              </Suspense>
            </div>
            {children}
          </div>
        </main>
      </div>
      <CommandBar />
      <WatchdogPulse />
      <Suspense fallback={<MobileNavView pathname="" />}>
        <MobileNav />
      </Suspense>
    </div>
  );
}
