import { Link } from "@tanstack/react-router";
import { Network } from "lucide-react";

import { CcnScope } from "@/lib/scope";
import { cn } from "@/lib/utils";

import { buttonVariants } from "@/components/ui/button";

import { useTranslation } from "@/hooks/useTranslation";

/** Opens this app's network referral page for a patient. */
export function ReferViaNetworkLink({
  facilityId,
  patientId,
  encounterId,
  className,
}: {
  facilityId: string;
  patientId: string;
  encounterId?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <CcnScope>
      <Link
        to="/facility/$facilityId/patient/$patientId/network_referral"
        params={{ facilityId, patientId }}
        search={encounterId ? { encounterId } : {}}
        className={cn(
          "inline-flex items-center gap-2",
          className ?? buttonVariants({ variant: "outline" }),
        )}
        data-cy="ccn-refer-via-network"
      >
        <Network className="size-4" aria-hidden="true" />
        {t("ccn_refer_via_network")}
      </Link>
    </CcnScope>
  );
}
