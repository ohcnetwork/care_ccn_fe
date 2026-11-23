import {
  type QueryClient,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Network } from "lucide-react";

import { query } from "@/lib/request";
import { CcnScope } from "@/lib/scope";

import { Badge } from "@/components/ui/badge";

import { useIsNetworkReferral } from "@/components/network/ReferralNetworkBadge";

import { useTranslation } from "@/hooks/useTranslation";

import { careRoutes } from "@/apis/care";
import type { ReferralRead } from "@/types/care";

export interface ReferralTarget {
  referralId: string;
}

/** CARE's referral list and detail queries already hold the referral. */
function findCachedReferral(
  client: QueryClient,
  referralId: string,
): ReferralRead | undefined {
  for (const [, data] of client.getQueriesData<unknown>({
    queryKey: ["referrals"],
  })) {
    if (!data || typeof data !== "object") continue;
    const record = data as { id?: unknown; results?: unknown };
    if (record.id === referralId && "availability" in record) {
      return data as ReferralRead;
    }
    if (Array.isArray(record.results)) {
      const match = (record.results as ReferralRead[]).find(
        (item) => item?.id === referralId,
      );
      if (match) return match;
    }
  }
  return undefined;
}

export default function ReferralNetworkMarker({ referralId }: ReferralTarget) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const { data: referral } = useQuery({
    queryKey: ["ccn", "referral-summary", referralId],
    queryFn: query(careRoutes.getReferral, {
      pathParams: { referralId },
      silent: true,
    }),
    initialData: () => findCachedReferral(client, referralId),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const isNetwork = useIsNetworkReferral(referral?.availability);
  if (!isNetwork || !referral) return null;

  // On the referral page the network status box sits in the side column
  // (the `ReferralConversation` override); the badge only marks the referral.
  return (
    <CcnScope>
      <Badge variant="info" size="sm" data-cy="referral-network-badge">
        <Network className="size-3" aria-hidden="true" />
        {t("ccn_network")}
      </Badge>
    </CcnScope>
  );
}
