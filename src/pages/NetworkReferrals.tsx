import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Network } from "lucide-react";
import { useState } from "react";

import { query } from "@/lib/request";
import { PaginatedResponse } from "@/lib/request";
import { CCN_SCOPE } from "@/lib/scope";
import { formatDateTime } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Frame, FrameFooter, FramePanel } from "@/components/ui/frame";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Muted,
  CareUIPageTitle as PageTitle,
} from "@/components/ui/typography";

import Page from "@/components/common/Page";
import Pagination from "@/components/common/Pagination";
import { BecknTransactionStatusBadge } from "@/components/network/BecknTransactionStatusBadge";
import { NETWORK_POLL_INTERVAL_MS } from "@/components/network/networkReferral";

import { useTranslation } from "@/hooks/useTranslation";

import {
  ccnIncomingReferralRoutes,
  ccnMessageRoutes,
  ccnReferralRoutes,
} from "@/apis/ccn";
import {
  BecknTransactionList,
  ReferralTransactionRetrieve,
  isAwaitingCallback,
} from "@/types/ccn";

const PAGE_SIZE = 15;

type Direction = "outgoing" | "incoming";

const API_FOR: Record<
  Direction,
  typeof ccnReferralRoutes | typeof ccnIncomingReferralRoutes
> = {
  outgoing: ccnReferralRoutes,
  incoming: ccnIncomingReferralRoutes,
};

const LIST_PATH = "/admin/network_referrals";

export default function NetworkReferrals() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tab = (useLocation().search as Record<string, unknown>).tab;
  const direction: Direction = tab === "incoming" ? "incoming" : "outgoing";
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<BecknTransactionList>();
  const { data, isLoading, isError, refetch } = useQuery<
    PaginatedResponse<BecknTransactionList>
  >({
    queryKey: ["ccn", "referral", direction, "list", page],
    queryFn: query(API_FOR[direction].list, {
      queryParams: { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
      silent: true,
    }),
    refetchInterval: (q) =>
      q.state.data?.results.some((item) => isAwaitingCallback(item.status))
        ? NETWORK_POLL_INTERVAL_MS * 2
        : false,
  });

  return (
    <Page title={t("ccn_network_referrals")} hideTitleOnPage>
      <div className="space-y-6 px-3 pb-6 md:px-0">
        <header className="space-y-2">
          <PageTitle>{t("ccn_network_referrals")}</PageTitle>
          <Muted className="max-w-3xl">
            {t("ccn_network_referrals_description")}
          </Muted>
        </header>
        <Tabs
          value={direction}
          onValueChange={(value) => {
            setPage(1);
            void navigate({
              to: ".",
              search: (prev: Record<string, unknown>) => ({
                ...prev,
                tab: value as Direction,
              }),
            });
          }}
        >
          <TabsList>
            <TabsTrigger value="outgoing" data-cy="ccn-tab-outgoing">
              {t("ccn_outgoing")}
            </TabsTrigger>
            <TabsTrigger value="incoming" data-cy="ccn-tab-incoming">
              {t("ccn_incoming")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Frame>
          <FramePanel className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }, (_, index) => (
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
                  <EmptyTitle>{t(`ccn_empty_${direction}_title`)}</EmptyTitle>
                  <EmptyDescription>
                    {t(`ccn_empty_${direction}_description`)}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">
                      {t("ccn_transaction")}
                    </TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("ccn_counterparty")}</TableHead>
                    <TableHead className="pr-4">{t("last_modified")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.results.map((transaction) => (
                    <TableRow
                      key={transaction.id}
                      data-cy="ccn-transaction-row"
                    >
                      <TableCell className="py-3 pl-4">
                        <Button
                          variant="link"
                          className="h-auto p-0 font-mono text-xs"
                          onClick={() => setSelected(transaction)}
                        >
                          {transaction.transaction_id}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <BecknTransactionStatusBadge
                          status={transaction.status}
                        />
                      </TableCell>
                      <TableCell className="max-w-52 truncate text-muted-foreground">
                        {transaction.counterparty_id || "—"}
                      </TableCell>
                      <TableCell className="pr-4 text-muted-foreground">
                        {transaction.modified_date
                          ? formatDateTime(transaction.modified_date)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </FramePanel>
          {!!data?.count && data.count > PAGE_SIZE && (
            <FrameFooter className="flex-row justify-end">
              <Pagination
                data={{ totalCount: data.count }}
                cPage={page}
                defaultPerPage={PAGE_SIZE}
                onChange={setPage}
              />
            </FrameFooter>
          )}
        </Frame>
      </div>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(undefined)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <div className={CCN_SCOPE}>
            {selected && (
              <NetworkTransactionDetails
                direction={direction}
                transactionId={selected.transaction_id}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Page>
  );
}

function NetworkTransactionDetails({
  direction,
  transactionId,
}: {
  direction: Direction;
  transactionId: string;
}) {
  const { t } = useTranslation();
  const adapter = direction === "outgoing" ? "bap" : "bpp";
  const { data: transaction, isLoading } =
    useQuery<ReferralTransactionRetrieve>({
      queryKey: ["ccn", "referral", direction, "transaction", transactionId],
      queryFn: query(API_FOR[direction].get, {
        pathParams: { transactionId },
        silent: true,
      }),
      refetchInterval: (q) =>
        isAwaitingCallback(q.state.data?.status)
          ? NETWORK_POLL_INTERVAL_MS
          : false,
    });
  const { data: messages } = useQuery({
    queryKey: ["ccn", "messages", adapter, transactionId],
    queryFn: query(ccnMessageRoutes[adapter], {
      queryParams: { transaction_id: transactionId, limit: 50 },
      silent: true,
    }),
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle>{t("ccn_transaction")}</SheetTitle>
        <SheetDescription className="break-all font-mono text-xs">
          {transactionId}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4 pb-6">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {transaction && (
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">{t("status")}</dt>
              <dd className="mt-1">
                <BecknTransactionStatusBadge status={transaction.status} />
              </dd>
            </div>
            {transaction.last_error && (
              <div role="alert">
                <dt className="text-muted-foreground">{t("ccn_last_error")}</dt>
                <dd className="mt-1 line-clamp-4 break-all text-destructive">
                  {transaction.last_error.message ??
                    transaction.last_error.code}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">{t("referral")}</dt>
              <dd className="mt-1">
                {transaction.referral_id ? (
                  <Link
                    to="/referrals/$referralId"
                    params={{ referralId: transaction.referral_id }}
                    search={{
                      sourceUrl: `${LIST_PATH}?tab=${direction}`,
                      ccnTransactionId: transactionId,
                    }}
                    className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                    data-cy="ccn-open-referral"
                  >
                    {t("ccn_open_referral")}
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="text-muted-foreground">
                    {t("ccn_no_linked_referral")}
                  </span>
                )}
              </dd>
            </div>
            {transaction.counterparty_id && (
              <div>
                <dt className="text-muted-foreground">
                  {t("ccn_counterparty")}
                </dt>
                <dd className="mt-1 break-all">
                  {transaction.counterparty_id}
                  {transaction.counterparty_uri && (
                    <span className="block text-xs text-muted-foreground">
                      {transaction.counterparty_uri}
                    </span>
                  )}
                </dd>
              </div>
            )}
            {transaction.contract_id && (
              <div>
                <dt className="text-muted-foreground">
                  {t("ccn_contract_id")}
                </dt>
                <dd className="mt-1 break-all font-mono text-xs">
                  {transaction.contract_id}
                </dd>
              </div>
            )}
          </dl>
        )}
        {!!messages?.results.length && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">
              {t("ccn_network_activity")}
            </h3>
            <ol className="space-y-1.5 text-sm">
              {messages.results.map((message) => (
                <li
                  key={message.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <span className="font-mono text-xs">
                    {message.direction === "in" ? "←" : "→"}{" "}
                    {message.action.toUpperCase()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {message.delivery_status || message.processing_status}
                    {message.created_date &&
                      ` · ${formatDateTime(message.created_date)}`}
                  </span>
                  {message.last_error && (
                    <span
                      className="line-clamp-3 w-full break-all text-xs text-destructive"
                      title={message.last_error}
                    >
                      {message.last_error}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </>
  );
}
