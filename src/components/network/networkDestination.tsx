import { request } from "@/lib/request";
import { CcnScope } from "@/lib/scope";

import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  NetworkDestinationSearch,
  NetworkOfferKindBadge,
} from "@/components/network/NetworkDestinationSearch";
import {
  NetworkTransactionError,
  networkBecknError,
  networkErrorDetail,
  selectNetworkOffer,
  submitNetworkReferral,
} from "@/components/network/networkReferral";

import { useTranslation } from "@/hooks/useTranslation";

import { careRoutes } from "@/apis/care";
import type {
  PluginReferralDestinationError,
  PluginReferralDestinationProvider,
} from "@/pluginContract";
import type { QuestionnaireRead } from "@/types/care";
import {
  NetworkOffer,
  NetworkReferralAvailability,
  REFERRAL_ERROR_CODES,
  REFERRAL_URGENCIES,
  ReferralUrgency,
  networkOfferLabel,
  networkOfferReferralType,
  networkOfferValue,
  networkRequestForms,
} from "@/types/ccn";

/** A discovered network offer, as CARE's create-referral dialog holds it. */
export interface NetworkDestination {
  /** Same for the same offer within one discover transaction. */
  key: string;
  label: string;
  offer: NetworkOffer;
}

export interface ResolvedNetworkDestination {
  questionnaires: QuestionnaireRead[];
  emptyFormsMessage?: { key: string };
  /** The receiving availability from `on_select`; none for a coordination desk. */
  availability?: NetworkReferralAvailability | null;
}

function toDestination(offer: NetworkOffer): NetworkDestination {
  return {
    key: `${offer.transactionId}|${networkOfferValue(offer)}|${offer.context.bpp_uri}`,
    label: networkOfferLabel(offer),
    offer,
  };
}

function urgencyOf(values: Record<string, unknown>): ReferralUrgency {
  return REFERRAL_URGENCIES.includes(values.urgency as ReferralUrgency)
    ? (values.urgency as ReferralUrgency)
    : "routine";
}

function NetworkPicker({
  selected,
  onSelect,
  refreshKey,
}: {
  facilityId: string;
  selected: NetworkDestination | null;
  onSelect: (
    destination: NetworkDestination | null,
    options?: { auto?: boolean },
  ) => void;
  refreshKey: number;
}) {
  return (
    <CcnScope>
      <NetworkDestinationSearch
        selected={selected?.offer ?? null}
        onSelect={(offer, options) =>
          onSelect(offer ? toDestination(offer) : null, options)
        }
        rediscoverKey={refreshKey}
      />
    </CcnScope>
  );
}

function NetworkSummary({
  destination,
  resolved,
}: {
  destination: NetworkDestination;
  resolved?: ResolvedNetworkDestination;
}) {
  const { t } = useTranslation();
  const { offer } = destination;
  const referralType = networkOfferReferralType(offer, resolved?.availability);
  return (
    <CcnScope>
      <div className="space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {destination.label}
          <Badge variant="info" size="xs">
            {t("ccn_network")}
          </Badge>
          <NetworkOfferKindBadge kind={offer.kind} />
        </p>
        <p className="text-sm text-muted-foreground">
          {[
            referralType && t(`referral_type_${referralType}`),
            offer.organizationName,
            offer.context.bpp_id,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {resolved?.availability?.description && (
          <p className="text-sm text-muted-foreground">
            {resolved.availability.description}
          </p>
        )}
      </div>
    </CcnScope>
  );
}

function UrgencyEdit({
  id,
  values,
  onChange,
}: {
  id: string;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  return (
    <CcnScope>
      <Field className="max-w-xs">
        <FieldLabel htmlFor={`${id}-urgency`}>{t("ccn_urgency")}</FieldLabel>
        <Select
          value={urgencyOf(values)}
          onValueChange={(value) => onChange({ ...values, urgency: value })}
        >
          <SelectTrigger id={`${id}-urgency`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REFERRAL_URGENCIES.map((item) => (
              <SelectItem key={item} value={item}>
                {t(`ccn_urgency__${item}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <p className="text-sm text-muted-foreground">
        {t("ccn_network_referral_description")}
      </p>
    </CcnScope>
  );
}

function UrgencyReview({ values }: { values: Record<string, unknown> }) {
  const { t } = useTranslation();
  return (
    <CcnScope>
      <p className="text-sm">
        {t("ccn_urgency")}: {t(`ccn_urgency__${urgencyOf(values)}`)}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("ccn_network_referral_description")}
      </p>
    </CcnScope>
  );
}

function describeNetworkError(error: Error): PluginReferralDestinationError {
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
  return { key: "referral_create_failed" };
}

/**
 * Refers a patient to an organization found on the CCN network. It takes
 * over CARE's "Organizations" destination type: picking it searches the
 * network and runs the network workflow (`select` → `init` → `confirm`).
 */
export const networkReferralDestination: PluginReferralDestinationProvider<
  NetworkDestination,
  ResolvedNetworkDestination
> = {
  type: "ccn_network",
  label: "ccn_destination_type",
  replaces: "external_organization",
  Picker: NetworkPicker,
  // `select` returns the receiving availability and the request forms to fill.
  resolve: async (destination, signal) => {
    const transaction = await selectNetworkOffer(destination.offer, signal);
    return {
      questionnaires: networkRequestForms(transaction.availability),
      availability: transaction.availability,
      // A coordination desk assigns the facility itself and has no forms.
      emptyFormsMessage:
        destination.offer.kind === "coordinator"
          ? undefined
          : { key: "ccn_network_no_request_form" },
    };
  },
  Summary: NetworkSummary,
  fields: {
    title: "ccn_network_details",
    defaultValues: { urgency: "routine" },
    Edit: UrgencyEdit,
    Review: UrgencyReview,
  },
  submit: async (input, onProgress, signal) => {
    const transaction = await submitNetworkReferral(
      {
        offer: input.destination.offer,
        availability: input.resolved.availability,
        form: input.form,
        facilityId: input.facilityId,
        patientId: input.patientId,
        encounterId: input.encounterId,
        title: input.title,
        reason: input.note,
        referralType: networkOfferReferralType(
          input.destination.offer,
          input.resolved.availability,
        ),
        urgency: urgencyOf(input.values),
      },
      (step) => onProgress({ key: `ccn_sending_${step}` }),
      signal,
    );
    if (!transaction.referral_id) {
      throw new Error("ccn_referral_not_created");
    }
    return request(careRoutes.getReferral, {
      pathParams: { referralId: transaction.referral_id },
      signal,
    });
  },
  describeError: describeNetworkError,
  successMessage: "ccn_referral_sent",
};
