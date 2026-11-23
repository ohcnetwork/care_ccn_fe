import { type ComponentType, Suspense, lazy } from "react";

import type { ReferralRetrieve } from "@/types/care";

interface ReferralConversationProps {
  referral: ReferralRetrieve;
  canWrite: boolean;
}

const ReferralNetworkStatusPanel = lazy(
  () => import("@/components/overrides/ReferralNetworkStatusPanel"),
);

/**
 * Override for CARE's `ReferralConversation`, the discussion in the side
 * column of the referral page. For a referral sent over the CCN network it
 * shows the network status box above the discussion.
 *
 * Needs CARE built with
 * `REACT_MFE_REGISTERED_COMPONENTS=ReferralConversation`.
 */
export function ReferralConversationOverride({
  __base: Base,
  ...props
}: ReferralConversationProps & {
  /** CARE's own discussion, injected by the override framework. */
  __base?: ComponentType<ReferralConversationProps>;
}) {
  return (
    // Inline styles: this wrapper sits outside the app's style scope.
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Suspense fallback={null}>
        <ReferralNetworkStatusPanel referral={props.referral} />
      </Suspense>
      {Base && <Base {...props} />}
    </div>
  );
}
