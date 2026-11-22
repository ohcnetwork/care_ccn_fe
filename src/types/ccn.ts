import {
  ReferralAvailabilityRead,
  ReferralQuestionnaireResult,
  ReferralQuestionnaireSubmission,
  ReferralQuestionnaireType,
  ReferralType,
} from "@/types/care";
import { QuestionnaireRead } from "@/types/care";
import { UserReadMinimal } from "@/types/care";

export type BecknFlow = "referral" | "appointment";

export type BecknAdapter = "bap" | "bpp";

/**
 * Lifecycle of a plugin transaction: `QUEUED` until ONIX acknowledges the
 * request, then the uppercase action (e.g. `SELECT`) and `ON_<ACTION>` once
 * the callback is stored. `NACK` / `ERROR` carry `last_error`.
 */
export type BecknTransactionStatus = string;

export interface BecknLastError {
  code?: string;
  message?: string;
  /** Question ids the error is about (invalid request form answers). */
  paths?: string[];
  [key: string]: unknown;
}

/** Referral error codes, returned on actions (`400`) or by the receiving BPP in `last_error`. */
export const REFERRAL_ERROR_CODES = {
  /** The facility does not accept network referrals on the selected availability. */
  unavailable: "70005",
  /** The availability's request questionnaire was not answered. */
  formRequired: "70006",
  /** Invalid answers (`paths`), or the questionnaire changed: select again. */
  formInvalid: "70007",
} as const;

export interface BecknTransactionList {
  id: string;
  transaction_id: string;
  adapter: BecknAdapter;
  flow: BecknFlow;
  status: BecknTransactionStatus;
  network_id: string;
  counterparty_id: string;
  counterparty_uri: string;
  contract_id: string;
  coordination_id: string;
  last_error: BecknLastError | null;
  created_date: string | null;
  modified_date: string | null;
}

export interface BecknRouting {
  bap_id?: string;
  bap_uri?: string;
  bpp_id?: string;
  bpp_uri?: string;
}

export interface BecknTransactionRetrieve extends BecknTransactionList {
  routing: BecknRouting;
  context: Record<string, unknown>;
  actions: string[];
  patient: string | null;
  facility: string | null;
  created_by: UserReadMinimal | null;
}

export interface NetworkAvailabilityQuestionnaire {
  questionnaire_type: ReferralQuestionnaireType;
  /** Snapshot of the receiving instance's questionnaire, in Care's read shape. */
  questionnaire: QuestionnaireRead;
}

/** The receiving availability the BPP answered `on_select` with, and its forms. */
export interface NetworkReferralAvailability {
  id: string;
  name?: string;
  description?: string;
  referral_type?: string;
  facility_id?: string;
  facility_name?: string;
  questionnaires?: NetworkAvailabilityQuestionnaire[];
}

export interface ReferralTransactionRetrieve extends BecknTransactionRetrieve {
  /** The origin Care referral; `transaction_id` equals it for Care-created referrals. */
  referral_id: string | null;
  /** Set once `ON_SELECT` arrives from a BPP that publishes referral availabilities. */
  availability?: NetworkReferralAvailability | null;
  confirm: Record<string, unknown> | null;
}

export interface BecknMessage {
  id: number;
  transaction_id: string | null;
  message_id: string;
  action: string;
  direction: string;
  delivery_status: string;
  processing_status: string;
  attempts: number;
  last_error: string;
  payload: {
    context?: Record<string, unknown>;
    message?: Record<string, unknown>;
    error?: Record<string, unknown>;
  };
  ack: Record<string, unknown> | null;
  reply_to: number | null;
  created_date: string | null;
  modified_date: string | null;
}

/** Context overrides; the plugin validates all five routing keys as required. */
export interface BecknContextOverride {
  network_id: string;
  bap_id: string;
  bap_uri: string;
  bpp_id: string;
  bpp_uri: string;
  version?: string;
  ttl?: string;
  schema_context?: string[];
}

interface BecknActionBody {
  context?: BecknContextOverride;
  message?: Record<string, unknown>;
}

export interface BecknDiscoverBody extends BecknActionBody {
  health_service_type?: string;
  acceptance_mode?: string;
  text_search?: string;
  filters?: Record<string, unknown>;
}

export interface ReferralSelectBody extends BecknActionBody {
  offer_id: string;
}

/** The plugin maps `patient_care` to a consultation and anything else to a lab referral. */
export type ReferralNetworkCategory = "patient_care" | "other";

/**
 * `facility` is the origin Care facility the plugin creates the referral from.
 * `encounter` links the origin referral to that encounter; it stays in Care and
 * is never sent over the network. `questionnaire` / `questionnaire_response`
 * answer the selected availability's request form; they are required when it
 * has one. The same body is used for `init` (validation only) and `confirm`.
 */
export interface ReferralConfirmBody extends BecknActionBody {
  facility: string;
  patient?: string;
  patient_name?: string;
  encounter?: string;
  title?: string;
  reason?: string;
  category?: ReferralNetworkCategory;
  offer_id?: string;
  assigned_facility_id?: string;
  emergency?: boolean;
  priority?: number;
  questionnaire?: string;
  questionnaire_response?: ReferralQuestionnaireSubmission;
}

export interface BecknActionResponse {
  transaction_id: string;
  message_id: string;
  action: string;
  status: BecknTransactionStatus;
}

export interface BecknCatalogs {
  transaction_id: string;
  catalogs: Record<string, unknown>[];
}

export type ReferralUrgency = "routine" | "urgent" | "emergency";

export const REFERRAL_URGENCIES: ReferralUrgency[] = [
  "routine",
  "urgent",
  "emergency",
];

/**
 * What a referral offer stands for: a facility's referral availability
 * (`resourceAttributes.referralAvailability`, with its own forms) or a
 * coordination desk that assigns the receiving facility itself (no forms).
 */
export type NetworkOfferKind = "referral_unit" | "coordinator";

/** One referral offer flattened from an `on_discover` catalog. */
export interface NetworkOffer {
  key: string;
  transactionId: string;
  offerId: string;
  offerName?: string;
  providerId?: string;
  providerName?: string;
  catalogName?: string;
  kind: NetworkOfferKind;
  /** The referral types the offer accepts; empty when it does not say. */
  referralTypes: ReferralType[];
  /** The receiving organization of a referral unit. */
  organizationName?: string;
  context: BecknContextOverride;
}

/** The offers of one provider (facility), as returned by one BPP. */
export interface NetworkProvider {
  key: string;
  providerId?: string;
  name: string;
  bppId: string;
  offers: NetworkOffer[];
}

export function isNetworkAvailability(
  availability?: Pick<ReferralAvailabilityRead, "entity_type"> | null,
) {
  return availability?.entity_type === "external";
}

/** The forms the referring side fills before sending (`request`); `response` ones are answered by the receiver. */
export function networkRequestForms(
  availability?: NetworkReferralAvailability | null,
): QuestionnaireRead[] {
  return (availability?.questionnaires ?? [])
    .filter(
      (item) =>
        item.questionnaire_type === "request" && !!item.questionnaire?.id,
    )
    .map((item) => item.questionnaire);
}

export function isFailedTransaction(status?: string) {
  return status === "NACK" || status === "ERROR";
}

/** Gateway errors can carry whole HTML bodies; keep user-facing text short. */
export function transactionErrorText(
  lastError?: BecknLastError | null,
  maxLength = 200,
) {
  const text = lastError?.message ?? lastError?.code;
  if (!text) return undefined;
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

/** A request is in flight until its `ON_<ACTION>` callback or a failure. */
export function isAwaitingCallback(status?: string) {
  return !!status && !status.startsWith("ON_") && !isFailedTransaction(status);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function descriptorName(value: unknown): string | undefined {
  return asString(asRecord(asRecord(value)?.descriptor)?.name);
}

const COORDINATION_RESOURCE_TYPE = "ServiceCoordinationResource";

/** Catalog codes (referral categories, target service types) per referral type. */
const REFERRAL_TYPE_CODES: Record<ReferralType, string[]> = {
  consultation: [
    "CONSULTATION",
    "PHYSICAL_CONSULTATION",
    "TELECONSULTATION",
    "PATIENT_CARE",
  ],
  lab: [
    "LAB",
    "INVESTIGATION",
    "LAB_TEST",
    "DIAGNOSTIC_ANALYTICS",
    "RADIOLOGY",
  ],
};

function referralTypeOf(value: unknown): ReferralType | undefined {
  const code = asString(value)?.toUpperCase();
  if (!code) return undefined;
  return (Object.keys(REFERRAL_TYPE_CODES) as ReferralType[]).find((type) =>
    REFERRAL_TYPE_CODES[type].includes(code),
  );
}

/** Only `scres:ServiceCoordinationResource` can be referred to; `hr:HealthResource` is an appointment. */
function isCoordinationResource(attributes?: Record<string, unknown>) {
  const ldType = attributes?.["@type"];
  const types = Array.isArray(ldType) ? ldType : [ldType];
  return types.some(
    (item) =>
      typeof item === "string" &&
      item.split(":").pop() === COORDINATION_RESOURCE_TYPE,
  );
}

interface ReferralResource {
  kind: NetworkOfferKind;
  referralTypes: ReferralType[];
  organizationName?: string;
}

function referralResource(value: unknown): ReferralResource | undefined {
  const attributes = asRecord(asRecord(value)?.resourceAttributes);
  if (!attributes || !isCoordinationResource(attributes)) return undefined;
  const availability = asRecord(attributes.referralAvailability);
  const scope = asRecord(attributes.coordinationScope);
  const codes = [
    availability?.referralType,
    ...[
      ...asArray(scope?.referralCategories),
      ...asArray(scope?.targetServiceTypes),
    ].map((item) => asRecord(item)?.code ?? item),
  ];
  const referralTypes = [
    ...new Set(
      codes.map(referralTypeOf).filter((type): type is ReferralType => !!type),
    ),
  ];
  return {
    kind: availability ? "referral_unit" : "coordinator",
    referralTypes,
    organizationName: asString(availability?.organizationName),
  };
}

/**
 * Flattens every stored `on_discover` callback into referral offers. A
 * discover can be answered by several BPPs, so each offer keeps the routing of
 * the envelope (or catalog) it came from for the follow-up `select`/`confirm`.
 * Offers are kept only when they point at a referral resource
 * (`ServiceCoordinationResource`): appointment offers (`hr:HealthResource`)
 * cannot be referred to. An offer repeated by the same BPP is listed once.
 */
export function extractNetworkOffers(messages: BecknMessage[]): NetworkOffer[] {
  const offers: NetworkOffer[] = [];
  const seen = new Set<string>();
  messages.forEach((message, messageIndex) => {
    const context = asRecord(message.payload.context) ?? {};
    const catalogs = asArray(asRecord(message.payload.message)?.catalogs);
    catalogs.forEach((rawCatalog, catalogIndex) => {
      const catalog = asRecord(rawCatalog);
      if (!catalog) return;
      const provider = asRecord(catalog.provider);
      const routing: BecknContextOverride = {
        network_id: asString(context.networkId) ?? "",
        bap_id: asString(context.bapId) ?? "",
        bap_uri: asString(context.bapUri) ?? "",
        bpp_id: asString(catalog.bppId) ?? asString(context.bppId) ?? "",
        bpp_uri: asString(catalog.bppUri) ?? asString(context.bppUri) ?? "",
      };
      const resources = new Map<string, ReferralResource | undefined>();
      asArray(catalog.resources).forEach((rawResource) => {
        const resourceId = asString(asRecord(rawResource)?.id);
        if (resourceId)
          resources.set(resourceId, referralResource(rawResource));
      });
      asArray(catalog.offers).forEach((rawOffer, offerIndex) => {
        const offer = asRecord(rawOffer);
        const offerId = asString(offer?.id);
        if (!offerId) return;
        const resourceIds = asArray(offer?.resourceIds).filter(
          (item): item is string => typeof item === "string",
        );
        const resource = (
          resourceIds.length ? resourceIds : [...resources.keys()]
        )
          .map((resourceId) => resources.get(resourceId))
          .find((item) => !!item);
        if (!resource) return;
        const dedupeKey = `${routing.bpp_id}|${offerId}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        offers.push({
          key: `${messageIndex}-${catalogIndex}-${offerIndex}`,
          transactionId: message.transaction_id ?? "",
          offerId,
          offerName: descriptorName(offer),
          providerId: asString(provider?.id),
          providerName: descriptorName(provider) ?? descriptorName(catalog),
          catalogName: descriptorName(catalog),
          ...resource,
          context: routing,
        });
      });
    });
  });
  return offers;
}

function isReferralType(value?: string): value is ReferralType {
  return !!value && value in REFERRAL_TYPE_CODES;
}

/**
 * The referral type of a chosen destination: the selected availability's, else
 * the one type the offer declares. A desk that serves several (or does not
 * say) has none.
 */
export function networkOfferReferralType(
  offer?: NetworkOffer | null,
  availability?: NetworkReferralAvailability | null,
): ReferralType | undefined {
  if (isReferralType(availability?.referral_type)) {
    return availability.referral_type;
  }
  return offer?.referralTypes.length === 1 ? offer.referralTypes[0] : undefined;
}

export function networkProviderKey(offer: NetworkOffer) {
  return `${offer.context.bpp_id}|${offer.providerId ?? offer.catalogName ?? offer.offerId}`;
}

/** Stable across discovers, unlike `key`; identifies an offer in a dropdown. */
export function networkOfferValue(offer: NetworkOffer) {
  return `${offer.context.bpp_id}|${offer.offerId}`;
}

export function groupNetworkOffers(offers: NetworkOffer[]): NetworkProvider[] {
  const providers = new Map<string, NetworkProvider>();
  for (const offer of offers) {
    const key = networkProviderKey(offer);
    const provider = providers.get(key) ?? {
      key,
      providerId: offer.providerId,
      name: offer.providerName ?? offer.catalogName ?? offer.offerId,
      bppId: offer.context.bpp_id,
      offers: [],
    };
    provider.offers.push(offer);
    providers.set(key, provider);
  }
  return [...providers.values()];
}

/** `select` goes on the discover transaction, routed to the BPP of the offer's catalog. */
export function networkSelectBody(offer: NetworkOffer): ReferralSelectBody {
  return { offer_id: offer.offerId, context: offer.context };
}

const CATEGORY_FOR_REFERRAL: Record<ReferralType, ReferralNetworkCategory> = {
  consultation: "patient_care",
  lab: "other",
};

/** Beckn urgency is `emergency` or a priority; the plugin treats >= 2 as urgent. */
const URGENCY_PRIORITY: Record<ReferralUrgency, number> = {
  routine: 1,
  urgent: 2,
  emergency: 3,
};

export interface NetworkReferralBodyInput {
  /** The availability the BPP answered `select` with; none for a coordination desk. */
  availability?: NetworkReferralAvailability | null;
  facilityId: string;
  patientId: string;
  encounterId?: string;
  title: string;
  reason: string;
  /** Sent as `category` only without an availability (a coordination desk). */
  referralType?: ReferralType;
  urgency: ReferralUrgency;
  /** The answered request form of `availability`. */
  form?: {
    questionnaireId: string;
    results: ReferralQuestionnaireResult[];
  };
}

/**
 * The `init` / `confirm` body. The plugin defaults `offer_id` to the selected
 * offer, and `assigned_facility_id` / `category` to the selected availability.
 * A coordination desk has no availability and assigns the facility itself, so
 * only the category (the referral type) is sent for it.
 */
export function networkReferralBody(
  request: NetworkReferralBodyInput,
): ReferralConfirmBody {
  const { availability, form } = request;
  const category =
    isReferralType(availability?.referral_type) || !request.referralType
      ? undefined
      : CATEGORY_FOR_REFERRAL[request.referralType];
  return {
    facility: request.facilityId,
    patient: request.patientId,
    ...(request.encounterId ? { encounter: request.encounterId } : {}),
    title: request.title,
    reason: request.reason || undefined,
    ...(category ? { category } : {}),
    emergency: request.urgency === "emergency",
    priority: URGENCY_PRIORITY[request.urgency],
    ...(form
      ? {
          questionnaire: form.questionnaireId,
          questionnaire_response: { results: form.results },
        }
      : {}),
  };
}

export function networkOfferLabel(offer: NetworkOffer) {
  return (
    [offer.providerName, offer.offerName].filter(Boolean).join(" — ") ||
    offer.catalogName ||
    offer.offerId
  );
}

/**
 * Offer identity across discovers: `key` is only a list key and repeats when
 * the network is searched again, under a new transaction.
 */
export function isSameNetworkOffer(
  a?: NetworkOffer | null,
  b?: NetworkOffer | null,
) {
  return (
    !!a &&
    !!b &&
    a.transactionId === b.transactionId &&
    a.offerId === b.offerId &&
    a.context.bpp_id === b.context.bpp_id &&
    a.context.bpp_uri === b.context.bpp_uri
  );
}
