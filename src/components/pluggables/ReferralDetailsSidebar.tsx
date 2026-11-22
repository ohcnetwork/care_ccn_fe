import { useLocation } from "@tanstack/react-router";

import { CcnScope } from "@/lib/scope";

import { ReferralNetworkStatus } from "@/components/network/ReferralNetworkStatus";

import type { ReferralRetrieve } from "@/types/care";

/**
 * `ReferralDetailsSidebar` slot: the network transaction of a network
 * referral. The network referrals page links here with `ccnTransactionId`
 * for referrals created through discover, whose transaction id differs from
 * the referral id.
 */
export default function ReferralDetailsSidebar({
  referral,
}: {
  referral: ReferralRetrieve;
}) {
  // Read from the location: the host's referral route validates its search
  // and drops keys it does not know, but they stay in the URL.
  const ccnTransactionId = (useLocation().search as Record<string, unknown>)
    .ccnTransactionId;
  return (
    <CcnScope>
      <ReferralNetworkStatus
        referral={referral}
        transactionId={
          typeof ccnTransactionId === "string" && ccnTransactionId
            ? ccnTransactionId
            : undefined
        }
      />
    </CcnScope>
  );
}
