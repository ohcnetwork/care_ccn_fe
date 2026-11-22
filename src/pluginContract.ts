/**
 * The parts of CARE's plugin contract (`care_fe/src/pluginTypes.ts`) this app
 * implements. A remote app cannot import host modules, so the shapes are
 * repeated here; keep them in step with core.
 */
import type { ComponentType, ReactNode } from "react";

import type {
  QuestionnaireRead,
  ReferralQuestionnaireResult,
  ReferralRetrieve,
} from "@/types/care";

/** A translation key with its interpolation values. */
export interface PluginMessage {
  key: string;
  values?: Record<string, unknown>;
}

export interface PluginReferralDestination {
  key: string;
  label: string;
}

export interface PluginResolvedReferralDestination {
  questionnaires: QuestionnaireRead[];
  emptyFormsMessage?: PluginMessage;
}

export interface PluginReferralDestinationError extends PluginMessage {
  recovery?: "reselect" | "resolve";
}

export interface PluginReferralSubmitInput<
  D extends PluginReferralDestination,
  R extends PluginResolvedReferralDestination,
> {
  destination: D;
  resolved: R;
  facilityId: string;
  patientId: string;
  encounterId?: string;
  title: string;
  note: string;
  values: Record<string, unknown>;
  form?: { questionnaireId: string; results: ReferralQuestionnaireResult[] };
}

export interface PluginReferralDestinationProvider<
  D extends PluginReferralDestination,
  R extends PluginResolvedReferralDestination,
> {
  type: string;
  label: string;
  /** A built-in destination type whose option this provider takes over. */
  replaces?: "facility" | "internal_organization" | "external_organization";
  Picker: ComponentType<{
    facilityId: string;
    selected: D | null;
    onSelect: (destination: D | null, options?: { auto?: boolean }) => void;
    refreshKey: number;
  }>;
  resolve: (destination: D, signal: AbortSignal) => Promise<R>;
  Summary: ComponentType<{ destination: D; resolved?: R }>;
  fields?: {
    title: string;
    defaultValues: Record<string, unknown>;
    Edit: ComponentType<{
      id: string;
      values: Record<string, unknown>;
      onChange: (values: Record<string, unknown>) => void;
    }>;
    Review: ComponentType<{ values: Record<string, unknown> }>;
  };
  submit: (
    input: PluginReferralSubmitInput<D, R>,
    onProgress: (message: PluginMessage) => void,
    signal?: AbortSignal,
  ) => Promise<ReferralRetrieve>;
  describeError: (error: Error) => PluginReferralDestinationError;
  successMessage?: string;
}

export interface PluginNavigationLink {
  name: string;
  /** Relative to the facility, e.g. `network_referrals`. */
  url: string;
  icon?: ReactNode;
}
