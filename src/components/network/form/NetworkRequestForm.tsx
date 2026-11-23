import { type ReactNode, useMemo } from "react";

import { cn } from "@/lib/utils";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  type Answers,
  type Question,
  type QuestionError,
  createVisibility,
  displayAnswer,
} from "@/components/network/form/requestForm";

import { useTranslation } from "@/hooks/useTranslation";

/** Matches the app's `Input`, for the multi-line text answer. */
const TEXTAREA_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 placeholder:text-placeholder-foreground min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-2xs outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm";

const INPUT_TYPE: Partial<Record<Question["type"], string>> = {
  integer: "number",
  decimal: "number",
  date: "date",
  dateTime: "datetime-local",
  time: "time",
  url: "url",
};

interface NetworkRequestFormProps {
  idPrefix: string;
  questions: Question[];
  answers: Answers;
  onChange: (answers: Answers) => void;
  errors: QuestionError[];
  disabled?: boolean;
}

/** The receiving facility's request form (see `requestForm.ts`). */
export function NetworkRequestForm({
  idPrefix,
  questions,
  answers,
  onChange,
  errors,
  disabled,
}: NetworkRequestFormProps) {
  const isVisible = useMemo(
    () => createVisibility(questions, answers),
    [questions, answers],
  );
  const errorFor = (questionId: string) =>
    errors.find((error) => error.questionId === questionId);
  const setValues = (questionId: string, values: string[]) =>
    onChange({ ...answers, [questionId]: values });

  const render = (list: Question[]): ReactNode =>
    list.filter(isVisible).map((question) => (
      <QuestionField
        key={question.id}
        id={`${idPrefix}-${question.id}`}
        question={question}
        values={answers[question.id] ?? []}
        onChange={(values) => setValues(question.id, values)}
        error={errorFor(question.id)?.message}
        disabled={disabled || question.read_only}
      >
        {question.type === "group" && render(question.questions ?? [])}
      </QuestionField>
    ));

  return <div className="space-y-5">{render(questions)}</div>;
}

function QuestionField({
  id,
  question,
  values,
  onChange,
  error,
  disabled,
  children,
}: {
  id: string;
  question: Question;
  values: string[];
  onChange: (values: string[]) => void;
  error?: string;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const label = (
    <>
      {question.text}
      {question.required && (
        <span className="text-destructive" aria-hidden="true">
          *
        </span>
      )}
    </>
  );

  if (question.type === "display") {
    return (
      <div className="space-y-1" data-question-id={question.id}>
        <p className="text-sm font-medium">{question.text}</p>
        {question.description && (
          <FieldDescription>{question.description}</FieldDescription>
        )}
      </div>
    );
  }

  if (question.type === "group") {
    return (
      <fieldset
        className="space-y-4 rounded-lg border border-border p-4"
        data-question-id={question.id}
      >
        <legend className="px-1 text-sm font-semibold">{question.text}</legend>
        {question.description && (
          <FieldDescription>{question.description}</FieldDescription>
        )}
        {children}
      </fieldset>
    );
  }

  const invalid = !!error;
  const value = values[0] ?? "";
  let control: ReactNode;

  if (question.type === "boolean") {
    control = (
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        className="flex gap-4"
      >
        {(["true", "false"] as const).map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={id}
              value={option}
              checked={value === option}
              disabled={disabled}
              onChange={() => onChange([option])}
              className="size-4 accent-primary"
            />
            {displayAnswer(question, option, t)}
          </label>
        ))}
      </div>
    );
  } else if (question.type === "choice" && question.repeats) {
    control = (
      <div
        role="group"
        aria-labelledby={`${id}-label`}
        className="flex flex-col gap-2"
      >
        {(question.answer_option ?? []).map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.includes(option.value)}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...values, option.value]
                    : values.filter((item) => item !== option.value),
                )
              }
              className="size-4 accent-primary"
            />
            {option.display || option.value}
          </label>
        ))}
      </div>
    );
  } else if (question.type === "choice") {
    control = (
      <Select
        value={value}
        onValueChange={(next) => onChange([next])}
        disabled={disabled}
      >
        <SelectTrigger id={id} aria-invalid={invalid}>
          <SelectValue placeholder={t("ccn_form_select")} />
        </SelectTrigger>
        <SelectContent>
          {(question.answer_option ?? []).map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.display || option.value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  } else if (question.type === "text") {
    control = (
      <textarea
        id={id}
        className={TEXTAREA_CLASS}
        value={value}
        maxLength={question.max_length}
        disabled={disabled}
        aria-invalid={invalid}
        rows={3}
        onChange={(event) => onChange([event.target.value])}
      />
    );
  } else {
    control = (
      <Input
        id={id}
        type={INPUT_TYPE[question.type] ?? "text"}
        inputMode={question.type === "integer" ? "numeric" : undefined}
        step={question.type === "decimal" ? "any" : undefined}
        value={value}
        maxLength={question.max_length}
        disabled={disabled}
        aria-invalid={invalid}
        onChange={(event) => onChange([event.target.value])}
      />
    );
  }

  return (
    <Field
      data-question-id={question.id}
      data-invalid={invalid || undefined}
      className={cn("max-w-2xl")}
    >
      <FieldLabel id={`${id}-label`} htmlFor={id}>
        {label}
      </FieldLabel>
      {question.description && (
        <FieldDescription>{question.description}</FieldDescription>
      )}
      {control}
      {error && <FieldError>{t(error)}</FieldError>}
    </Field>
  );
}

/** The answers as a read-only list, for the review step. */
export function NetworkRequestAnswers({
  questions,
  answers,
}: {
  questions: Question[];
  answers: Answers;
}) {
  const { t } = useTranslation();
  const isVisible = createVisibility(questions, answers);
  const render = (list: Question[]): ReactNode =>
    list.filter(isVisible).map((question) => {
      if (question.type === "group") {
        return (
          <div key={question.id} className="space-y-2">
            <p className="text-sm font-semibold">{question.text}</p>
            <div className="space-y-2 border-l border-border pl-3">
              {render(question.questions ?? [])}
            </div>
          </div>
        );
      }
      if (question.type === "display") return null;
      const values = (answers[question.id] ?? []).filter((v) => v.trim());
      return (
        <div key={question.id} className="text-sm">
          <dt className="text-muted-foreground">{question.text}</dt>
          <dd className="whitespace-pre-wrap font-medium">
            {values.length
              ? values.map((v) => displayAnswer(question, v, t)).join(", ")
              : "—"}
          </dd>
        </div>
      );
    });
  return <dl className="space-y-3">{render(questions)}</dl>;
}
