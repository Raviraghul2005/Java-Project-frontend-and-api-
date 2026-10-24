import type React from "react";
import { ActivityIcon, DashboardIcon, FlaskIcon, GridIcon, ScanIcon, SlidersIcon } from "@/components/ui/icons";

export interface NavItem {
  href: string;
  /** Full name: the accessible name of the link everywhere. */
  label: string;
  /** Short text for the mobile tab bar. */
  short: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", short: "Home", icon: DashboardIcon },
  { href: "/scan", label: "Scan Statement", short: "Scan", icon: ScanIcon },
  { href: "/analytics", label: "Fatigue Audit", short: "Audit", icon: ActivityIcon },
  { href: "/simulator", label: "Arbitrage Lab", short: "Lab", icon: FlaskIcon },
  { href: "/catalog", label: "Catalog", short: "Catalog", icon: GridIcon },
  { href: "/settings", label: "Settings", short: "Settings", icon: SlidersIcon }
];

export function activeIndexFor(pathname: string): number {
  return NAV_ITEMS.findIndex((item) => item.href === pathname);
}
