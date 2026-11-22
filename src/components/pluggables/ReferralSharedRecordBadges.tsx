import { Network } from "lucide-react";

import { CcnScope } from "@/lib/scope";

import { Badge } from "@/components/ui/badge";

import { useIsNetworkReferral } from "@/components/network/ReferralNetworkBadge";

import { useTranslation } from "@/hooks/useTranslation";

import type { ReferralResource, ReferralRetrieve } from "@/types/care";

/**
 * `ReferralSharedRecordBadges` slot. Only linked files are synced over the
 * network; `metadata.ccn_ref` marks the copies received from the other side.
 */
export default function ReferralSharedRecordBadges(
  props: Parameters<typeof SharedRecordBadge>[0],
) {
  return (
    <CcnScope>
      <SharedRecordBadge {...props} />
    </CcnScope>
  );
}

function SharedRecordBadge({
  referral,
  attachment,
}: {
  referral: ReferralRetrieve;
  attachment: ReferralResource;
}) {
  const { t } = useTranslation();
  const isNetwork = useIsNetworkReferral(referral.availability);
  if (attachment.metadata?.ccn_ref) {
    return (
      <Badge variant="info" size="sm" data-cy="referral-record-received">
        <Network className="size-3" aria-hidden="true" />
        {t("ccn_received_via_network")}
      </Badge>
    );
  }
  if (isNetwork && attachment.resource_type === "file_upload") {
    return (
      <Badge variant="neutral" size="sm" data-cy="referral-record-shared">
        <Network className="size-3" aria-hidden="true" />
        {t("ccn_shared_via_network")}
      </Badge>
    );
  }
  return null;
}
