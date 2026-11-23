import { useLocation, useNavigate, useRouter } from "@tanstack/react-router";

import Page from "@/components/common/Page";
import { NetworkReferralWorkflow } from "@/components/network/NetworkReferralWorkflow";

import { useTranslation } from "@/hooks/useTranslation";

/**
 * The network referral page, for links and for CARE builds without the
 * `CreateReferralDialog` override (which runs the workflow in the dialog).
 */
export default function NetworkReferralCreate({
  facilityId,
  patientId,
}: {
  facilityId: string;
  patientId: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const navigate = useNavigate();
  const search = useLocation().search as Record<string, unknown>;
  const encounterId =
    typeof search.encounterId === "string" && search.encounterId
      ? search.encounterId
      : undefined;

  return (
    <Page title={t("ccn_new_network_referral")}>
      <NetworkReferralWorkflow
        facilityId={facilityId}
        patientId={patientId}
        encounterId={encounterId}
        onCancel={() => {
          if (router.history.canGoBack()) router.history.back();
          else
            void navigate({
              to: "/facility/$facilityId/patient/$patientId",
              params: { facilityId, patientId },
            });
        }}
        onSent={(referralId) =>
          void navigate({
            to: "/referrals/$referralId",
            params: { referralId },
            search: { sourceUrl: router.state.location.href },
            replace: true,
          })
        }
      />
    </Page>
  );
}
