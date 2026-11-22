import { CcnScope } from "@/lib/scope";

import { ReferralNetworkBadge } from "@/components/network/ReferralNetworkBadge";

import type { ReferralRead } from "@/types/care";

/** `ReferralStatusExtras` slot: marks referrals sent over the network. */
export default function ReferralStatusExtras({
  referral,
}: {
  referral: ReferralRead;
}) {
  return (
    <CcnScope>
      <ReferralNetworkBadge availabilityId={referral.availability} />
    </CcnScope>
  );
}
