import { type ComponentType, Suspense, lazy } from "react";

import type { ReferralAvailabilityRead } from "@/types/care";

export interface ReferralDestinationPickerProps {
  selected: ReferralAvailabilityRead | null;
  onSelect: (availability: ReferralAvailabilityRead) => void;
  /** CARE's own picker, injected by the override framework. */
  __base?: ComponentType<{
    selected: ReferralAvailabilityRead | null;
    onSelect: (availability: ReferralAvailabilityRead) => void;
  }>;
}

const NetworkDestinationPicker = lazy(
  () => import("@/components/overrides/NetworkDestinationPicker"),
);

/**
 * Override for CARE's `ReferralDestinationPicker` (the "Refer to" block of the
 * create-referral dialog). It adds a "Network (CCN)" destination type.
 *
 * CARE renders overrides without a `Suspense` boundary, so this wrapper loads
 * the picker lazily inside its own, showing CARE's picker meanwhile.
 *
 * Needs CARE built with
 * `REACT_MFE_REGISTERED_COMPONENTS=ReferralDestinationPicker`; without it the
 * dialog keeps CARE's picker.
 */
export function ReferralDestinationPickerOverride(
  props: ReferralDestinationPickerProps,
) {
  const { __base: Base, ...pickerProps } = props;
  return (
    <Suspense fallback={Base ? <Base {...pickerProps} /> : null}>
      <NetworkDestinationPicker {...props} />
    </Suspense>
  );
}
