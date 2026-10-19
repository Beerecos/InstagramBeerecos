import { BadgeCheck, BarChart3, CalendarDays, CheckCheck, Clapperboard, Hexagon, Home, Layers, Library, Megaphone, Settings, ShieldCheck, Target, Users, UsersRound, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  target: Target,
  check: CheckCheck,
  team: UsersRound,
  layers: Layers,
  clapperboard: Clapperboard,
  calendar: CalendarDays,
  megaphone: Megaphone,
  users: Users,
  chart: BarChart3,
  library: Library,
  badge: BadgeCheck,
  settings: Settings,
  shield: ShieldCheck,
  hive: Hexagon,
};

export function NavIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? Home;
  return <Icon aria-hidden size={size} />;
}
