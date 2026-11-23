import {
  NetworkTransactionError,
  networkBecknError,
  networkErrorDetail,
} from "@/components/network/networkReferral";

import { REFERRAL_ERROR_CODES } from "@/types/ccn";

export interface NetworkErrorMessage {
  /** Translation key. */
  key: string;
  values?: Record<string, unknown>;
  /**
   * `reselect`: the organization stopped accepting referrals, so it is
   * cleared and the network is searched again. `resolve`: its forms changed,
   * so they are loaded again.
   */
  recovery?: "reselect" | "resolve";
}

/** Why sending a network referral failed, and how the user can recover. */
export function describeNetworkError(error: Error): NetworkErrorMessage {
  const becknError = networkBecknError(error);
  const detail = becknError?.message;
  switch (becknError?.code) {
    case REFERRAL_ERROR_CODES.unavailable:
      return { key: "ccn_referral_error_unavailable", recovery: "reselect" };
    case REFERRAL_ERROR_CODES.formRequired:
      return { key: "ccn_referral_error_form_required" };
    case REFERRAL_ERROR_CODES.formInvalid:
      // A rejection that is not about specific answers means the form changed.
      return becknError.paths?.length
        ? { key: "ccn_referral_error_form_invalid", values: { detail } }
        : {
            key: "ccn_referral_error_form_changed",
            values: { detail },
            recovery: "resolve",
          };
  }
  if (error instanceof NetworkTransactionError) {
    return error.reason === "timeout"
      ? { key: "ccn_network_timeout" }
      : {
          key: "ccn_network_request_failed",
          values: {
            detail: networkErrorDetail(error) ?? error.transaction?.status,
          },
        };
  }
  if (error.message === "ccn_referral_not_created") {
    return { key: "ccn_referral_not_created" };
  }
  return { key: "ccn_referral_send_failed" };
}
