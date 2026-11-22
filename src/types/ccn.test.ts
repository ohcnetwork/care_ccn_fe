import assert from "node:assert/strict";
import { test } from "node:test";

import { QuestionnaireRead } from "@/types/care";
import {
  BecknMessage,
  extractNetworkOffers,
  groupNetworkOffers,
  isAwaitingCallback,
  isFailedTransaction,
  isSameNetworkOffer,
  networkOfferLabel,
  networkOfferReferralType,
  networkReferralBody,
  networkRequestForms,
  networkSelectBody,
  transactionErrorText,
} from "@/types/ccn";

function onDiscover(
  context: Record<string, unknown>,
  catalogs: unknown[],
): BecknMessage {
  return {
    id: 1,
    transaction_id: "txn-1",
    message_id: "m-1",
    action: "on_discover",
    direction: "in",
    delivery_status: "",
    processing_status: "processed",
    attempts: 0,
    last_error: "",
    payload: { context, message: { catalogs } },
    ack: null,
    reply_to: null,
    created_date: null,
    modified_date: null,
  };
}

/** A care referral availability, as `catalog-referral-<facility>` publishes it. */
function referralUnit(id: string, referralType = "consultation") {
  return {
    id,
    descriptor: { name: `Unit ${id}` },
    resourceAttributes: {
      "@type": "scres:ServiceCoordinationResource",
      coordinationScope: {
        referralCategories: [
          { code: referralType === "lab" ? "INVESTIGATION" : "CONSULTATION" },
        ],
      },
      referralAvailability: {
        id,
        referralType,
        entityType: "facility",
        organizationName: `Org ${id}`,
      },
    },
  };
}

/** A coordination desk: a coordination resource without `referralAvailability`. */
function coordinatorDesk(id: string, targetServiceTypes?: string[]) {
  return {
    id,
    resourceAttributes: {
      "@type": "scres:ServiceCoordinationResource",
      coordinationScope: targetServiceTypes && {
        targetServiceTypes: targetServiceTypes.map((code) => ({ code })),
      },
    },
  };
}

function appointmentResource(id: string) {
  return {
    id,
    resourceAttributes: {
      "@type": "hr:HealthResource",
      healthServiceType: { code: "PHYSICAL_CONSULTATION" },
    },
  };
}

const envelope = {
  networkId: "nfh",
  bapId: "care.bap",
  bapUri: "https://care/bap",
  bppId: "cc.bpp",
  bppUri: "https://cc/bpp",
};

test("offers keep the routing of the envelope that returned them", () => {
  const offers = extractNetworkOffers([
    onDiscover(envelope, [
      {
        descriptor: { name: "Coordination catalog" },
        provider: { id: "facility-1", descriptor: { name: "District CC" } },
        resources: [referralUnit("unit-1")],
        offers: [
          {
            id: "offer-1",
            resourceIds: ["unit-1"],
            descriptor: { name: "Consultation" },
          },
        ],
      },
    ]),
  ]);
  assert.equal(offers.length, 1);
  assert.deepEqual(offers[0].context, {
    network_id: "nfh",
    bap_id: "care.bap",
    bap_uri: "https://care/bap",
    bpp_id: "cc.bpp",
    bpp_uri: "https://cc/bpp",
  });
  assert.equal(offers[0].transactionId, "txn-1");
  assert.equal(offers[0].providerId, "facility-1");
  assert.equal(networkOfferLabel(offers[0]), "District CC — Consultation");
});

test("a catalog's own BPP wins over the envelope's", () => {
  const [offer] = extractNetworkOffers([
    onDiscover(envelope, [
      {
        bppId: "other.bpp",
        bppUri: "https://other",
        resources: [coordinatorDesk("desk")],
        offers: [{ id: "o" }],
      },
    ]),
  ]);
  assert.equal(offer.context.bpp_id, "other.bpp");
  assert.equal(offer.context.bpp_uri, "https://other");
  assert.equal(networkOfferLabel(offer), "o");
});

test("offers without an id and malformed catalogs are skipped", () => {
  const offers = extractNetworkOffers([
    onDiscover(envelope, [null, "x", { offers: [{}, { id: "" }] }]),
    {
      ...onDiscover(envelope, []),
      payload: { context: envelope },
    },
  ]);
  assert.deepEqual(offers, []);
});

test("transaction statuses", () => {
  assert.equal(isAwaitingCallback("QUEUED"), true);
  assert.equal(isAwaitingCallback("SELECT"), true);
  assert.equal(isAwaitingCallback("ON_SELECT"), false);
  assert.equal(isAwaitingCallback("UPDATE"), true);
  assert.equal(isAwaitingCallback("ON_UPDATE"), false);
  assert.equal(isAwaitingCallback("NACK"), false);
  assert.equal(isAwaitingCallback(undefined), false);
  assert.equal(isFailedTransaction("ERROR"), true);
  assert.equal(isFailedTransaction("ON_CONFIRM"), false);
});

test("gateway errors are shortened for display", () => {
  assert.equal(transactionErrorText(null), undefined);
  assert.equal(
    transactionErrorText({ code: "NOT_CONFIGURED" }),
    "NOT_CONFIGURED",
  );
  const text = transactionErrorText({ message: "x".repeat(500) }, 10);
  assert.equal(text, `${"x".repeat(10)}…`);
});

test("only the availability's request forms are filled by the referring side", () => {
  const form = (id: string) =>
    ({ id, title: id, questions: [] }) as unknown as QuestionnaireRead;
  assert.deepEqual(networkRequestForms(null), []);
  assert.deepEqual(networkRequestForms({ id: "a" }), []);
  const forms = networkRequestForms({
    id: "a",
    questionnaires: [
      { questionnaire_type: "response", questionnaire: form("reply") },
      { questionnaire_type: "request", questionnaire: form("intake") },
      { questionnaire_type: "request", questionnaire: form("") },
    ],
  });
  assert.deepEqual(
    forms.map((item) => item.id),
    ["intake"],
  );
});

test("offers are told apart by transaction, not by their list key", () => {
  const catalog = {
    provider: { id: "f" },
    resources: [referralUnit("unit-1")],
    offers: [{ id: "offer-1", resourceIds: ["unit-1"] }],
  };
  const [first] = extractNetworkOffers([onDiscover(envelope, [catalog])]);
  const [again] = extractNetworkOffers([
    { ...onDiscover(envelope, [catalog]), transaction_id: "txn-2" },
  ]);
  assert.equal(first.key, again.key);
  assert.equal(isSameNetworkOffer(first, { ...first }), true);
  assert.equal(isSameNetworkOffer(first, again), false);
  assert.equal(isSameNetworkOffer(first, null), false);
});

test("appointment offers are dropped; referral units and desks are kept", () => {
  const offers = extractNetworkOffers([
    onDiscover(envelope, [
      {
        id: "catalog-f1",
        provider: { id: "f1", descriptor: { name: "Medicity" } },
        resources: [appointmentResource("practitioner-1")],
        offers: [
          {
            id: "offer-practitioner-1",
            resourceIds: ["practitioner-1"],
            descriptor: { name: "Appointment - Dr. A" },
          },
          { id: "offer-unlinked" },
        ],
      },
      {
        id: "catalog-referral-f1",
        provider: { id: "f1", descriptor: { name: "Medicity" } },
        resources: [referralUnit("unit-1"), appointmentResource("p-2")],
        offers: [
          {
            id: "offer-unit-1",
            resourceIds: ["unit-1"],
            descriptor: { name: "Cardiology referrals" },
          },
          { id: "offer-p-2", resourceIds: ["p-2"] },
        ],
      },
      {
        id: "catalog-coordinator-f1",
        provider: { id: "f1", descriptor: { name: "Medicity" } },
        resources: [coordinatorDesk("desk-f1")],
        offers: [{ id: "coordinator-f1-offer", resourceIds: ["desk-f1"] }],
      },
    ]),
  ]);
  assert.deepEqual(
    offers.map((offer) => [offer.offerId, offer.kind]),
    [
      ["offer-unit-1", "referral_unit"],
      ["coordinator-f1-offer", "coordinator"],
    ],
  );
  assert.deepEqual(offers[0].referralTypes, ["consultation"]);
  assert.equal(offers[0].organizationName, "Org unit-1");
  assert.deepEqual(offers[1].referralTypes, []);
});

test("an offer repeated by the same BPP is listed once", () => {
  const catalog = {
    provider: { id: "f" },
    resources: [referralUnit("unit-1")],
    offers: [{ id: "offer-unit-1", resourceIds: ["unit-1"] }],
  };
  const offers = extractNetworkOffers([
    onDiscover(envelope, [catalog]),
    onDiscover(envelope, [catalog]),
    onDiscover(envelope, [{ ...catalog, bppId: "other.bpp" }]),
  ]);
  assert.deepEqual(
    offers.map((offer) => offer.context.bpp_id),
    ["cc.bpp", "other.bpp"],
  );
});

test("a destination's referral type comes from its availability or offer", () => {
  const offers = extractNetworkOffers([
    onDiscover(envelope, [
      {
        provider: { id: "f" },
        resources: [
          referralUnit("lab", "lab"),
          coordinatorDesk("desk-lab", ["LAB_TEST"]),
          coordinatorDesk("desk-any"),
        ],
        offers: ["lab", "desk-lab", "desk-any"].map((id) => ({
          id: `offer-${id}`,
          resourceIds: [id],
        })),
      },
    ]),
  ]);
  const [unit, labDesk, anyDesk] = offers;
  assert.equal(networkOfferReferralType(unit), "lab");
  assert.equal(
    networkOfferReferralType(unit, { id: "a", referral_type: "consultation" }),
    "consultation",
  );
  assert.equal(networkOfferReferralType(labDesk), "lab");
  assert.equal(networkOfferReferralType(anyDesk), undefined);
});

test("init / confirm leave the selection's defaults to the plugin", () => {
  const request = {
    facilityId: "origin",
    patientId: "patient",
    encounterId: "encounter",
    title: "Medicity — Cardiology",
    reason: "",
    referralType: "lab" as const,
    urgency: "emergency" as const,
  };
  const unit = networkReferralBody({
    ...request,
    availability: { id: "unit-1", referral_type: "consultation" },
    form: {
      questionnaireId: "q-1",
      results: [{ question_id: "x", values: [{ value: "y" }] }],
    },
  });
  assert.deepEqual(unit, {
    facility: "origin",
    patient: "patient",
    encounter: "encounter",
    title: "Medicity — Cardiology",
    reason: undefined,
    emergency: true,
    priority: 3,
    questionnaire: "q-1",
    questionnaire_response: {
      results: [{ question_id: "x", values: [{ value: "y" }] }],
    },
  });
  for (const key of ["offer_id", "assigned_facility_id", "category"]) {
    assert.equal(key in unit, false, key);
  }
  // A coordination desk has no availability: only its category is sent.
  const desk = networkReferralBody({ ...request, urgency: "urgent" });
  assert.equal(desk.category, "other");
  assert.equal(desk.priority, 2);
  assert.equal("assigned_facility_id" in desk, false);
  assert.equal(
    "category" in networkReferralBody({ ...request, referralType: undefined }),
    false,
  );
});

test("offers are grouped by provider and BPP", () => {
  const catalog = (providerId: string, bppId?: string) => ({
    bppId,
    provider: { id: providerId, descriptor: { name: providerId } },
    resources: [referralUnit("u1"), coordinatorDesk("d1")],
    offers: [
      { id: `${providerId}-u1`, resourceIds: ["u1"] },
      { id: `${providerId}-d1`, resourceIds: ["d1"] },
    ],
  });
  const providers = groupNetworkOffers(
    extractNetworkOffers([
      onDiscover(envelope, [
        catalog("f1"),
        catalog("f2"),
        catalog("f1", "other.bpp"),
      ]),
    ]),
  );
  assert.deepEqual(
    providers.map((provider) => [
      provider.name,
      provider.bppId,
      provider.offers.length,
    ]),
    [
      ["f1", "cc.bpp", 2],
      ["f2", "cc.bpp", 2],
      ["f1", "other.bpp", 2],
    ],
  );
});

test("select sends the offer with its catalog's routing", () => {
  const [offer] = extractNetworkOffers([
    onDiscover(envelope, [
      {
        bppId: "medicity.bpp",
        bppUri: "https://medicity/bpp",
        provider: { id: "f" },
        resources: [referralUnit("unit-1")],
        offers: [{ id: "offer-unit-1", resourceIds: ["unit-1"] }],
      },
    ]),
  ]);
  assert.deepEqual(networkSelectBody(offer), {
    offer_id: "offer-unit-1",
    context: {
      network_id: "nfh",
      bap_id: "care.bap",
      bap_uri: "https://care/bap",
      bpp_id: "medicity.bpp",
      bpp_uri: "https://medicity/bpp",
    },
  });
});
