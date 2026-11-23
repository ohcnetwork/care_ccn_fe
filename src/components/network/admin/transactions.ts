import { useQuery } from "@tanstack/react-query";

import { query } from "@/lib/request";

import { NETWORK_POLL_INTERVAL_MS } from "@/components/network/networkReferral";

import { careRoutes } from "@/apis/care";
import {
  ccnIncomingReferralRoutes,
  ccnMessageRoutes,
  ccnReferralRoutes,
} from "@/apis/ccn";
import type { ReferralRetrieve } from "@/types/care";
import {
  type BecknAdapter,
  type BecknMessage,
  type ReferralTransactionRetrieve,
  isAwaitingCallback,
} from "@/types/ccn";

/**
 * Outbound: this instance referred (BAP, `bap/referral/`).
 * Inbound: another participant referred to this instance (BPP, `bpp/referral/`).
 */
export type TransactionDirection = "outbound" | "inbound";

export const DIRECTIONS: TransactionDirection[] = ["outbound", "inbound"];

export const ADMIN_PATH = "/admin/network_referrals";
export const EXPLORER_PATH = `${ADMIN_PATH}/explorer`;

export const API_FOR = {
  outbound: ccnReferralRoutes,
  inbound: ccnIncomingReferralRoutes,
} as const;

export const ADAPTER_FOR: Record<TransactionDirection, BecknAdapter> = {
  outbound: "bap",
  inbound: "bpp",
};

export function directionOf(adapter: BecknAdapter): TransactionDirection {
  return adapter === "bpp" ? "inbound" : "outbound";
}

/** The backend's open status set: QUEUED, <ACTION>, ON_<ACTION>, NACK, ERROR. */
const ACTIONS = [
  "DISCOVER",
  "SELECT",
  "INIT",
  "CONFIRM",
  "STATUS",
  "UPDATE",
  "CANCEL",
];
export const TRANSACTION_STATUSES = [
  "QUEUED",
  ...ACTIONS.flatMap((action) => [action, `ON_${action}`]),
  "NACK",
  "ERROR",
];

const MESSAGE_LIMIT = 100;

/** The transaction with its linked referral id (shared with the details sheet). */
export function useTransaction(
  direction: TransactionDirection,
  transactionId: string,
  { poll = false }: { poll?: boolean } = {},
) {
  return useQuery<ReferralTransactionRetrieve>({
    queryKey: ["ccn", "referral", direction, "transaction", transactionId],
    queryFn: query(API_FOR[direction].get, {
      pathParams: { transactionId },
      silent: true,
    }),
    staleTime: 30_000,
    refetchInterval: (q) =>
      poll && isAwaitingCallback(q.state.data?.status)
        ? NETWORK_POLL_INTERVAL_MS
        : false,
  });
}

/** Every stored request and callback of the transaction, oldest first. */
export function useTransactionMessages(
  direction: TransactionDirection,
  transactionId: string,
) {
  const adapter = ADAPTER_FOR[direction];
  return useQuery({
    queryKey: ["ccn", "messages", adapter, transactionId],
    queryFn: query(ccnMessageRoutes[adapter], {
      queryParams: { transaction_id: transactionId, limit: MESSAGE_LIMIT },
      silent: true,
    }),
    staleTime: 30_000,
  });
}

/** The CARE referral the transaction is linked to, if any. */
export function useLinkedReferral(referralId?: string | null) {
  return useQuery<ReferralRetrieve>({
    queryKey: ["ccn", "care-referral", referralId],
    queryFn: query(careRoutes.getReferral, {
      pathParams: { referralId: referralId ?? "" },
      silent: true,
    }),
    enabled: !!referralId,
    staleTime: 60_000,
    retry: false,
  });
}

export const isCallback = (message: BecknMessage) =>
  message.action.toLowerCase().startsWith("on_");

/** The status a message reached: delivery for what we sent, processing for what we received. */
export function messageStatus(message: BecknMessage) {
  return message.direction === "out"
    ? message.delivery_status
    : message.processing_status;
}

export type ResponseTone = "success" | "warning" | "destructive" | "neutral";

export function messageTone(message: BecknMessage): ResponseTone {
  const status = messageStatus(message);
  if (message.last_error || ["nacked", "failed"].includes(status)) {
    return "destructive";
  }
  if (["acked", "processed"].includes(status)) return "success";
  if (["queued", "pending"].includes(status)) return "warning";
  return "neutral";
}

export interface ResponseSummary {
  /** The latest callback (`on_*`), or the latest request when none came back. */
  message?: BecknMessage;
  kind: "response" | "request" | "none";
}

/**
 * The response of a transaction: the latest callback (`on_*`) in either
 * direction. Outbound, that is the counterparty's answer we processed; inbound,
 * it is our answer and its delivery. Without one, the latest request (so a
 * NACKed or undelivered request still shows).
 */
export function summarizeResponse(
  messages: BecknMessage[] | undefined,
): ResponseSummary {
  if (!messages?.length) return { kind: "none" };
  const latest = [...messages].reverse();
  const response = latest.find(isCallback);
  if (response) return { kind: "response", message: response };
  return { kind: "request", message: latest[0] };
}
