import { HttpMethod, PaginatedResponse, apiRoutes } from "@/lib/request";

import type {
  BecknActionResponse,
  BecknCatalogs,
  BecknDiscoverBody,
  BecknMessage,
  BecknTransactionList,
  ReferralConfirmBody,
  ReferralSelectBody,
  ReferralTransactionRetrieve,
} from "@/types/ccn";

const BASE = "/api/care_ccn_be";

/** Care as the referring side (BAP): the FE drives discover → select → confirm. */
export const ccnReferralRoutes = apiRoutes({
  list: {
    path: `${BASE}/bap/referral/`,
    method: HttpMethod.GET,
    TResponse: {} as PaginatedResponse<BecknTransactionList>,
  },
  get: {
    path: `${BASE}/bap/referral/{transactionId}/`,
    method: HttpMethod.GET,
    TResponse: {} as ReferralTransactionRetrieve,
  },
  discover: {
    path: `${BASE}/bap/referral/discover/`,
    method: HttpMethod.POST,
    TRequest: {} as BecknDiscoverBody,
    TResponse: {} as BecknActionResponse,
  },
  catalogs: {
    path: `${BASE}/bap/referral/{transactionId}/catalogs/`,
    method: HttpMethod.GET,
    TResponse: {} as BecknCatalogs,
  },
  select: {
    path: `${BASE}/bap/referral/{transactionId}/select/`,
    method: HttpMethod.POST,
    TRequest: {} as ReferralSelectBody,
    TResponse: {} as BecknActionResponse,
  },
  init: {
    path: `${BASE}/bap/referral/{transactionId}/init/`,
    method: HttpMethod.POST,
    TRequest: {} as ReferralConfirmBody,
    TResponse: {} as BecknActionResponse,
  },
  confirm: {
    path: `${BASE}/bap/referral/{transactionId}/confirm/`,
    method: HttpMethod.POST,
    TRequest: {} as ReferralConfirmBody,
    TResponse: {} as BecknActionResponse,
  },
  status: {
    path: `${BASE}/bap/referral/{transactionId}/status/`,
    method: HttpMethod.POST,
    TRequest: {} as Record<string, never>,
    TResponse: {} as BecknActionResponse,
  },
});

/** Care as the receiving side (BPP): read-only. */
export const ccnIncomingReferralRoutes = apiRoutes({
  list: {
    path: `${BASE}/bpp/referral/`,
    method: HttpMethod.GET,
    TResponse: {} as PaginatedResponse<BecknTransactionList>,
  },
  get: {
    path: `${BASE}/bpp/referral/{transactionId}/`,
    method: HttpMethod.GET,
    TResponse: {} as ReferralTransactionRetrieve,
  },
});

/** Stored requests and callbacks; `transaction_id` is a required query param. */
export const ccnMessageRoutes = apiRoutes({
  bap: {
    path: `${BASE}/bap/message/`,
    method: HttpMethod.GET,
    TResponse: {} as PaginatedResponse<BecknMessage>,
  },
  bpp: {
    path: `${BASE}/bpp/message/`,
    method: HttpMethod.GET,
    TResponse: {} as PaginatedResponse<BecknMessage>,
  },
});
