import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { type ReactNode, useState } from "react";

import { CCN_SCOPE } from "@/lib/scope";
import { cn, formatDateTime } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

import { BecknTransactionStatusBadge } from "@/components/network/BecknTransactionStatusBadge";
import {
  DirectionLabel,
  ReferralStatusBadge,
} from "@/components/network/admin/TransactionTable";
import {
  type TransactionDirection,
  isCallback,
  messageStatus,
  messageTone,
  useLinkedReferral,
  useTransaction,
  useTransactionMessages,
} from "@/components/network/admin/transactions";

import { useTranslation } from "@/hooks/useTranslation";

import type { BecknMessage } from "@/types/ccn";

export interface SelectedTransaction {
  direction: TransactionDirection;
  transactionId: string;
}

export function TransactionSheet({
  selected,
  sourceUrl,
  onClose,
  consoleClass,
}: {
  selected?: SelectedTransaction;
  /** The explorer's console skin (portalled, so it is not inherited). */
  consoleClass?: string;
  /** Where CARE's referral page returns to. */
  sourceUrl: string;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!selected} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className={cn(
          "w-full overflow-y-auto sm:max-w-2xl",
          consoleClass && `${CCN_SCOPE} ${consoleClass}`,
        )}
      >
        <div className={CCN_SCOPE}>
          {selected && (
            <TransactionDetails {...selected} sourceUrl={sourceUrl} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-all text-sm">{children}</dd>
    </div>
  );
}

function TransactionDetails({
  direction,
  transactionId,
  sourceUrl,
}: SelectedTransaction & { sourceUrl: string }) {
  const { t } = useTranslation();
  const { data: transaction, isLoading } = useTransaction(
    direction,
    transactionId,
    { poll: true },
  );
  const referral = useLinkedReferral(transaction?.referral_id);
  const messages = useTransactionMessages(direction, transactionId);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          {t("ccn_transaction")}
          <DirectionLabel direction={direction} />
        </SheetTitle>
        <SheetDescription className="break-all font-mono text-xs">
          {transactionId}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-6 px-4 pb-6">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {transaction && (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label={t("ccn_transaction_status")}>
              <BecknTransactionStatusBadge status={transaction.status} />
            </Field>
            <Field label={t("ccn_referral_status")}>
              {transaction.referral_id ? (
                <span className="flex flex-wrap items-center gap-2">
                  {referral.data && (
                    <ReferralStatusBadge status={referral.data.status} />
                  )}
                  <Link
                    to="/referrals/$referralId"
                    params={{ referralId: transaction.referral_id }}
                    search={{ sourceUrl, ccnTransactionId: transactionId }}
                    className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                    data-cy="ccn-open-referral"
                  >
                    {t("ccn_open_referral")}
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {t("ccn_no_linked_referral")}
                </span>
              )}
            </Field>
            {transaction.last_error && (
              <div role="alert" className="sm:col-span-2">
                <Field label={t("ccn_last_error")}>
                  <span className="text-destructive">
                    {[
                      transaction.last_error.code,
                      transaction.last_error.message,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </Field>
              </div>
            )}
            <Field label={t("ccn_counterparty")}>
              {transaction.counterparty_id || "—"}
              {transaction.counterparty_uri && (
                <span className="block text-xs text-muted-foreground">
                  {transaction.counterparty_uri}
                </span>
              )}
            </Field>
            <Field label={t("ccn_network_id")}>
              {transaction.network_id || "—"}
            </Field>
            {transaction.contract_id && (
              <Field label={t("ccn_contract_id")}>
                <span className="font-mono text-xs">
                  {transaction.contract_id}
                </span>
              </Field>
            )}
            <Field label={t("ccn_created")}>
              {transaction.created_date
                ? formatDateTime(transaction.created_date)
                : "—"}
            </Field>
            <Field label={t("last_modified")}>
              {transaction.modified_date
                ? formatDateTime(transaction.modified_date)
                : "—"}
            </Field>
          </dl>
        )}

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            {t("ccn_response_logs")}
            {!!messages.data?.count && (
              <span className="ml-1 font-normal text-muted-foreground">
                ({messages.data.count})
              </span>
            )}
          </h3>
          {messages.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : !messages.data?.results.length ? (
            <p className="text-sm text-muted-foreground">
              {t("ccn_no_messages")}
            </p>
          ) : (
            <ol className="space-y-2" data-cy="ccn-response-logs">
              {messages.data.results.map((message) => (
                <MessageLog key={message.id} message={message} />
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}

function MessageLog({ message }: { message: BecknMessage }) {
  const { t } = useTranslation();
  const status = messageStatus(message);
  return (
    <li className="rounded-md border border-border text-sm">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="font-mono text-xs">
          {message.direction === "in" ? "←" : "→"}{" "}
          {message.action.toUpperCase()}
        </span>
        <Badge variant="neutral" size="sm">
          {t(isCallback(message) ? "ccn_log_response" : "ccn_log_request")}
        </Badge>
        {status && (
          <Badge variant={messageTone(message)} size="sm">
            {status}
          </Badge>
        )}
        {message.attempts > 1 && (
          <span className="text-xs text-muted-foreground">
            {t("ccn_attempts", { count: message.attempts })}
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {message.created_date ? formatDateTime(message.created_date) : ""}
        </span>
      </div>
      <div className="space-y-1 border-t border-border px-3 py-2">
        <p className="break-all font-mono text-[11px] text-muted-foreground">
          {message.message_id}
        </p>
        {message.last_error && (
          <p className="break-all text-xs text-destructive">
            {message.last_error}
          </p>
        )}
        {message.payload?.error && (
          <JsonBlock label={t("ccn_log_error")} value={message.payload.error} />
        )}
        {message.ack && (
          <JsonBlock label={t("ccn_log_ack")} value={message.ack} />
        )}
        <JsonBlock label={t("ccn_log_payload")} value={message.payload} />
      </div>
    </li>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(value, null, 2);
  return (
    <details className="group">
      <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">
        {label}
      </summary>
      <div className="relative mt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="absolute right-2 top-2 h-6 px-2 text-[11px]"
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? (
            <Check className="size-3" aria-hidden="true" />
          ) : (
            <Copy className="size-3" aria-hidden="true" />
          )}
          {t("ccn_copy")}
        </Button>
        <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] leading-relaxed">
          {text}
        </pre>
      </div>
    </details>
  );
}
