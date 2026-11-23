import { useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Network, RefreshCcw, Telescope } from "lucide-react";
import { useMemo } from "react";

import { PaginatedResponse, query } from "@/lib/request";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Muted,
  CareUIPageTitle as PageTitle,
} from "@/components/ui/typography";

import Page from "@/components/common/Page";
import { TransactionTable } from "@/components/network/admin/TransactionTable";
import {
  API_FOR,
  DIRECTIONS,
  EXPLORER_PATH,
} from "@/components/network/admin/transactions";
import { NETWORK_POLL_INTERVAL_MS } from "@/components/network/networkReferral";

import { useTranslation } from "@/hooks/useTranslation";

import {
  BecknTransactionList,
  isAwaitingCallback,
  isFailedTransaction,
} from "@/types/ccn";

/** The dashboard shows the latest rows; the explorer pages through the rest. */
const RECENT_LIMIT = 20;

const time = (row: BecknTransactionList) =>
  row.modified_date ? Date.parse(row.modified_date) : 0;

/**
 * Admin dashboard of the CCN network: totals per direction and the latest
 * 20 transactions (outbound and inbound together), read-only. The developer
 * explorer lists all of them, filtered by direction, transaction id and
 * status, and is the only place a transaction's details open.
 */
export default function NetworkReferrals() {
  const { t } = useTranslation();
  const lists = useQueries({
    queries: DIRECTIONS.map((direction) => ({
      queryKey: ["ccn", "referral", direction, "list", "recent"],
      queryFn: query(API_FOR[direction].list, {
        queryParams: { limit: RECENT_LIMIT, offset: 0 },
        silent: true,
      }),
      refetchInterval: (q: {
        state: { data?: PaginatedResponse<BecknTransactionList> };
      }) =>
        q.state.data?.results.some((item) => isAwaitingCallback(item.status))
          ? NETWORK_POLL_INTERVAL_MS * 2
          : false,
    })),
  });
  const [outbound, inbound] = lists;
  const isLoading = lists.some((list) => list.isLoading);
  const isError = lists.every((list) => list.isError);
  const isFetching = lists.some((list) => list.isFetching);

  const recent = useMemo(
    () =>
      lists
        .flatMap((list) => list.data?.results ?? [])
        .sort((a, b) => time(b) - time(a))
        .slice(0, RECENT_LIMIT),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outbound.data, inbound.data],
  );
  const failed = recent.filter((row) => isFailedTransaction(row.status));
  const awaiting = recent.filter((row) => isAwaitingCallback(row.status));

  return (
    <Page title={t("ccn_network_referrals")} hideTitleOnPage>
      <div className="space-y-6 px-3 pb-6 md:px-0">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <PageTitle>{t("ccn_network_referrals")}</PageTitle>
            <Muted className="max-w-3xl">
              {t("ccn_network_referrals_description")}
            </Muted>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => lists.forEach((list) => void list.refetch())}
            >
              <RefreshCcw className="size-4" aria-hidden="true" />
              {t("ccn_refresh")}
            </Button>
            <Button size="sm" render={<Link to={EXPLORER_PATH} />}>
              <Telescope className="size-4" aria-hidden="true" />
              {t("ccn_open_explorer")}
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label={t("ccn_direction__outbound")}
            value={outbound.data?.count}
            loading={outbound.isLoading}
            direction="outbound"
          />
          <Stat
            label={t("ccn_direction__inbound")}
            value={inbound.data?.count}
            loading={inbound.isLoading}
            direction="inbound"
          />
          <Stat
            label={t("ccn_recent_awaiting")}
            value={awaiting.length}
            loading={isLoading}
            tone={awaiting.length ? "warning" : "neutral"}
          />
          <Stat
            label={t("ccn_recent_failed")}
            value={failed.length}
            loading={isLoading}
            tone={failed.length ? "destructive" : "neutral"}
          />
        </div>

        <Frame>
          <FrameHeader>
            <FrameTitle>{t("ccn_recent_transactions")}</FrameTitle>
            <FrameDescription>
              {t("ccn_recent_transactions_description", {
                count: RECENT_LIMIT,
              })}
            </FrameDescription>
          </FrameHeader>
          <FramePanel className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : isError ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{t("ccn_network_unavailable")}</EmptyTitle>
                </EmptyHeader>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => lists.forEach((list) => void list.refetch())}
                >
                  {t("try_again")}
                </Button>
              </Empty>
            ) : !recent.length ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Network aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>{t("ccn_empty_transactions_title")}</EmptyTitle>
                  <EmptyDescription>
                    {t("ccn_empty_transactions_description")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              // Read-only summary: details and response logs are in the
              // developer explorer.
              <TransactionTable rows={recent} />
            )}
          </FramePanel>
          <FrameFooter className="flex-row items-center justify-between gap-3">
            <Muted className="text-xs">
              {t("ccn_explorer_hint", {
                count: (outbound.data?.count ?? 0) + (inbound.data?.count ?? 0),
              })}
            </Muted>
            <Button
              variant="outline"
              size="sm"
              render={<Link to={EXPLORER_PATH} />}
              data-cy="ccn-open-explorer"
            >
              <Telescope className="size-4" aria-hidden="true" />
              {t("ccn_view_all_in_explorer")}
            </Button>
          </FrameFooter>
        </Frame>
      </div>
    </Page>
  );
}

function Stat({
  label,
  value,
  loading,
  tone = "neutral",
  direction,
}: {
  label: string;
  value?: number;
  loading?: boolean;
  tone?: "neutral" | "warning" | "destructive";
  direction?: "outbound" | "inbound";
}) {
  const body = (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      {loading ? (
        <Skeleton className="h-7 w-12" />
      ) : (
        <span className="flex items-center gap-2">
          <span className="text-2xl font-semibold tabular-nums">
            {value ?? "—"}
          </span>
          {tone !== "neutral" && <Badge variant={tone} size="sm" dot />}
        </span>
      )}
    </>
  );
  const className =
    "grid gap-1 rounded-xl border border-border bg-card p-4 text-left";
  return direction ? (
    <Link
      to={EXPLORER_PATH}
      search={{ direction }}
      className={`${className} hover:bg-muted/50`}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
