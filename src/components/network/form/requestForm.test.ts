import assert from "node:assert/strict";
import { test } from "node:test";

import {
  Question,
  createVisibility,
  initialAnswers,
  serializeAnswers,
  unsupportedQuestions,
  validateAnswers,
} from "@/components/network/form/requestForm";

const question = (overrides: Partial<Question> & Pick<Question, "id">) =>
  ({
    link_id: overrides.id,
    text: overrides.id,
    type: "string",
    ...overrides,
  }) as Question;

const FORM: Question[] = [
  question({ id: "urgent", type: "boolean", required: true }),
  question({
    id: "why",
    type: "text",
    required: true,
    enable_when: [{ question: "urgent", operator: "equals", answer: true }],
  }),
  question({
    id: "details",
    type: "group",
    questions: [
      question({ id: "age", type: "integer" }),
      question({
        id: "site",
        type: "choice",
        answer_option: [
          { value: "a", display: "Site A", initial_selected: true },
          { value: "b", display: "Site B" },
        ],
      }),
    ],
  }),
];

test("a question shows only when its enable_when matches", () => {
  assert.equal(createVisibility(FORM, {})(FORM[1]), false);
  assert.equal(createVisibility(FORM, { urgent: ["true"] })(FORM[1]), true);
  assert.equal(createVisibility(FORM, { urgent: ["false"] })(FORM[1]), false);
});

test("required answers are checked only on shown questions", () => {
  assert.deepEqual(
    validateAnswers(FORM, { urgent: ["false"] }).map((e) => e.questionId),
    [],
  );
  assert.deepEqual(
    validateAnswers(FORM, { urgent: ["true"] }).map((e) => e.questionId),
    ["why"],
  );
  assert.deepEqual(
    validateAnswers(FORM, { urgent: ["false"], age: ["4.5"] }).map(
      (e) => e.message,
    ),
    ["ccn_form_invalid_integer"],
  );
});

test("answers serialize like CARE's referral form, skipping hidden ones", () => {
  const answers = {
    ...initialAnswers(FORM),
    urgent: ["false"],
    why: ["hidden answer"],
    age: ["40"],
  };
  assert.deepEqual(serializeAnswers(FORM, answers), [
    { question_id: "urgent", values: [{ value: "false" }] },
    { question_id: "age", values: [{ value: "40" }] },
    { question_id: "site", values: [{ value: "a" }] },
  ]);
});

test("times gain seconds for CARE's parser", () => {
  const form = [question({ id: "at", type: "time" })];
  assert.deepEqual(serializeAnswers(form, { at: ["09:30"] }), [
    { question_id: "at", values: [{ value: "09:30:00" }] },
  ]);
});

test("clinical, value-set and repeating-group questions are unsupported", () => {
  const form = [
    question({ id: "s", type: "structured" }),
    question({ id: "vs", type: "choice", answer_value_set: { slug: "x" } }),
    question({ id: "rg", type: "group", repeats: true, questions: [] }),
    question({ id: "ok", type: "text" }),
  ];
  assert.deepEqual(
    unsupportedQuestions(form).map((item) => item.id),
    ["s", "vs", "rg"],
  );
});
