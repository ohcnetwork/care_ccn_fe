import { Badge } from "@/components/ui/badge";

import { useTranslation } from "@/hooks/useTranslation";

import { isAwaitingCallback, isFailedTransaction } from "@/types/ccn";

function statusGroup(status: string) {
  if (isFailedTransaction(status)) return "failed";
  if (status === "QUEUED") return "queued";
  if (status === "ON_CONFIRM") return "confirmed";
  if (isAwaitingCallback(status)) return "awaiting";
  return "responded";
}

const VARIANTS = {
  failed: "destructive",
  queued: "neutral",
  awaiting: "warning",
  confirmed: "success",
  responded: "info",
} as const;

export function BecknTransactionStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const group = statusGroup(status);
  return (
    <Badge variant={VARIANTS[group]} size="sm" dot title={status}>
      {t(`ccn_transaction_status__${group}`)}
      <span className="font-mono text-[0.65rem] opacity-70">{status}</span>
    </Badge>
  );
}
