import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Network } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { query } from "@/lib/request";
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
import { Spinner } from "@/components/ui/spinner";
import { Muted } from "@/components/ui/typography";

import { NetworkReferralWorkflow } from "@/components/network/NetworkReferralWorkflow";
import type { ReferralDestinationPickerProps } from "@/components/overrides/ReferralDestinationPickerOverride";
import { useReferralDialog } from "@/components/overrides/referralDialogContext";

import { useTranslation } from "@/hooks/useTranslation";

import { careRoutes } from "@/apis/care";

const NETWORK = "ccn_network";

/** CARE's own destination types, with CARE's labels. */
const CORE_TYPES = [
  { value: "facility", label: "referral_destination_facility" },
  { value: "internal_organization", label: "referral_destination_departments" },
  {
    value: "external_organization",
    label: "referral_destination_organization",
  },
] as const;

type CoreType = (typeof CORE_TYPES)[number]["value"];
type DestinationType = CoreType | typeof NETWORK;

const UNIT_LIMIT = 100;

/**
 * CARE's "Refer to" block with a "Network (CCN)" type added. The CARE types
 * list the referral units of that type, and the dialog continues as usual.
 *
 * "Network (CCN)" runs the network workflow in the same dialog, right below
 * the type select, when the `CreateReferralDialog` override provides the
 * dialog's patient and encounter. CARE's reason and form sections and its
 * Review button do not apply to a network referral and are hidden meanwhile.
 * Choosing a CARE type again brings them back.
 * Without that override it opens the network referral page instead.
 */
export default function NetworkDestinationPicker({
  selected,
  onSelect,
  __base: Base,
}: ReferralDestinationPickerProps) {
  const { t } = useTranslation();
  const id = useId();
  const navigate = useNavigate();
  const dialog = useReferralDialog();
  const params = useParams({ strict: false }) as Record<string, unknown>;
  const facilityId = dialog?.facilityId ?? stringParam(params.facilityId);
  const patientId =
    dialog?.patientId ??
    stringParam(params.patientId) ??
    stringParam(params.id);
  const encounterId = dialog
    ? dialog.encounterId
    : stringParam(params.encounterId);

  const [type, setType] = useState<DestinationType>(
    selected?.entity_type === "internal_organization" ||
      selected?.entity_type === "external_organization"
      ? selected.entity_type
      : "facility",
  );
  // The CARE type to return to when the network workflow is left.
  const [lastCoreType, setLastCoreType] = useState<CoreType>(
    type === NETWORK ? "facility" : type,
  );
  const changeType = (value: DestinationType) => {
    if (value !== NETWORK) setLastCoreType(value);
    setType(value);
  };

  // A network referral needs a known patient. Without a facility (the patient
  // profile) it is a generic referral, linked only to the patient.
  const networkAvailable = !!patientId;
  useEffect(() => {
    if (dialog || type !== NETWORK || !facilityId || !patientId) return;
    void navigate({
      to: "/facility/$facilityId/patient/$patientId/network_referral",
      params: { facilityId, patientId },
      search: encounterId ? { encounterId } : {},
    });
  }, [dialog, type, facilityId, patientId, encounterId, navigate]);

  const inPlaceActive = type === NETWORK && !!dialog && networkAvailable;
  const hostRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!inPlaceActive) return;
    return hideCareFormParts(hostRef.current);
  }, [inPlaceActive]);

  // Without the route context the network type cannot open; keep CARE's.
  if (!networkAvailable && Base) {
    return <Base selected={selected} onSelect={onSelect} />;
  }

  const typeSelect = (
    <Field className="max-w-xs">
      <FieldLabel htmlFor={id}>{t("referral_destination_type")}</FieldLabel>
      <Select
        value={type}
        onValueChange={(value) => changeType(value as DestinationType)}
      >
        <SelectTrigger id={id} data-cy="referral-destination-type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CORE_TYPES.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {t(item.label)}
            </SelectItem>
          ))}
          <SelectItem value={NETWORK}>{t("ccn_destination_type")}</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );

  const inPlace = inPlaceActive;

  return (
    <CcnScope>
      <div ref={hostRef} className="space-y-4">
        {typeSelect}
        {type !== NETWORK ? (
          <UnitSelect
            key={type}
            type={type}
            selected={selected?.entity_type === type ? selected : null}
            onSelect={onSelect}
          />
        ) : inPlace && dialog && patientId ? (
          <NetworkReferralWorkflow
            embedded
            facilityId={facilityId}
            patientId={patientId}
            encounterId={encounterId}
            onCancel={() => setType(lastCoreType)}
            onSent={dialog.onNetworkReferralSent}
          />
        ) : (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Network className="size-4" aria-hidden="true" />
            {t("ccn_destination_opening")}
          </p>
        )}
      </div>
    </CcnScope>
  );
}

/**
 * Hides the parts of CARE's New Referral dialog that belong to CARE's own
 * flow: the sections after the destination section and the Review button.
 * Returns the function that shows them again.
 */
function hideCareFormParts(host: HTMLElement | null) {
  const section = host?.closest("section");
  if (!host || !section?.parentElement) return undefined;
  const dialog = host.closest('[role="dialog"]') ?? document;
  const targets = [
    ...Array.from(section.parentElement.children).filter(
      (element) => element !== section,
    ),
    ...Array.from(dialog.querySelectorAll('button[type="submit"][form]')),
  ].filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement && element.style.display !== "none",
  );
  for (const element of targets) element.style.display = "none";
  return () => {
    for (const element of targets) element.style.removeProperty("display");
  };
}

function stringParam(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

/** The active referral units of one CARE destination type. */
function UnitSelect({
  type,
  selected,
  onSelect,
}: {
  type: CoreType;
  selected: ReferralDestinationPickerProps["selected"];
  onSelect: ReferralDestinationPickerProps["onSelect"];
}) {
  const { t } = useTranslation();
  const id = useId();
  const unitsQuery = useQuery({
    queryKey: ["referrals", "destination-picker", "ccn", type],
    queryFn: query(careRoutes.listReferralAvailabilities, {
      queryParams: {
        entity_type: type,
        status: "active",
        ordering: "name",
        limit: UNIT_LIMIT,
      },
      silent: true,
    }),
  });
  const units = unitsQuery.data?.results ?? [];

  return (
    <Field className="min-w-0">
      <FieldLabel htmlFor={id}>{t("referral_picker_unit")}</FieldLabel>
      {unitsQuery.isPending ? (
        <Muted className="flex items-center gap-2">
          <Spinner className="size-4 animate-spin" />
          {t("loading")}
        </Muted>
      ) : unitsQuery.isError ? (
        <Muted>{t("referral_picker_load_error")}</Muted>
      ) : !units.length ? (
        <Muted>{t("referral_picker_no_units")}</Muted>
      ) : (
        <Select
          value={selected?.id ?? ""}
          onValueChange={(value) => {
            const unit = units.find((item) => item.id === value);
            if (unit) onSelect(unit);
          }}
        >
          <SelectTrigger id={id} data-cy="referral-destination-unit">
            <SelectValue placeholder={t("referral_picker_select_unit")} />
          </SelectTrigger>
          <SelectContent>
            {units.map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{unit.name}</span>
                  <Badge variant="neutral" size="xs">
                    {t(`referral_type_${unit.referral_type}`)}
                  </Badge>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}
