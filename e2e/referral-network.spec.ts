import { faker } from "@faker-js/faker";
import { expect, test } from "@playwright/test";
import { adminApiHeaders, apiBaseUrl } from "tests/helper/questionnaireV2";
import { createReferralFixture } from "tests/helper/referrals";

test.use({ storageState: "tests/.auth/user.json" });

// The CCN plugin talks to a Beckn gateway that is not part of the test stack.
// Its endpoints are mocked here; the Care referral the plugin would create on
// `on_confirm` is a real fixture so the referral views run against the backend.
const CCN = /\/api\/care_ccn_be\//;

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

function transaction(
  transactionId: string,
  status: string,
  extra: Record<string, unknown> = {},
) {
  return {
    id: faker.string.uuid(),
    transaction_id: transactionId,
    adapter: "bap",
    flow: "referral",
    status,
    network_id: "nfh",
    counterparty_id: "cc.bpp",
    counterparty_uri: "https://cc.example/bpp",
    contract_id: status === "ON_CONFIRM" ? "contract-1" : "",
    coordination_id: transactionId,
    last_error: null,
    created_date: new Date().toISOString(),
    modified_date: new Date().toISOString(),
    routing: {},
    context: {},
    actions: ["DISCOVER", "ON_DISCOVER"],
    patient: null,
    facility: null,
    created_by: null,
    referral_id: null,
    confirm: null,
    ...extra,
  };
}

test("sends a referral to a network organization from the encounter", async ({
  page,
  request,
}) => {
  const fixture = await createReferralFixture(request);
  const transactionId = faker.string.uuid();
  const offerName = `Network desk ${fixture.suffix}`;
  const title = `Network referral ${fixture.suffix}`;
  const answer = `Network assessment ${fixture.suffix}`;
  // The receiving instance's request form, as the BPP snapshots it on `on_select`.
  const requestForm = await (
    await request.get(
      `${apiBaseUrl()}/api/v1/questionnaire/${fixture.requestFormId}/`,
      { headers: adminApiHeaders() },
    )
  ).json();
  const availability = {
    id: fixture.availabilityId,
    name: fixture.availabilityName,
    description: "Network referral unit",
    referral_type: "consultation",
    facility_id: fixture.facilityId,
    facility_name: offerName,
    questionnaires: [
      { questionnaire_type: "request", questionnaire: requestForm },
    ],
  };
  let discoverBody: Record<string, unknown> | undefined;
  let selectBody: Record<string, unknown> | undefined;
  let initBody: Record<string, unknown> | undefined;
  let confirmBody: Record<string, unknown> | undefined;
  let status = "ON_DISCOVER";
  await page.route(CCN, async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const accepted = (action: string) =>
      route.fulfill(
        json(
          {
            transaction_id: transactionId,
            message_id: faker.string.uuid(),
            action,
            status: "QUEUED",
          },
          202,
        ),
      );
    if (url.pathname.endsWith("/bap/referral/discover/")) {
      discoverBody = route.request().postDataJSON();
      return accepted("discover");
    }
    if (url.pathname.endsWith(`/bap/referral/${transactionId}/select/`)) {
      selectBody = route.request().postDataJSON();
      status = "ON_SELECT";
      return accepted("select");
    }
    if (url.pathname.endsWith(`/bap/referral/${transactionId}/init/`)) {
      initBody = route.request().postDataJSON();
      status = "ON_INIT";
      return accepted("init");
    }
    if (url.pathname.endsWith(`/bap/referral/${transactionId}/confirm/`)) {
      confirmBody = route.request().postDataJSON();
      status = "ON_CONFIRM";
      return accepted("confirm");
    }
    if (url.pathname.endsWith(`/bap/referral/${transactionId}/`)) {
      return route.fulfill(
        json(
          transaction(transactionId, status, {
            referral_id: status === "ON_CONFIRM" ? fixture.referralId : null,
            availability: status === "ON_DISCOVER" ? null : availability,
          }),
        ),
      );
    }
    if (url.pathname.endsWith(`/bap/referral/${fixture.referralId}/`)) {
      return route.fulfill(
        json(
          transaction(fixture.referralId, "ON_CONFIRM", {
            referral_id: fixture.referralId,
            actions: ["CONFIRM", "ON_CONFIRM"],
          }),
        ),
      );
    }
    if (url.pathname.endsWith("/bap/message/") && method === "GET") {
      return route.fulfill(
        json({
          count: 1,
          results: [
            {
              id: 1,
              transaction_id: transactionId,
              message_id: "m-1",
              action: "on_discover",
              direction: "in",
              payload: {
                context: {
                  networkId: "nfh",
                  bapId: "care.bap",
                  bapUri: "https://care.example/bap",
                  bppId: "cc.bpp",
                  bppUri: "https://cc.example/bpp",
                },
                message: {
                  catalogs: [
                    // Appointment catalogs answer the same discover; they
                    // cannot be referred to and must not be listed.
                    {
                      id: `catalog-${fixture.facilityId}`,
                      provider: {
                        id: fixture.facilityId,
                        descriptor: { name: offerName },
                      },
                      resources: [
                        {
                          id: "practitioner-1",
                          resourceAttributes: { "@type": "hr:HealthResource" },
                        },
                      ],
                      offers: [
                        {
                          id: "offer-practitioner-1",
                          resourceIds: ["practitioner-1"],
                          descriptor: { name: "Appointment - Dr. Network" },
                        },
                      ],
                    },
                    {
                      id: `catalog-referral-${fixture.facilityId}`,
                      provider: {
                        id: fixture.facilityId,
                        descriptor: { name: offerName },
                      },
                      resources: [
                        {
                          id: fixture.availabilityId,
                          resourceAttributes: {
                            "@type": "scres:ServiceCoordinationResource",
                            referralAvailability: {
                              id: fixture.availabilityId,
                              referralType: "consultation",
                              entityType: "facility",
                            },
                          },
                        },
                      ],
                      offers: [
                        {
                          id: `offer-${fixture.availabilityId}`,
                          resourceIds: [fixture.availabilityId],
                          descriptor: { name: "Consultation" },
                        },
                      ],
                    },
                    {
                      id: `catalog-coordinator-${fixture.facilityId}`,
                      provider: {
                        id: fixture.facilityId,
                        descriptor: { name: offerName },
                      },
                      resources: [
                        {
                          id: `desk-${fixture.facilityId}`,
                          resourceAttributes: {
                            "@type": "scres:ServiceCoordinationResource",
                          },
                        },
                      ],
                      offers: [
                        {
                          id: `coordinator-${fixture.facilityId}-offer`,
                          resourceIds: [`desk-${fixture.facilityId}`],
                          descriptor: { name: "Coordination desk" },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        }),
      );
    }
    return route.fulfill(json({ errors: [{ msg: "unexpected" }] }, 404));
  });

  await test.step("Pick a provider discovered on the network", async () => {
    // The app's `EncounterActions` slot opens its network referral page.
    await page.goto(
      `/facility/${fixture.facilityId}/patient/${fixture.patientId}/encounter/${fixture.encounterId}/updates`,
    );
    await page
      .getByRole("link", { name: "Refer via network" })
      .filter({ visible: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "New network referral" }),
    ).toBeVisible();
    await page.getByRole("radio", { name: new RegExp(offerName) }).click();
    await page.getByRole("combobox", { name: "Referral service" }).click();
    await expect(page.getByRole("option")).toHaveCount(2);
    await expect(page.getByRole("option", { name: /Appointment/ })).toHaveCount(
      0,
    );
    await page
      .getByRole("option", { name: /Consultation.*Referral unit/ })
      .click();
    await expect(
      page.getByRole("region", { name: "Organization" }),
    ).toContainText(`${offerName} — Consultation`);
    await expect(
      page.getByRole("textbox", { name: "Referral title" }),
    ).toHaveValue(`${offerName} — Consultation`);
  });

  await test.step("Fill the receiving facility's request form, review and send", async () => {
    await page.getByRole("textbox", { name: "Referral title" }).fill(title);
    await page.getByRole("combobox", { name: "Urgency" }).click();
    await page.getByRole("option", { name: "Urgent" }).click();
    await page.getByRole("textbox", { name: "Referral reason" }).fill(answer);
    await page.getByRole("button", { name: "Review referral" }).click();
    await expect(page.getByText("Urgency: Urgent")).toBeVisible();
    await expect(
      page.getByText(answer, { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Send referral" }).click();
    await expect(
      page.getByText("Referral sent through the CCN network"),
    ).toBeVisible();
  });

  await test.step("The plugin received the full routing, request and form", async () => {
    // Referral resources have no service type: discover is not narrowed by one.
    expect(discoverBody).toEqual({});
    expect(selectBody).toMatchObject({
      offer_id: `offer-${fixture.availabilityId}`,
      context: {
        network_id: "nfh",
        bap_id: "care.bap",
        bap_uri: "https://care.example/bap",
        bpp_id: "cc.bpp",
        bpp_uri: "https://cc.example/bpp",
      },
    });
    expect(confirmBody).toMatchObject({
      facility: fixture.facilityId,
      patient: fixture.patientId,
      title,
      emergency: false,
      priority: 2,
      questionnaire: fixture.requestFormId,
      questionnaire_response: {
        results: [
          {
            question_id: fixture.requestQuestionId,
            values: [{ value: answer }],
          },
        ],
      },
    });
    // The plugin defaults these from the selected offer and availability.
    for (const key of ["offer_id", "assigned_facility_id", "category"]) {
      expect(confirmBody).not.toHaveProperty(key);
    }
    expect(initBody).toEqual(confirmBody);
  });

  await test.step("The referral created at this facility opens in CARE", async () => {
    await expect(page).toHaveURL(
      new RegExp(`/referrals/${fixture.referralId}`),
    );
    await expect(
      page.getByRole("heading", { name: fixture.title }),
    ).toBeVisible();
  });
});

test("shows recent network transactions and explores them", async ({
  page,
  request,
}) => {
  const fixture = await createReferralFixture(request);
  const outgoingId = faker.string.uuid();
  const incomingId = faker.string.uuid();
  const listQueries: URLSearchParams[] = [];
  await page.route(CCN, async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;
    const list = (item: unknown) => json({ count: 1, results: [item] });
    if (pathname.endsWith("/bap/referral/")) {
      listQueries.push(url.searchParams);
      return route.fulfill(list(transaction(outgoingId, "ON_CONFIRM")));
    }
    if (pathname.endsWith("/bpp/referral/")) {
      return route.fulfill(
        list({ ...transaction(incomingId, "NACK"), adapter: "bpp" }),
      );
    }
    if (pathname.endsWith(`/bap/referral/${outgoingId}/`)) {
      return route.fulfill(
        json(
          transaction(outgoingId, "ON_CONFIRM", {
            referral_id: fixture.referralId,
          }),
        ),
      );
    }
    if (pathname.endsWith(`/bpp/referral/${incomingId}/`)) {
      return route.fulfill(
        json({ ...transaction(incomingId, "NACK"), adapter: "bpp" }),
      );
    }
    if (pathname.endsWith("/bap/message/")) {
      return route.fulfill(
        json({
          count: 1,
          results: [
            {
              id: 1,
              transaction_id: outgoingId,
              message_id: faker.string.uuid(),
              action: "on_confirm",
              direction: "in",
              delivery_status: "",
              processing_status: "processed",
              attempts: 1,
              last_error: "",
              payload: { context: { action: "on_confirm" }, message: {} },
              ack: null,
              reply_to: null,
              created_date: new Date().toISOString(),
              modified_date: new Date().toISOString(),
            },
          ],
        }),
      );
    }
    if (pathname.endsWith("/message/")) {
      return route.fulfill(json({ count: 0, results: [] }));
    }
    return route.fulfill(json({ errors: [{ msg: "unexpected" }] }, 404));
  });

  const rows = page.locator("[data-cy='ccn-transaction-row']");

  await test.step("The dashboard lists both directions together", async () => {
    await page.goto("/admin/network_referrals");
    await expect(rows).toHaveCount(2);
    await expect(page.getByText(outgoingId)).toBeVisible();
    await expect(page.getByText(incomingId)).toBeVisible();
    const outgoingRow = rows.filter({ hasText: outgoingId });
    await expect(outgoingRow).toContainText("Confirmed");
    await expect(outgoingRow).toContainText("ON_CONFIRM");
    // The summary is read-only: details open in the developer explorer only.
    await expect(page.getByRole("button", { name: outgoingId })).toHaveCount(0);
  });

  await test.step("The explorer filters by direction and transaction id", async () => {
    await page.locator("[data-cy='ccn-open-explorer']").click();
    await expect(page).toHaveURL(/\/admin\/network_referrals\/explorer/);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(outgoingId);

    await page.getByRole("tab", { name: "Inbound" }).click();
    await expect(rows.first()).toContainText(incomingId);
    await expect(rows.first()).toContainText("Failed");

    await page.getByRole("tab", { name: "Outbound" }).click();
    await page
      .locator("[data-cy='ccn-filter-transaction-id']")
      .fill(outgoingId);
    await expect
      .poll(() => listQueries.at(-1)?.get("transaction_id"))
      .toBe(outgoingId);
  });

  await test.step("A row opens its response logs and referral", async () => {
    await page.getByRole("button", { name: outgoingId }).click();
    await expect(page.locator("[data-cy='ccn-response-logs']")).toContainText(
      "ON_CONFIRM",
    );
    await page.locator("[data-cy='ccn-open-referral']").click();
    await expect(page).toHaveURL(
      new RegExp(`/referrals/${fixture.referralId}`),
    );
    await expect(
      page.getByRole("heading", { name: fixture.title }),
    ).toBeVisible();
  });
});
