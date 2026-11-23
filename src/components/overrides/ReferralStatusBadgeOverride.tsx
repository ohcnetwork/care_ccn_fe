import { useParams } from "@tanstack/react-router";
import {
  type ComponentType,
  Suspense,
  lazy,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { ReferralTarget } from "@/components/overrides/ReferralNetworkMarker";

export interface ReferralStatusBadgeProps {
  status: string;
  /** CARE's own badge, injected by the override framework. */
  __base?: ComponentType<{ status: string }>;
}

const ReferralNetworkMarker = lazy(
  () => import("@/components/overrides/ReferralNetworkMarker"),
);

const REFERRAL_HREF = /\/referrals\/([^/?#]+)/;

/**
 * CARE passes the badge only the status, so the referral is found from where
 * the badge is rendered:
 *
 * - In a referral list row (the facility, patient and encounter lists), from
 *   the row's link to the referral.
 * - On the referral and respond pages, from the `referralId` route param.
 *   Badges in a `<dd>` there belong to a linked referral shown as a shared
 *   record, not to the page's referral, so they are left as they are.
 */
function findReferral(
  element: HTMLElement | null,
  routeReferralId: string | undefined,
): ReferralTarget | null {
  if (!element) return null;
  const row = element.closest('[data-cy="referral-row"], [role="listitem"]');
  if (row) {
    const href = row
      .querySelector('a[href*="/referrals/"]')
      ?.getAttribute("href");
    const match = href?.match(REFERRAL_HREF);
    return match
      ? { referralId: decodeURIComponent(match[1]), onReferralPage: false }
      : null;
  }
  if (routeReferralId && !element.closest("dd")) {
    return { referralId: routeReferralId, onReferralPage: true };
  }
  return null;
}

/**
 * Override for CARE's `ReferralStatusBadge`: shows CARE's badge and, for a
 * referral sent over the CCN network, a "Network" badge next to it. On the
 * referral page the network badge opens the network transaction status.
 *
 * Needs CARE built with
 * `REACT_MFE_REGISTERED_COMPONENTS=ReferralStatusBadge`.
 */
export function ReferralStatusBadgeOverride({
  __base: Base,
  ...props
}: ReferralStatusBadgeProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const routeReferralId = (
    useParams({ strict: false }) as { referralId?: string }
  ).referralId;
  const [target, setTarget] = useState<ReferralTarget | null>(null);

  useLayoutEffect(() => {
    const next = findReferral(ref.current, routeReferralId);
    setTarget((current) =>
      current?.referralId === next?.referralId &&
      current?.onReferralPage === next?.onReferralPage
        ? current
        : next,
    );
  }, [routeReferralId]);

  return (
    // Inline styles: this wrapper sits outside the app's style scope.
    <span
      ref={ref}
      style={{
        display: "inline-flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.375rem",
      }}
    >
      {Base && <Base {...props} />}
      {target && (
        <Suspense fallback={null}>
          <ReferralNetworkMarker {...target} />
        </Suspense>
      )}
    </span>
  );
}
