/**
 * The CARE core shapes this app reads or passes through. They mirror
 * `care_fe/src/types/emr/referral/*`, trimmed to the fields used here, so the
 * app builds without the host's type graph. Keep them in step with core.
 */

export type ReferralType = "consultation" | "lab";

export type ReferralQuestionnaireType = "request" | "response";

export type ReferralEntityType =
  "facility" | "internal_organization" | "external_organization" | "external";

interface Code {
  code: string;
  display?: string;
  system?: string;
}

export interface ReferralQuestionnaireResult {
  question_id: string;
  values: { value?: string | null; unit?: Code | null; coding?: Code | null }[];
  note?: string | null;
  taken_at?: string | null;
  body_site?: Code | null;
  method?: Code | null;
  sub_results?: ReferralQuestionnaireResult[][];
}

export interface ReferralQuestionnaireSubmission {
  results: ReferralQuestionnaireResult[];
}

/** Rendered by core's referral form; this app only passes it through. */
export interface QuestionnaireRead {
  id: string;
  slug: string;
  title: string;
  questions: unknown[];
  [key: string]: unknown;
}

export interface ReferralAvailabilityRead {
  id: string;
  name: string;
  description: string;
  referral_type: ReferralType;
  entity_type: ReferralEntityType;
}

export interface UserReadMinimal {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
}

export interface ReferralRead {
  id: string;
  title: string;
  availability: string;
  availability_name: string;
  patient: string;
  status: string;
}

export interface ReferralRetrieve extends ReferralRead {
  encounter: string | null;
}

export interface ReferralResource {
  id: string;
  referral: string;
  resource_type: string;
  resource_id: string;
  /** `ccn_ref` marks copies received from the linked network referral. */
  metadata?: Record<string, unknown>;
}
