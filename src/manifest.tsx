import { Network } from "lucide-react";
import { lazy } from "react";

import { networkReferralDestination } from "@/components/network/networkDestination";

import "@/index.css";
import type { PluginNavigationLink } from "@/pluginContract";
import routes from "@/routes";

const navItems: PluginNavigationLink[] = [
  {
    // The host renders plugin nav names as given.
    name: "Network referrals",
    url: "network_referrals",
    icon: <Network className="size-4" aria-hidden="true" />,
  },
];

const manifest = {
  plugin: "care_ccn_fe",
  routes,
  navItems,
  components: {
    ReferralStatusExtras: lazy(
      () => import("@/components/pluggables/ReferralStatusExtras"),
    ),
    ReferralDetailsSidebar: lazy(
      () => import("@/components/pluggables/ReferralDetailsSidebar"),
    ),
    ReferralSharedRecordBadges: lazy(
      () => import("@/components/pluggables/ReferralSharedRecordBadges"),
    ),
  },
  referralDestinations: [networkReferralDestination],
} as const;

export default manifest;
