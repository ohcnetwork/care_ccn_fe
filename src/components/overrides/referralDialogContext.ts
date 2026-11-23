import { createContext, useContext } from "react";

/**
 * Set by the `CreateReferralDialog` override for the destination picker it
 * contains: the dialog's patient and encounter, and how to finish once a
 * network referral is sent (close CARE's dialog).
 */
export interface ReferralDialogContextValue {
  facilityId?: string;
  patientId?: string;
  encounterId?: string;
  onNetworkReferralSent: (referralId: string) => void;
}

export const ReferralDialogContext =
  createContext<ReferralDialogContextValue | null>(null);

export const useReferralDialog = () => useContext(ReferralDialogContext);
