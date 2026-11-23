import { Network } from "lucide-react";
import { lazy } from "react";

import { CreateReferralDialogOverride } from "@/components/overrides/CreateReferralDialogOverride";
import { ReferralConversationOverride } from "@/components/overrides/ReferralConversationOverride";
import { ReferralDestinationPickerOverride } from "@/components/overrides/ReferralDestinationPickerOverride";
import { ReferralStatusBadgeOverride } from "@/components/overrides/ReferralStatusBadgeOverride";

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

/**
 * Uses only CARE's existing plugin points: routes, a facility nav item, the
 * `EncounterActions` / `PatientInfoCardActions` slots and overrides of
 * `CreateReferralDialog`, `ReferralDestinationPicker`, `ReferralStatusBadge`
 * and `ReferralConversation` (active when CARE is built with
 * `REACT_MFE_REGISTERED_COMPONENTS=CreateReferralDialog,ReferralDestinationPicker,ReferralStatusBadge,ReferralConversation`).
 */
const manifest = {
  plugin: "care_ccn_fe",
  routes,
  navItems,
  components: {
    EncounterActions: lazy(
      () => import("@/components/pluggables/EncounterActions"),
    ),
    PatientInfoCardActions: lazy(
      () => import("@/components/pluggables/PatientInfoCardActions"),
    ),
  },
  overrides: [
    {
      component: "CreateReferralDialog",
      replacement: CreateReferralDialogOverride,
      description: "Runs the CCN network referral workflow in the dialog",
    },
    {
      component: "ReferralDestinationPicker",
      replacement: ReferralDestinationPickerOverride,
      description: "Adds the Network (CCN) destination type",
    },
    {
      component: "ReferralConversation",
      replacement: ReferralConversationOverride,
      description: "Shows the CCN network status on the referral page",
    },
    {
      component: "ReferralStatusBadge",
      replacement: ReferralStatusBadgeOverride,
      description: "Marks referrals sent over the CCN network",
    },
  ],
} as const;

export default manifest;
