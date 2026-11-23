import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Network, RefreshCw } from "lucide-react";
import { useEffect } from "react";

import { mutate } from "@/lib/request";
import { query } from "@/lib/request";
import { HttpError } from "@/lib/request";
import { formatDateTime } from "@/lib/utils";

import { Button } from "@/components/ui/button";

import { BecknTransactionStatusBadge } from "@/components/network/BecknTransactionStatusBadge";
import { useIsNetworkReferral } from "@/components/network/ReferralNetworkBadge";
import { NETWORK_POLL_INTERVAL_MS } from "@/components/network/networkReferral";

import { useTranslation } from "@/hooks/useTranslation";

import { ccnReferralRoutes } from "@/apis/ccn";
import { ReferralRead } from "@/types/care";
import {
  ReferralTransactionRetrieve,
  isAwaitingCallback,
  isFailedTransaction,
} from "@/types/ccn";

// The backend syncs an edit from a background task after it commits, so the
// transaction may only move to `UPDATE` shortly after the edit returns.
const SYNC_REFRESH_DELAYS_MS = [0, 2000, 5000];

/**
 * Refreshes the network transaction after the referral is edited in CARE (a
 * status change, a reply, a linked file): CARE refetches its `referrals`
 * queries after every such edit, and the backend then syncs it to the network.
 */
export function useRefreshAfterReferralEdits(enabled: boolean) {
  const client = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    let timers: ReturnType<typeof setTimeout>[] = [];
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (
        event.type !== "updated" ||
        event.action.type !== "success" ||
        event.query.queryKey[0] !== "referrals" ||
        // The first load of a query is not an edit.
        event.query.state.dataUpdateCount < 2
      ) {
        return;
      }
      timers.forEach(clearTimeout);
      timers = SYNC_REFRESH_DELAYS_MS.map((delay) =>
        setTimeout(() => {
          void client.invalidateQueries({
            queryKey: ["ccn", "referral", "transaction"],
          });
        }, delay),
      );
    });
    return () => {
      unsubscribe();
      timers.forEach(clearTimeout);
    };
  }, [client, enabled]);
}

// Two-way sync: the referring side sends `update`, the receiving side replies
// with `on_update`. Other actions are shown as the raw Beckn action.
const ACTION_LABELS: Record<string, string> = {
  UPDATE: "ccn_action__update",
  ON_UPDATE: "ccn_action__on_update",
};

/**
 * Network transaction of a network referral. Referrals raised in Care on a
 * network availability use the referral id as `transaction_id`; referrals
 * created through the discover flow are opened with an explicit `transactionId`.
 */
export function ReferralNetworkStatus({
  referral,
  transactionId = referral.id,
}: {
  referral: ReferralRead;
  transactionId?: string;
}) {
  const { t } = useTranslation();
  const isNetwork = useIsNetworkReferral(referral.availability);
  const transactionQuery = useQuery<ReferralTransactionRetrieve>({
    queryKey: ["ccn", "referral", "transaction", transactionId],
    queryFn: query(ccnReferralRoutes.get, {
      pathParams: { transactionId },
      silent: true,
    }),
    enabled: isNetwork,
    retry: false,
    refetchInterval: (q) =>
      isAwaitingCallback(q.state.data?.status)
        ? NETWORK_POLL_INTERVAL_MS
        : false,
  });
  const statusMutation = useMutation({
    mutationFn: mutate(ccnReferralRoutes.status, {
      pathParams: { transactionId },
    }),
    onSuccess: () => transactionQuery.refetch(),
  });
  if (!isNetwork) return null;
  const transaction = transactionQuery.data;
  const notLinked =
    transactionQuery.error instanceof HttpError &&
    transactionQuery.error.status === 404;

  return (
    <section
      aria-label={t("ccn_network_status")}
      className="space-y-3 rounded-lg border border-border bg-background p-4"
      data-cy="referral-network-status"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Network className="size-4" aria-hidden="true" />
          {t("ccn_network_status")}
        </h2>
        {transaction && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={
              statusMutation.isPending || isAwaitingCallback(transaction.status)
            }
            onClick={() => statusMutation.mutate({})}
          >
            <RefreshCw
              aria-hidden="true"
              className={
                statusMutation.isPending ? "size-4 animate-spin" : "size-4"
              }
            />
            {t("ccn_request_status")}
          </Button>
        )}
      </div>
      {transactionQuery.isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("loading")}
        </p>
      )}
      {notLinked && (
        <p className="text-sm text-muted-foreground">
          {t("ccn_transaction_not_linked")}
        </p>
      )}
      {transactionQuery.isError && !notLinked && (
        <p role="alert" className="text-sm text-destructive">
          {t("ccn_network_unavailable")}
        </p>
      )}
      {transaction && (
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">{t("status")}</dt>
            <dd className="mt-1">
              <BecknTransactionStatusBadge status={transaction.status} />
            </dd>
          </div>
          {isFailedTransaction(transaction.status) &&
            transaction.last_error && (
              <div role="alert">
                <dt className="text-muted-foreground">{t("ccn_last_error")}</dt>
                <dd className="mt-1 line-clamp-4 break-all text-destructive">
                  {transaction.last_error.message ??
                    transaction.last_error.code}
                </dd>
              </div>
            )}
          {transaction.counterparty_id && (
            <div>
              <dt className="text-muted-foreground">{t("ccn_counterparty")}</dt>
              <dd className="mt-1 break-all">{transaction.counterparty_id}</dd>
            </div>
          )}
          {transaction.contract_id && (
            <div>
              <dt className="text-muted-foreground">{t("ccn_contract_id")}</dt>
              <dd className="mt-1 break-all font-mono text-xs">
                {transaction.contract_id}
              </dd>
            </div>
          )}
          {transaction.actions.length > 0 && (
            <div>
              <dt className="text-muted-foreground">
                {t("ccn_network_activity")}
              </dt>
              <dd className="mt-1 break-words font-mono text-xs">
                {transaction.actions
                  .map((action) =>
                    Object.hasOwn(ACTION_LABELS, action)
                      ? t(ACTION_LABELS[action])
                      : action,
                  )
                  .join(" → ")}
              </dd>
            </div>
          )}
          {transaction.modified_date && (
            <div>
              <dt className="text-muted-foreground">{t("last_modified")}</dt>
              <dd className="mt-1">
                {formatDateTime(transaction.modified_date)}
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}
