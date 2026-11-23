import {
  type QueryClient,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { Network } from "lucide-react";
import { useState } from "react";

import { query } from "@/lib/request";
import { CCN_SCOPE, CcnScope } from "@/lib/scope";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { useIsNetworkReferral } from "@/components/network/ReferralNetworkBadge";
import {
  ReferralNetworkStatus,
  useRefreshAfterReferralEdits,
} from "@/components/network/ReferralNetworkStatus";

import { useTranslation } from "@/hooks/useTranslation";

import { careRoutes } from "@/apis/care";
import type { ReferralRead } from "@/types/care";

export interface ReferralTarget {
  referralId: string;
  /** The badge is the page's own referral (referral or respond page). */
  onReferralPage: boolean;
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

export default function ReferralNetworkMarker({
  referralId,
  onReferralPage,
}: ReferralTarget) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  // The network referrals page links here with `ccnTransactionId` for
  // referrals created through discover, whose transaction id differs from
  // the referral id. CARE's route drops unknown search keys from its parsed
  // search, but they stay in the URL.
  const ccnTransactionId = new URLSearchParams(
    useLocation({ select: (location) => location.searchStr }),
  ).get("ccnTransactionId");

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
  useRefreshAfterReferralEdits(isNetwork && onReferralPage);

  if (!isNetwork || !referral) return null;

  const badge = (
    <>
      <Network className="size-3" aria-hidden="true" />
      {t("ccn_network")}
    </>
  );

  if (!onReferralPage) {
    return (
      <CcnScope>
        <Badge variant="info" size="sm" data-cy="referral-network-badge">
          {badge}
        </Badge>
      </CcnScope>
    );
  }

  return (
    <CcnScope>
      <button
        type="button"
        className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={t("ccn_show_network_status")}
        title={t("ccn_show_network_status")}
        onClick={() => setOpen(true)}
        data-cy="referral-network-badge"
      >
        <Badge variant="info" size="sm" render={<span />}>
          {badge}
        </Badge>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <div className={CCN_SCOPE}>
            <SheetHeader>
              <SheetTitle>{t("ccn_network_status")}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">
              <ReferralNetworkStatus
                referral={referral}
                transactionId={ccnTransactionId || undefined}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </CcnScope>
  );
}
