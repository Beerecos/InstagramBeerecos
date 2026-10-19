import Link from "next/link";
import { Logo } from "./logo";

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex items-center border-b border-line bg-surface-1/95 px-4 py-3 backdrop-blur lg:hidden">
      <Link href="/" aria-label="BeeMarketing — accueil">
        <Logo width={150} priority />
      </Link>
    </header>
  );
}
