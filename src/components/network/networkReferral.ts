import { request } from "@/lib/request";
import { HttpError } from "@/lib/request";
import { sleep } from "@/lib/utils";

import { ccnReferralRoutes } from "@/apis/ccn";
import {
  BecknLastError,
  NetworkOffer,
  NetworkReferralBodyInput,
  ReferralTransactionRetrieve,
  isFailedTransaction,
  networkReferralBody,
  networkSelectBody,
  transactionErrorText,
} from "@/types/ccn";

export const NETWORK_POLL_INTERVAL_MS = 1500;
const CALLBACK_TIMEOUT_MS = 90_000;

export class NetworkTransactionError extends Error {
  constructor(
    readonly reason: "failed" | "timeout",
    readonly transaction?: ReferralTransactionRetrieve,
  ) {
    super(reason);
  }
}

/** Polls the transaction until the `on_<action>` callback for it is stored. */
async function waitForCallback(
  transactionId: string,
  action: string,
  signal?: AbortSignal,
): Promise<ReferralTransactionRetrieve> {
  const expected = `ON_${action.toUpperCase()}`;
  const deadline = Date.now() + CALLBACK_TIMEOUT_MS;
  for (;;) {
    signal?.throwIfAborted();
    const transaction = await request(ccnReferralRoutes.get, {
      pathParams: { transactionId },
      silent: true,
      signal,
    });
    if (transaction.status === expected) return transaction;
    if (isFailedTransaction(transaction.status)) {
      throw new NetworkTransactionError("failed", transaction);
    }
    if (Date.now() > deadline) {
      throw new NetworkTransactionError("timeout", transaction);
    }
    await sleep(NETWORK_POLL_INTERVAL_MS);
  }
}

export interface NetworkReferralRequest extends NetworkReferralBodyInput {
  offer: NetworkOffer;
}

export type NetworkReferralStep = "init" | "confirm";

/**
 * Selects a discovered offer and waits for `on_select`. The returned
 * transaction carries the receiving `availability` and the request forms the
 * referral has to answer before `init` / `confirm`.
 */
export async function selectNetworkOffer(
  offer: NetworkOffer,
  signal?: AbortSignal,
): Promise<ReferralTransactionRetrieve> {
  const transactionId = offer.transactionId;
  await request(ccnReferralRoutes.select, {
    pathParams: { transactionId },
    body: networkSelectBody(offer),
    signal,
  });
  return waitForCallback(transactionId, "select", signal);
}

/**
 * Sends a selected offer: `init` lets the receiving side validate the request
 * form without creating anything, then `confirm` creates both referrals. The
 * origin Care referral is exposed as `referral_id`. A rejected `init` can be
 * fixed and resent on the same transaction.
 */
export async function submitNetworkReferral(
  referral: NetworkReferralRequest,
  onStep: (step: NetworkReferralStep) => void,
  signal?: AbortSignal,
): Promise<ReferralTransactionRetrieve> {
  const transactionId = referral.offer.transactionId;
  const body = networkReferralBody(referral);

  onStep("init");
  await request(ccnReferralRoutes.init, {
    pathParams: { transactionId },
    body,
    signal,
  });
  await waitForCallback(transactionId, "init", signal);

  onStep("confirm");
  await request(ccnReferralRoutes.confirm, {
    pathParams: { transactionId },
    body,
    signal,
  });
  return waitForCallback(transactionId, "confirm", signal);
}

export function networkErrorDetail(error: unknown): string | undefined {
  if (!(error instanceof NetworkTransactionError)) return undefined;
  return transactionErrorText(error.transaction?.last_error);
}

/**
 * The Beckn error behind a failed network action: the receiving BPP's
 * `last_error`, or the `beckn_error` the plugin answered the action with.
 */
export function networkBecknError(error: unknown): BecknLastError | undefined {
  if (error instanceof NetworkTransactionError) {
    return error.transaction?.last_error ?? undefined;
  }
  if (!(error instanceof HttpError) || error.status !== 400) return undefined;
  const errors = (error.cause as { errors?: unknown } | undefined)?.errors;
  if (!Array.isArray(errors)) return undefined;
  const becknError = errors.find(
    (item): item is { code?: unknown; msg?: unknown } =>
      !!item &&
      typeof item === "object" &&
      (item as { type?: unknown }).type === "beckn_error",
  );
  if (!becknError) return undefined;
  return {
    code: typeof becknError.code === "string" ? becknError.code : undefined,
    message: typeof becknError.msg === "string" ? becknError.msg : undefined,
  };
}
