/**
 * The parts of CARE's plugin contract (`care_fe/src/pluginTypes.ts` on
 * `develop`) this app uses. A remote app cannot import host modules, so the
 * shapes are repeated here; keep them in step with core.
 */
import type { ReactNode } from "react";

export interface PluginNavigationLink {
  name: string;
  /**
   * Facility nav items are relative to the facility (`network_referrals`);
   * admin nav items are absolute (`/admin/network_referrals`).
   */
  url: string;
  icon?: ReactNode;
}
