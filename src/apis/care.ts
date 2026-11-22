import { HttpMethod, apiRoutes } from "@/lib/request";

import type { ReferralAvailabilityRead, ReferralRetrieve } from "@/types/care";

/** CARE core endpoints this app reads. */
export const careRoutes = apiRoutes({
  getReferralAvailability: {
    method: HttpMethod.GET,
    path: "/api/v1/referral_availability/{availabilityId}/",
    TResponse: {} as ReferralAvailabilityRead,
  },
  getReferral: {
    method: HttpMethod.GET,
    path: "/api/v1/referral/{referralId}/",
    TResponse: {} as ReferralRetrieve,
  },
});
