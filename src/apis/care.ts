import { HttpMethod, PaginatedResponse, apiRoutes } from "@/lib/request";

import type {
  PatientRead,
  ReferralAvailabilityRead,
  ReferralRetrieve,
} from "@/types/care";

/** CARE core endpoints this app reads. */
export const careRoutes = apiRoutes({
  getReferralAvailability: {
    method: HttpMethod.GET,
    path: "/api/v1/referral_availability/{availabilityId}/",
    TResponse: {} as ReferralAvailabilityRead,
  },
  listReferralAvailabilities: {
    method: HttpMethod.GET,
    path: "/api/v1/referral_availability/",
    TResponse: {} as PaginatedResponse<ReferralAvailabilityRead>,
  },
  getPatient: {
    method: HttpMethod.GET,
    path: "/api/v1/patient/{patientId}/",
    TResponse: {} as PatientRead,
  },
  getReferral: {
    method: HttpMethod.GET,
    path: "/api/v1/referral/{referralId}/",
    TResponse: {} as ReferralRetrieve,
  },
});
