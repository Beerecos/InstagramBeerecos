import { BarChart3, CalendarDays, Clapperboard, Compass, Home, Library, Map, MessagesSquare, Plus, Settings, Users, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  plus: Plus,
  clapperboard: Clapperboard,
  library: Library,
  calendar: CalendarDays,
  messages: MessagesSquare,
  users: Users,
  map: Map,
  chart: BarChart3,
  compass: Compass,
  settings: Settings,
};

export function NavIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? Home;
  return <Icon aria-hidden size={size} />;
}
