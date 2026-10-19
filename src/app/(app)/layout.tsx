import { Suspense } from "react";
import { CommandBar } from "@/components/shell/command-bar";
import { MobileHeader } from "@/components/shell/mobile-header";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { UserBadge, UserBadgeSkeleton } from "@/components/shell/user-badge";

/** Coquille statique (pré-rendue) ; tout ce qui dépend de la session est diffusé derrière Suspense. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar
        footer={
          <Suspense fallback={<UserBadgeSkeleton />}>
            <UserBadge />
          </Suspense>
        }
      />
      <div className="min-w-0 flex-1">
        <MobileHeader />
        <main id="contenu" className="px-4 pb-40 pt-6 sm:px-8 lg:pb-28 lg:pt-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
      <CommandBar />
      <MobileNav />
    </div>
  );
}
