import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { formatDateTime } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { BecknTransactionStatusBadge } from "@/components/network/BecknTransactionStatusBadge";
import {
  type TransactionDirection,
  directionOf,
  messageStatus,
  messageTone,
  summarizeResponse,
  useLinkedReferral,
  useTransaction,
  useTransactionMessages,
} from "@/components/network/admin/transactions";

import { useTranslation } from "@/hooks/useTranslation";

import type { BecknTransactionList } from "@/types/ccn";

export function humanize(value: string) {
  const text = value.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function DirectionLabel({
  direction,
}: {
  direction: TransactionDirection;
}) {
  const { t } = useTranslation();
  const Icon = direction === "outbound" ? ArrowUpRight : ArrowDownLeft;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="size-3.5" aria-hidden="true" />
      {t(`ccn_direction__${direction}`)}
    </span>
  );
}

export function ReferralStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const variant =
    status === "accepted" || status === "completed"
      ? "success"
      : status === "rejected" || status === "cancelled"
        ? "destructive"
        : "info";
  return (
    <Badge variant={variant} size="sm" title={status}>
      {t(`referral_status__${status}`, { defaultValue: humanize(status) })}
    </Badge>
  );
}

/** The status of the CARE referral linked to the transaction (2 lazy reads). */
function ReferralStatusCell({
  direction,
  transactionId,
}: {
  direction: TransactionDirection;
  transactionId: string;
}) {
  const { t } = useTranslation();
  const transaction = useTransaction(direction, transactionId);
  const referralId = transaction.data?.referral_id;
  const referral = useLinkedReferral(referralId);
  if (transaction.isLoading || referral.isLoading) {
    return <Skeleton className="h-5 w-20" />;
  }
  if (!referralId) {
    return (
      <span className="text-xs text-muted-foreground">
        {t("ccn_not_linked")}
      </span>
    );
  }
  if (!referral.data) {
    return (
      <span
        className="text-xs text-muted-foreground"
        title={t("ccn_referral_unreadable")}
      >
        {t("ccn_linked")}
      </span>
    );
  }
  return <ReferralStatusBadge status={referral.data.status} />;
}

/** The latest callback of the transaction and how it was handled. */
function ResponseCell({
  direction,
  transactionId,
}: {
  direction: TransactionDirection;
  transactionId: string;
}) {
  const { t } = useTranslation();
  const messages = useTransactionMessages(direction, transactionId);
  if (messages.isLoading) return <Skeleton className="h-5 w-24" />;
  const { kind, message } = summarizeResponse(messages.data?.results);
  if (!message) {
    return (
      <span className="text-xs text-muted-foreground">
        {t("ccn_no_messages")}
      </span>
    );
  }
  const status = messageStatus(message);
  return (
    <div className="grid w-max gap-0.5">
      <Badge
        variant={messageTone(message)}
        size="sm"
        className="w-fit"
        title={message.last_error || undefined}
      >
        <span className="font-mono">{message.action.toUpperCase()}</span>
        {status && <span className="opacity-80">· {status}</span>}
      </Badge>
      {kind === "request" && (
        <span className="text-[11px] text-muted-foreground">
          {t("ccn_no_response_yet")}
        </span>
      )}
    </div>
  );
}

/**
 * The dashboard's summary table passes neither `onSelect` nor `showResponse`:
 * rows are read-only there, and the details and response logs live in the
 * developer explorer only.
 */
export function TransactionTable({
  rows,
  showResponse = false,
  onSelect,
}: {
  rows: BecknTransactionList[];
  showResponse?: boolean;
  onSelect?: (row: BecknTransactionList) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <Table className={showResponse ? "min-w-[56rem]" : "min-w-[44rem]"}>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">{t("ccn_transaction_id")}</TableHead>
            <TableHead>{t("ccn_transaction_status")}</TableHead>
            <TableHead>{t("ccn_referral_status")}</TableHead>
            {showResponse && <TableHead>{t("ccn_response_status")}</TableHead>}
            <TableHead>{t("ccn_counterparty")}</TableHead>
            <TableHead className="pr-4">{t("last_modified")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const direction = directionOf(row.adapter);
            return (
              <TableRow key={row.id} data-cy="ccn-transaction-row">
                <TableCell className="py-3 pl-4">
                  {onSelect ? (
                    <Button
                      variant="link"
                      className="h-auto p-0 font-mono text-xs"
                      title={row.transaction_id}
                      onClick={() => onSelect(row)}
                    >
                      {row.transaction_id}
                    </Button>
                  ) : (
                    <span className="font-mono text-xs">
                      {row.transaction_id}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="grid w-max gap-0.5">
                    <BecknTransactionStatusBadge status={row.status} />
                    {row.last_error && (
                      <span
                        className="max-w-48 truncate text-[11px] text-destructive"
                        title={row.last_error.message ?? row.last_error.code}
                      >
                        {row.last_error.code ?? row.last_error.message}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <ReferralStatusCell
                    direction={direction}
                    transactionId={row.transaction_id}
                  />
                </TableCell>
                {showResponse && (
                  <TableCell>
                    <ResponseCell
                      direction={direction}
                      transactionId={row.transaction_id}
                    />
                  </TableCell>
                )}
                <TableCell
                  className="max-w-44 truncate text-muted-foreground"
                  title={row.counterparty_uri || undefined}
                >
                  {row.counterparty_id || "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap pr-4 text-muted-foreground">
                  {row.modified_date ? formatDateTime(row.modified_date) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
