import { lazy } from "react";

const NetworkReferrals = lazy(() => import("@/pages/NetworkReferrals"));
const NetworkReferralCreate = lazy(
  () => import("@/pages/NetworkReferralCreate"),
);

const routes = {
  "/facility/:facilityId/network_referrals": ({
    facilityId,
  }: {
    facilityId: string;
  }) => <NetworkReferrals facilityId={facilityId} />,
  "/facility/:facilityId/patient/:patientId/network_referral": ({
    facilityId,
    patientId,
  }: {
    facilityId: string;
    patientId: string;
  }) => <NetworkReferralCreate facilityId={facilityId} patientId={patientId} />,
};

export default routes;
