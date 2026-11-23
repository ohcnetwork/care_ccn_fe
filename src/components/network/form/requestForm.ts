/**
 * A small renderer model for the receiving facility's referral request form.
 *
 * CARE's own questionnaire engine is not available to an app, so this covers
 * the question types referral request forms use. Forms with anything else are
 * reported as unsupported and cannot be sent, rather than sent incomplete.
 * Answers are serialized in the shape CARE's referral form submits
 * (`ReferralQuestionnaireResult`).
 */
import type { ReferralQuestionnaireResult } from "@/types/care";

interface Code {
  code: string;
  display?: string;
  system?: string;
}

export type QuestionType =
  | "group"
  | "display"
  | "boolean"
  | "decimal"
  | "integer"
  | "date"
  | "dateTime"
  | "time"
  | "string"
  | "text"
  | "url"
  | "choice"
  | "quantity"
  | "structured";

export interface EnableWhen {
  /** The `link_id` of the controlling question. */
  question: string;
  operator:
    | "exists"
    | "equals"
    | "not_equals"
    | "greater"
    | "less"
    | "greater_or_equals"
    | "less_or_equals";
  answer: string | number | boolean | Code;
}

export interface AnswerOption {
  value: string;
  display?: string;
  initial_selected?: boolean;
}

export interface Question {
  id: string;
  link_id: string;
  text: string;
  description?: string;
  type: QuestionType;
  required?: boolean;
  repeats?: boolean;
  read_only?: boolean;
  max_length?: number;
  enable_when?: EnableWhen[];
  enable_behavior?: "all" | "any";
  answer_option?: AnswerOption[];
  answer_value_set?: unknown;
  questions?: Question[];
}

/** Answers by question id. Choice questions that repeat hold several values. */
export type Answers = Record<string, string[]>;

const ANSWERABLE: ReadonlySet<QuestionType> = new Set([
  "boolean",
  "decimal",
  "integer",
  "date",
  "dateTime",
  "time",
  "string",
  "text",
  "url",
  "choice",
]);

function walk(questions: Question[], visit: (question: Question) => void) {
  for (const question of questions) {
    visit(question);
    walk(question.questions ?? [], visit);
  }
}

/** Questions the app cannot render (clinical, value-set or repeating-group). */
export function unsupportedQuestions(questions: Question[]): Question[] {
  const unsupported: Question[] = [];
  walk(questions, (question) => {
    if (
      question.type === "structured" ||
      question.type === "quantity" ||
      (question.type === "group" && question.repeats) ||
      (question.type === "choice" && !question.answer_option?.length)
    ) {
      unsupported.push(question);
    }
  });
  return unsupported;
}

/** Answers the form opens with: options marked `initial_selected`. */
export function initialAnswers(questions: Question[]): Answers {
  const answers: Answers = {};
  walk(questions, (question) => {
    const selected = (question.answer_option ?? [])
      .filter((option) => option.initial_selected)
      .map((option) => option.value);
    if (question.type === "choice" && selected.length) {
      answers[question.id] = question.repeats ? selected : selected.slice(0, 1);
    }
  });
  return answers;
}

function linkIndex(questions: Question[]) {
  const index = new Map<string, Question>();
  walk(questions, (question) => index.set(question.link_id, question));
  return index;
}

function matches(condition: EnableWhen, values: string[]): boolean {
  if (condition.operator === "exists") {
    return values.length > 0 === Boolean(condition.answer);
  }
  if (!values.length) return condition.operator === "not_equals";
  const expected =
    typeof condition.answer === "object"
      ? condition.answer.code
      : String(condition.answer);
  switch (condition.operator) {
    case "equals":
      return values.includes(expected);
    case "not_equals":
      return !values.includes(expected);
    default: {
      const value = Number(values[0]);
      const target = Number(condition.answer);
      if (Number.isNaN(value) || Number.isNaN(target)) return false;
      if (condition.operator === "greater") return value > target;
      if (condition.operator === "less") return value < target;
      if (condition.operator === "greater_or_equals") return value >= target;
      return value <= target;
    }
  }
}

/**
 * Whether a question is shown, following `enable_when` on it and on the
 * questions it depends on. A hidden question's answer is neither validated
 * nor sent, as in CARE's form.
 */
export function createVisibility(questions: Question[], answers: Answers) {
  const index = linkIndex(questions);
  const parents = new Map<string, Question>();
  walk(questions, (question) =>
    (question.questions ?? []).forEach((child) =>
      parents.set(child.id, question),
    ),
  );
  const cache = new Map<string, boolean>();
  const visiting = new Set<string>();

  const isVisible = (question: Question): boolean => {
    const cached = cache.get(question.id);
    if (cached !== undefined) return cached;
    if (visiting.has(question.id)) return false;
    visiting.add(question.id);
    const parent = parents.get(question.id);
    let visible = !parent || isVisible(parent);
    if (visible && question.enable_when?.length) {
      const results = question.enable_when.map((condition) => {
        const controller = index.get(condition.question);
        if (!controller) return false;
        const values = isVisible(controller)
          ? (answers[controller.id] ?? [])
          : [];
        return matches(condition, values);
      });
      visible =
        question.enable_behavior === "any"
          ? results.some(Boolean)
          : results.every(Boolean);
    }
    visiting.delete(question.id);
    cache.set(question.id, visible);
    return visible;
  };
  return isVisible;
}

function answered(values: string[] | undefined) {
  return (values ?? []).filter((value) => value.trim() !== "");
}

export interface QuestionError {
  questionId: string;
  /** Translation key. */
  message: string;
}

export function validateAnswers(
  questions: Question[],
  answers: Answers,
): QuestionError[] {
  const isVisible = createVisibility(questions, answers);
  const errors: QuestionError[] = [];
  walk(questions, (question) => {
    if (!ANSWERABLE.has(question.type) || !isVisible(question)) return;
    const values = answered(answers[question.id]);
    if (question.required && !question.read_only && !values.length) {
      errors.push({ questionId: question.id, message: "ccn_form_required" });
      return;
    }
    for (const value of values) {
      if (question.type === "integer" && !/^-?\d+$/.test(value)) {
        errors.push({
          questionId: question.id,
          message: "ccn_form_invalid_integer",
        });
      } else if (question.type === "decimal" && Number.isNaN(Number(value))) {
        errors.push({
          questionId: question.id,
          message: "ccn_form_invalid_number",
        });
      }
    }
  });
  return errors;
}

function serializeValue(type: QuestionType, value: string): string {
  if (type === "dateTime") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  // CARE parses times as HH:mm:ss; time inputs give HH:mm.
  if (type === "time" && /^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  return value;
}

/** The answers as CARE's referral API takes them, skipping hidden questions. */
export function serializeAnswers(
  questions: Question[],
  answers: Answers,
): ReferralQuestionnaireResult[] {
  const isVisible = createVisibility(questions, answers);
  const results = (list: Question[]): ReferralQuestionnaireResult[] =>
    list.flatMap((question) => {
      if (!isVisible(question)) return [];
      if (question.type === "group") return results(question.questions ?? []);
      if (!ANSWERABLE.has(question.type)) return [];
      const values = answered(answers[question.id]);
      if (!values.length) return [];
      return [
        {
          question_id: question.id,
          values: values.map((value) => ({
            value: serializeValue(question.type, value),
          })),
        },
      ];
    });
  return results(questions);
}

/** The display text of an answer, for the review step. */
export function displayAnswer(
  question: Question,
  value: string,
  t: (key: string) => string,
): string {
  if (question.type === "boolean") {
    return t(value === "true" ? "ccn_form_yes" : "ccn_form_no");
  }
  if (question.type === "choice") {
    return (
      question.answer_option?.find((option) => option.value === value)
        ?.display || value
    );
  }
  return value;
}
