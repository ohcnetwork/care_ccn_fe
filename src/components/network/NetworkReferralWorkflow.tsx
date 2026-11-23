import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Network, RefreshCw } from "lucide-react";
import {
  type ReactNode,
  type RefObject,
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { query } from "@/lib/request";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Muted,
  CareUIPageTitle as PageTitle,
} from "@/components/ui/typography";

import {
  NetworkDestinationSearch,
  NetworkOfferKindBadge,
} from "@/components/network/NetworkDestinationSearch";
import {
  NetworkRequestAnswers,
  NetworkRequestForm,
} from "@/components/network/form/NetworkRequestForm";
import {
  type Answers,
  type Question,
  type QuestionError,
  initialAnswers,
  serializeAnswers,
  unsupportedQuestions,
  validateAnswers,
} from "@/components/network/form/requestForm";
import { describeNetworkError } from "@/components/network/networkErrors";
import {
  type NetworkReferralStep,
  selectNetworkOffer,
  submitNetworkReferral,
} from "@/components/network/networkReferral";

import { useTranslation } from "@/hooks/useTranslation";

import { careRoutes } from "@/apis/care";
import {
  NetworkOffer,
  REFERRAL_URGENCIES,
  ReferralUrgency,
  networkOfferLabel,
  networkOfferReferralType,
  networkRequestForms,
} from "@/types/ccn";

const TEXTAREA_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 placeholder:text-placeholder-foreground min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-2xs outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

function offerKey(offer: NetworkOffer) {
  return `${offer.transactionId}|${offer.context.bpp_uri}|${networkOfferLabel(offer)}`;
}

/** In CARE's dialog the workflow sits inside CARE's destination section. */
const EmbeddedContext = createContext(false);

function Section({
  number,
  title,
  children,
}: {
  number?: number;
  title: string;
  children: ReactNode;
}) {
  const embedded = useContext(EmbeddedContext);
  return (
    <section
      aria-label={title}
      className={
        embedded
          ? "space-y-4 border-t border-border pt-4"
          : "space-y-4 rounded-xl border border-border bg-muted/30 p-4"
      }
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden className="h-4 w-1 rounded-full bg-primary" />
        {number != null && (
          <span className="font-medium text-muted-foreground tabular-nums">
            {number}.
          </span>
        )}
        {title}
      </h2>
      {children}
    </section>
  );
}

function OrganizationSummary({
  offer,
  description,
  referralType,
}: {
  offer: NetworkOffer;
  description?: string;
  referralType?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        {networkOfferLabel(offer)}
        <Badge variant="info" size="xs">
          <Network className="size-3" aria-hidden="true" />
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
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

export interface NetworkReferralWorkflowProps {
  facilityId: string;
  patientId: string;
  encounterId?: string;
  /** Leaves the workflow from the edit step (the Cancel button). */
  onCancel: () => void;
  /** Called with the referral created at this facility. */
  onSent: (referralId: string) => void;
  /** The element that scrolls the workflow; the window when not given. */
  scrollRef?: RefObject<HTMLElement | null>;
  /** Shown first in the destination section, e.g. the destination type. */
  destinationControl?: ReactNode;
  /**
   * Rendered inside CARE's New Referral dialog, in its destination section:
   * no page heading, flat sections, and the actions below the form.
   */
  embedded?: boolean;
}

/**
 * Refers a patient to an organization on the CCN network: search the network,
 * pick an organization, answer its request form, review and send
 * (`select` → `init` → `confirm`). Rendered by the network referral page and,
 * in place, by CARE's New Referral dialog.
 */
export function NetworkReferralWorkflow({
  facilityId,
  patientId,
  encounterId,
  onCancel,
  onSent,
  scrollRef,
  destinationControl,
  embedded = false,
}: NetworkReferralWorkflowProps) {
  const { t } = useTranslation();
  const id = useId();
  const headingRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<"edit" | "review">("edit");
  const [offer, setOffer] = useState<NetworkOffer | null>(null);
  const [choosing, setChoosing] = useState(true);
  const [rediscoverKey, setRediscoverKey] = useState(0);
  const [formId, setFormId] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [formErrors, setFormErrors] = useState<QuestionError[]>([]);
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [note, setNote] = useState("");
  const [urgency, setUrgency] = useState<ReferralUrgency>("routine");
  const [progress, setProgress] = useState<NetworkReferralStep>();

  const patientQuery = useQuery({
    queryKey: ["ccn", "patient", patientId],
    queryFn: query(careRoutes.getPatient, {
      pathParams: { patientId },
      silent: true,
    }),
  });

  // `select` answers with the receiving availability and its request forms.
  const resolveQuery = useQuery({
    queryKey: ["ccn", "referral", "select", offer && offerKey(offer)],
    queryFn: ({ signal }) => selectNetworkOffer(offer!, signal),
    enabled: !!offer,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const availability = resolveQuery.data?.availability;
  const forms = networkRequestForms(availability);
  const form = forms.find((item) => item.id === formId) ?? forms[0];
  const questions = (form?.questions ?? []) as Question[];
  const unsupported = unsupportedQuestions(questions);
  const referralType = offer
    ? networkOfferReferralType(offer, availability)
    : undefined;
  // A coordination desk assigns the facility itself and has no forms.
  const needsForm = offer?.kind !== "coordinator";

  useEffect(() => {
    setAnswers(initialAnswers(questions));
    setFormErrors([]);
    // Reset only when another form is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.id, resolveQuery.dataUpdatedAt]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const transaction = await submitNetworkReferral(
        {
          offer: offer!,
          availability,
          form: form
            ? {
                questionnaireId: form.id,
                results: serializeAnswers(questions, answers),
              }
            : undefined,
          facilityId,
          patientId,
          encounterId,
          title: title.trim(),
          reason: note.trim(),
          referralType,
          urgency,
        },
        setProgress,
      );
      if (!transaction.referral_id) {
        throw new Error("ccn_referral_not_created");
      }
      return transaction.referral_id;
    },
    onSettled: () => setProgress(undefined),
    onSuccess: (referralId) => {
      toast.success(t("ccn_referral_sent"));
      onSent(referralId);
    },
  });
  const sendError = sendMutation.error
    ? describeNetworkError(sendMutation.error)
    : undefined;

  const pickOffer = (next: NetworkOffer | null, auto?: boolean) => {
    sendMutation.reset();
    setOffer(next);
    setFormId("");
    if (next && !titleEdited) setTitle(networkOfferLabel(next));
    if (next && !auto) setChoosing(false);
  };

  const moveTo = (next: "edit" | "review") => {
    setStep(next);
    requestAnimationFrame(() => {
      if (embedded) {
        headingRef.current?.scrollIntoView({ block: "start" });
      } else {
        (scrollRef?.current ?? window).scrollTo({ top: 0 });
      }
      headingRef.current?.focus({ preventScroll: true });
    });
  };

  const formReady =
    !!offer &&
    resolveQuery.isSuccess &&
    !unsupported.length &&
    (!needsForm || !!form);
  const canReview = formReady && !!title.trim();

  const review = () => {
    if (!canReview) return;
    const errors = form ? validateAnswers(questions, answers) : [];
    setFormErrors(errors);
    if (errors.length) {
      requestAnimationFrame(() =>
        document
          .querySelector(`[data-question-id="${errors[0].questionId}"]`)
          ?.scrollIntoView({ block: "center" }),
      );
      return;
    }
    moveTo("review");
  };

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={sendMutation.isPending}
        onClick={() => (step === "edit" ? onCancel() : moveTo("edit"))}
      >
        {step === "review" && <ArrowLeft className="size-4" />}
        {t(step === "review" ? "ccn_back_to_editing" : "cancel")}
      </Button>
      {step === "edit" ? (
        <Button
          type="button"
          disabled={!canReview}
          onClick={review}
          data-cy="ccn-review-referral"
        >
          {t("ccn_review")}
          <ArrowRight className="size-4" />
        </Button>
      ) : (
        <Button
          type="button"
          disabled={sendMutation.isPending}
          onClick={() => sendMutation.mutate()}
          data-cy="ccn-send-referral"
        >
          {sendMutation.isPending && (
            <Spinner className="size-4 animate-spin" />
          )}
          {t(
            progress
              ? `ccn_sending_${progress}`
              : sendMutation.isPending
                ? "ccn_sending"
                : "ccn_send_referral",
          )}
          <ArrowRight className="size-4" />
        </Button>
      )}
    </div>
  );

  return (
    <EmbeddedContext.Provider value={embedded}>
      <div
        ref={embedded ? headingRef : undefined}
        tabIndex={embedded ? -1 : undefined}
        className={
          embedded
            ? "space-y-6 outline-none"
            : "mx-auto w-full max-w-5xl space-y-6 px-3 pb-10 md:px-0"
        }
      >
        {!embedded && (
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div
              ref={headingRef}
              tabIndex={-1}
              className="space-y-1 outline-none"
            >
              <PageTitle>
                {t(
                  step === "review"
                    ? "ccn_review_network_referral"
                    : "ccn_new_network_referral",
                )}
              </PageTitle>
              <Muted>
                {patientQuery.data?.name
                  ? t("ccn_network_referral_for", {
                      name: patientQuery.data.name,
                    })
                  : t("ccn_network_referral_create_description")}
              </Muted>
            </div>
            {actions}
          </header>
        )}

        <div className="space-y-6" hidden={step !== "edit"}>
          <DestinationSection embedded={embedded} title={t("ccn_organization")}>
            {destinationControl}
            {offer && !choosing ? (
              <div className="flex items-start justify-between gap-3">
                <OrganizationSummary
                  offer={offer}
                  description={availability?.description}
                  referralType={referralType}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setChoosing(true)}
                >
                  {t("ccn_change_organization")}
                </Button>
              </div>
            ) : (
              <NetworkDestinationSearch
                selected={offer}
                onSelect={(next, options) => pickOffer(next, options?.auto)}
                rediscoverKey={rediscoverKey}
              />
            )}
            {offer && choosing && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setChoosing(false)}
              >
                {t("ccn_use_selected_organization")}
              </Button>
            )}
          </DestinationSection>

          <Section number={2} title={t("ccn_reason")}>
            <Field>
              <FieldLabel htmlFor={`${id}-title`}>
                {t("ccn_referral_title")}
              </FieldLabel>
              <Input
                id={`${id}-title`}
                value={title}
                maxLength={255}
                placeholder={t("ccn_referral_title_placeholder")}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setTitleEdited(true);
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-note`}>
                {t("ccn_referral_note")}
              </FieldLabel>
              <textarea
                id={`${id}-note`}
                className={TEXTAREA_CLASS}
                value={note}
                rows={3}
                placeholder={t("ccn_referral_note_placeholder")}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
            <Field className="max-w-xs">
              <FieldLabel htmlFor={`${id}-urgency`}>
                {t("ccn_urgency")}
              </FieldLabel>
              <Select
                value={urgency}
                onValueChange={(value) => setUrgency(value as ReferralUrgency)}
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
            <Muted>{t("ccn_network_referral_description")}</Muted>
          </Section>

          {offer && needsForm && (
            <Section number={3} title={t("ccn_request_form")}>
              {resolveQuery.isPending ? (
                <p
                  role="status"
                  className="flex items-center gap-2 py-4 text-sm text-muted-foreground"
                >
                  <Spinner className="size-4 animate-spin" />
                  {t("ccn_loading_network_form")}
                </p>
              ) : resolveQuery.isError ? (
                <div className="space-y-2">
                  <FieldError>
                    {t(describeNetworkError(resolveQuery.error).key, {
                      ...describeNetworkError(resolveQuery.error).values,
                    })}
                  </FieldError>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => resolveQuery.refetch()}
                  >
                    <RefreshCw className="size-4" />
                    {t("ccn_reload_forms")}
                  </Button>
                </div>
              ) : !form ? (
                <Muted>{t("ccn_network_no_request_form")}</Muted>
              ) : (
                <div className="space-y-4">
                  {forms.length > 1 && (
                    <Field className="max-w-md">
                      <FieldLabel htmlFor={`${id}-form`}>
                        {t("ccn_request_form")}
                      </FieldLabel>
                      <Select value={form.id} onValueChange={setFormId}>
                        <SelectTrigger id={`${id}-form`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {forms.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                  <p className="text-sm font-semibold">{form.title}</p>
                  {unsupported.length ? (
                    <FieldError>{t("ccn_form_unsupported")}</FieldError>
                  ) : (
                    <>
                      {formErrors.length > 0 && (
                        <FieldError>{t("ccn_form_check_answers")}</FieldError>
                      )}
                      <NetworkRequestForm
                        idPrefix={id}
                        questions={questions}
                        answers={answers}
                        onChange={setAnswers}
                        errors={formErrors}
                      />
                    </>
                  )}
                </div>
              )}
            </Section>
          )}
        </div>

        {step === "review" && offer && (
          <div className="space-y-6">
            <Section title={t("ccn_organization")}>
              <OrganizationSummary
                offer={offer}
                description={availability?.description}
                referralType={referralType}
              />
            </Section>
            <Section title={t("ccn_reason")}>
              <p className="text-base font-semibold">{title}</p>
              {note && <p className="whitespace-pre-wrap text-sm">{note}</p>}
              <p className="text-sm">
                {t("ccn_urgency")}: {t(`ccn_urgency__${urgency}`)}
              </p>
            </Section>
            {form && (
              <Section title={form.title}>
                <NetworkRequestAnswers
                  questions={questions}
                  answers={answers}
                />
              </Section>
            )}
          </div>
        )}

        {sendError && (
          <div
            role="alert"
            className="space-y-2 rounded-lg border border-destructive/30 p-4"
          >
            <FieldError>{t(sendError.key, { ...sendError.values })}</FieldError>
            {sendError.recovery === "resolve" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  sendMutation.reset();
                  void resolveQuery.refetch();
                  moveTo("edit");
                }}
              >
                {t("ccn_reload_forms")}
              </Button>
            )}
            {sendError.recovery === "reselect" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  pickOffer(null);
                  setChoosing(true);
                  setRediscoverKey((key) => key + 1);
                  moveTo("edit");
                }}
              >
                {t("ccn_choose_another_organization")}
              </Button>
            )}
          </div>
        )}
        {embedded && <div className="flex justify-end">{actions}</div>}
      </div>
    </EmbeddedContext.Provider>
  );
}

/** Embedded, CARE's own destination section already frames this block. */
function DestinationSection({
  embedded,
  title,
  children,
}: {
  embedded: boolean;
  title: string;
  children: ReactNode;
}) {
  if (embedded) return <div className="space-y-4">{children}</div>;
  return (
    <Section number={1} title={title}>
      {children}
    </Section>
  );
}
