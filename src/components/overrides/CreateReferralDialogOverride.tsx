import { useQueryClient } from "@tanstack/react-query";
import { type ComponentType, type ReactNode, useMemo, useState } from "react";

import { request } from "@/lib/request";

import {
  ReferralDialogContext,
  type ReferralDialogContextValue,
} from "@/components/overrides/referralDialogContext";

import { careRoutes } from "@/apis/care";
import type { ReferralRetrieve } from "@/types/care";

interface EncounterRef {
  id: string;
  patient: { id: string };
  facility: { id: string };
}

interface CreateReferralDialogProps {
  children?: ReactNode;
  onCreated?: (referral: ReferralRetrieve) => void;
  encounter?: EncounterRef;
  patientId?: string;
  facilityId?: string;
}

/**
 * Override for CARE's `CreateReferralDialog`. It renders CARE's dialog as it
 * is and gives the destination picker inside it the dialog's patient and
 * encounter, so choosing "Network (CCN)" runs the network workflow in the
 * same dialog. Once the referral is sent, CARE's dialog is closed by
 * remounting it (its open state is internal).
 *
 * Needs CARE built with
 * `REACT_MFE_REGISTERED_COMPONENTS=CreateReferralDialog`.
 */
export function CreateReferralDialogOverride({
  __base: Base,
  ...props
}: CreateReferralDialogProps & {
  __base?: ComponentType<CreateReferralDialogProps>;
}) {
  const client = useQueryClient();
  const [instance, setInstance] = useState(0);
  const { encounter, patientId, facilityId, onCreated } = props;

  const value = useMemo<ReferralDialogContextValue>(
    () => ({
      facilityId: encounter?.facility.id ?? facilityId,
      patientId: encounter?.patient.id ?? patientId,
      encounterId: encounter?.id,
      onNetworkReferralSent: (referralId) => {
        setInstance((current) => current + 1);
        void client.invalidateQueries({ queryKey: ["referrals"] });
        if (onCreated) {
          void request(careRoutes.getReferral, {
            pathParams: { referralId },
            silent: true,
          })
            .then(onCreated)
            .catch(() => undefined);
        }
      },
    }),
    [client, encounter, patientId, facilityId, onCreated],
  );

  if (!Base) return null;
  return (
    <ReferralDialogContext.Provider value={value}>
      <Base key={instance} {...props} />
    </ReferralDialogContext.Provider>
  );
}
