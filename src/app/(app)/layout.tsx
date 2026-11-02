import { Suspense } from "react";
import { MobileHeader } from "@/components/shell/mobile-header";
import { MobileNav, MobileNavView } from "@/components/shell/mobile-nav";
import { Sidebar, SidebarView } from "@/components/shell/sidebar";
import { UserBadge, UserBadgeSkeleton } from "@/components/shell/user-badge";

/**
 * Coquille statique (pré-rendue) ; tout ce qui dépend de la session est diffusé derrière Suspense.
 * Studio des réels : plus de TopBar, de barre Queen Bee ni de WatchdogPulse, qui lisaient les tables de missions
 * absentes de la base BeeMarketing partagée.
 */
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
        <main id="contenu" className="px-4 pb-28 pt-4 sm:px-8 lg:pb-10 lg:pt-6">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
      <Suspense fallback={<MobileNavView pathname="" />}>
        <MobileNav />
      </Suspense>
    </div>
  );
}
