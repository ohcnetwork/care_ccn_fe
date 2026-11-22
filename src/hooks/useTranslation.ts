import { useTranslation as useTranslationBase } from "react-i18next";

/** This app's keys live in its own namespace (`public/locale/<lang>.json`). */
export const I18N_NAMESPACE = "care_ccn_fe";

/**
 * Looks keys up in this app's namespace first, then in CARE's, so shared
 * strings ("cancel", `referral_type_*`) are not duplicated here.
 */
export const useTranslation = () => {
  // `fallback` searches the namespaces in order; the default mode only
  // searches the first one.
  return useTranslationBase([I18N_NAMESPACE, "care_fe"], {
    nsMode: "fallback",
  });
};
