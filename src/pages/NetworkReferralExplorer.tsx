import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Moon,
  Network,
  RefreshCcw,
  Search,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { PaginatedResponse, query } from "@/lib/request";
import { CCN_SCOPE } from "@/lib/scope";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Frame, FrameFooter, FramePanel } from "@/components/ui/frame";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Muted,
  CareUIPageTitle as PageTitle,
} from "@/components/ui/typography";

import Page from "@/components/common/Page";
import Pagination from "@/components/common/Pagination";
import {
  type SelectedTransaction,
  TransactionSheet,
} from "@/components/network/admin/TransactionSheet";
import { TransactionTable } from "@/components/network/admin/TransactionTable";
import { useConsoleTheme } from "@/components/network/admin/consoleTheme";
import {
  ADMIN_PATH,
  API_FOR,
  EXPLORER_PATH,
  TRANSACTION_STATUSES,
  type TransactionDirection,
} from "@/components/network/admin/transactions";
import { NETWORK_POLL_INTERVAL_MS } from "@/components/network/networkReferral";

import { useTranslation } from "@/hooks/useTranslation";

import { BecknTransactionList, isAwaitingCallback } from "@/types/ccn";

const PAGE_SIZE = 20;
const ANY_STATUS = "any";

interface ExplorerSearch {
  direction?: TransactionDirection;
  transaction_id?: string;
  status?: string;
  page?: number;
}

function readSearch(search: Record<string, unknown>) {
  const page = Number(search.page);
  return {
    direction: (search.direction === "inbound"
      ? "inbound"
      : "outbound") as TransactionDirection,
    transactionId:
      typeof search.transaction_id === "string" ? search.transaction_id : "",
    status:
      typeof search.status === "string" &&
      TRANSACTION_STATUSES.includes(search.status.toUpperCase())
        ? search.status.toUpperCase()
        : "",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/**
 * Every network transaction, outbound (BAP) or inbound (BPP), filtered by
 * transaction id and status. The filters live in the URL so a filtered view
 * can be shared.
 */
export default function NetworkReferralExplorer() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { direction, transactionId, status, page } = readSearch(
    useLocation().search as Record<string, unknown>,
  );
  const [idInput, setIdInput] = useState(transactionId);
  const [selected, setSelected] = useState<SelectedTransaction>();
  const consoleTheme = useConsoleTheme();

  const update = (next: ExplorerSearch) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => {
        const merged: Record<string, unknown> = { ...prev, ...next };
        // Any filter change starts from the first page.
        if (!("page" in next)) delete merged.page;
        for (const key of Object.keys(merged)) {
          if (merged[key] === "" || merged[key] === 1) delete merged[key];
        }
        return merged;
      },
      replace: true,
    });

  // Keep the box in step with the URL (back/forward, "Clear filters").
  useEffect(() => setIdInput(transactionId), [transactionId]);
  // Search as the id is typed, once typing pauses.
  useEffect(() => {
    const value = idInput.trim();
    if (value === transactionId) return;
    const timer = setTimeout(() => update({ transaction_id: value }), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idInput]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery<
    PaginatedResponse<BecknTransactionList>
  >({
    queryKey: [
      "ccn",
      "referral",
      direction,
      "list",
      { transactionId, status, page },
    ],
    queryFn: query(API_FOR[direction].list, {
      queryParams: {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        ...(transactionId && { transaction_id: transactionId }),
        ...(status && { status }),
      },
      silent: true,
    }),
    placeholderData: (previous) => previous,
    refetchInterval: (q) =>
      q.state.data?.results.some((item) => isAwaitingCallback(item.status))
        ? NETWORK_POLL_INTERVAL_MS * 2
        : false,
  });
  const filtered = !!transactionId || !!status;

  return (
    <Page title={t("ccn_explorer")} hideTitleOnPage>
      <div
        className={`${consoleTheme.className} space-y-6 rounded-xl border border-border p-4 md:p-6`}
        data-cy="ccn-explorer"
      >
        <header className="space-y-2">
          <Link
            to={ADMIN_PATH}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("ccn_network_referrals")}
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PageTitle>{t("ccn_explorer")}</PageTitle>
            <Button
              variant="outline"
              size="sm"
              // Icon only; the label stays for screen readers and the tooltip.
              aria-label={
                consoleTheme.theme === "dark"
                  ? t("ccn_theme_light")
                  : t("ccn_theme_dark")
              }
              title={
                consoleTheme.theme === "dark"
                  ? t("ccn_theme_light")
                  : t("ccn_theme_dark")
              }
              onClick={() =>
                consoleTheme.setTheme(
                  consoleTheme.theme === "dark" ? "light" : "dark",
                )
              }
              data-cy="ccn-explorer-theme"
            >
              {consoleTheme.theme === "dark" ? (
                <Sun className="size-4" aria-hidden="true" />
              ) : (
                <Moon className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
          <Muted className="max-w-3xl">{t("ccn_explorer_description")}</Muted>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={direction}
            onValueChange={(value) =>
              update({ direction: value as TransactionDirection })
            }
          >
            <TabsList>
              <TabsTrigger value="outbound" data-cy="ccn-tab-outbound">
                {t("ccn_direction__outbound")}
              </TabsTrigger>
              <TabsTrigger value="inbound" data-cy="ccn-tab-inbound">
                {t("ccn_direction__inbound")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <div className="relative w-full sm:w-80">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={idInput}
                onChange={(event) => setIdInput(event.target.value)}
                placeholder={t("ccn_filter_transaction_id")}
                aria-label={t("ccn_transaction_id")}
                className="pl-8 font-mono text-xs"
                data-cy="ccn-filter-transaction-id"
              />
            </div>
            <Select
              value={status || ANY_STATUS}
              onValueChange={(value) =>
                update({ status: value === ANY_STATUS ? "" : value })
              }
            >
              <SelectTrigger
                className="w-full sm:w-48"
                aria-label={t("ccn_transaction_status")}
                data-cy="ccn-filter-status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                className={`${CCN_SCOPE} ${consoleTheme.className}`}
              >
                <SelectItem value={ANY_STATUS}>
                  {t("ccn_any_status")}
                </SelectItem>
                {TRANSACTION_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    <span className="font-mono text-xs">{value}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => update({ transaction_id: "", status: "" })}
              >
                <X className="size-4" aria-hidden="true" />
                {t("ccn_clear_filters")}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => void refetch()}
              aria-label={t("ccn_refresh")}
            >
              <RefreshCcw className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <Frame>
          <FramePanel className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }, (_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : isError ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{t("ccn_network_unavailable")}</EmptyTitle>
                </EmptyHeader>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  {t("try_again")}
                </Button>
              </Empty>
            ) : !data?.results.length ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Network aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>
                    {filtered
                      ? t("ccn_no_matching_transactions")
                      : t(`ccn_empty_${direction}_title`)}
                  </EmptyTitle>
                  {!filtered && (
                    <EmptyDescription>
                      {t(`ccn_empty_${direction}_description`)}
                    </EmptyDescription>
                  )}
                </EmptyHeader>
              </Empty>
            ) : (
              <TransactionTable
                rows={data.results}
                showResponse
                onSelect={(row) =>
                  setSelected({
                    direction,
                    transactionId: row.transaction_id,
                  })
                }
              />
            )}
          </FramePanel>
          {!!data?.count && (
            <FrameFooter className="flex-row items-center justify-between gap-3">
              <Muted className="text-xs">
                {t("ccn_transactions_count", { count: data.count })}
              </Muted>
              <Pagination
                data={{ totalCount: data.count }}
                cPage={page}
                defaultPerPage={PAGE_SIZE}
                onChange={(next) => update({ page: next })}
              />
            </FrameFooter>
          )}
        </Frame>
      </div>
      <TransactionSheet
        selected={selected}
        sourceUrl={`${EXPLORER_PATH}?direction=${direction}`}
        consoleClass={consoleTheme.className}
        onClose={() => setSelected(undefined)}
      />
    </Page>
  );
}
