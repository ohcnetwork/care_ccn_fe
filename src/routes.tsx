import { lazy } from "react";

const NetworkReferrals = lazy(() => import("@/pages/NetworkReferrals"));
const NetworkReferralCreate = lazy(
  () => import("@/pages/NetworkReferralCreate"),
);

const routes = {
  // Under `/admin` so the host shows it with the admin sidebar.
  "/admin/network_referrals": () => <NetworkReferrals />,
  "/facility/:facilityId/patient/:patientId/network_referral": ({
    facilityId,
    patientId,
  }: {
    facilityId: string;
    patientId: string;
  }) => <NetworkReferralCreate facilityId={facilityId} patientId={patientId} />,
};

export default routes;
