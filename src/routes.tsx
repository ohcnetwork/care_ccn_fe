import { lazy } from "react";

const NetworkReferrals = lazy(() => import("@/pages/NetworkReferrals"));

const routes = {
  "/facility/:facilityId/network_referrals": ({
    facilityId,
  }: {
    facilityId: string;
  }) => <NetworkReferrals facilityId={facilityId} />,
};

export default routes;
