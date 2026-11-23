import { useLocation } from "@tanstack/react-router";

import { CcnScope } from "@/lib/scope";

import { useIsNetworkReferral } from "@/components/network/ReferralNetworkBadge";
import {
  ReferralNetworkStatus,
  useRefreshAfterReferralEdits,
} from "@/components/network/ReferralNetworkStatus";

import type { ReferralRetrieve } from "@/types/care";

/**
 * The network status box of the referral page. The network referrals page
 * links here with `ccnTransactionId` for referrals created through discover,
 * whose transaction id differs from the referral id. CARE's route drops
 * unknown search keys from its parsed search, but they stay in the URL.
 */
export default function ReferralNetworkStatusPanel({
  referral,
}: {
  referral: ReferralRetrieve;
}) {
  const ccnTransactionId = new URLSearchParams(
    useLocation({ select: (location) => location.searchStr }),
  ).get("ccnTransactionId");
  const isNetwork = useIsNetworkReferral(referral.availability);
  useRefreshAfterReferralEdits(isNetwork);
  if (!isNetwork) return null;
  return (
    <CcnScope>
      <ReferralNetworkStatus
        referral={referral}
        transactionId={ccnTransactionId || undefined}
      />
    </CcnScope>
  );
}
