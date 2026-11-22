import { type ReactNode, createElement } from "react";

/**
 * This app's utilities only apply inside this class (see `src/index.css`),
 * so they never override CARE's own classes. Put it on every root the app
 * renders, including portalled content such as sheets.
 */
export const CCN_SCOPE = "care-ccn-fe";

/** A layout-neutral scope root for content rendered into CARE's slots. */
export function CcnScope({ children }: { children: ReactNode }) {
  return createElement(
    "span",
    { className: CCN_SCOPE, style: { display: "contents" } },
    children,
  );
}
