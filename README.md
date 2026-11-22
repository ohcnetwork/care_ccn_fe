# care_ccn_fe

CARE frontend app for referrals over the CCN (Beckn) network. It pairs with
the `care_ccn_be` backend plugin (`/api/care_ccn_be/...`).

It adds:

- **Network referrals** page at `/facility/:facilityId/network_referrals`, with
  a facility sidebar link (outgoing and incoming network transactions).
- The **Organizations** destination type in CARE's create-referral dialog
  (`referralDestinations`, with `replaces: "external_organization"`): picking
  Organizations searches the network; pick an organization, fill the
  receiving facility's request form, and send it (`select` → `init` → `confirm`).
- Slots on CARE's referral pages:
  - `ReferralStatusExtras`: a "Network" badge on network referrals.
  - `ReferralDetailsSidebar`: the network transaction status, refreshed after
    edits that the backend syncs.
  - `ReferralSharedRecordBadges`: "Shared via / received via network" on
    shared records.

The core extension points (`referralDestinations` and the three slots) are on
the `care_fe` branch `ccn-referral-plugin-develop` (on top of `develop`) and are declared in
`care_fe/src/pluginTypes.ts`. `src/pluginContract.ts` repeats the parts this
app implements; keep both in step.

## Layout

The layout follows `care_kutumba_fe`:

| Path                         | What                                                          |
| ---------------------------- | ------------------------------------------------------------- |
| `src/manifest.tsx`           | The manifest CARE loads (`./manifest` federation expose)      |
| `src/routes.tsx`             | Pages                                                         |
| `src/apis/`                  | API route definitions (`ccn.ts`, and the core `care.ts` ones) |
| `src/lib/request.ts`         | Fetch client: `window.CARE_API_URL` plus CARE's access token  |
| `src/types/`                 | CCN types and the trimmed CARE types this app uses            |
| `src/components/network/`    | Network search, status and the destination provider           |
| `src/components/pluggables/` | Components for CARE's `PLUGIN_Component` slots                |
| `src/components/ui/`         | Copies of CARE's UI primitives                                |
| `public/locale/en.json`      | Strings, in the `care_ccn_fe` namespace                       |

A remote app cannot import CARE's modules at runtime. Only `react`,
`react-dom`, `react-i18next`, `@tanstack/react-query`, `@tanstack/react-router` and `sonner`
are shared. UI primitives were copied with CARE's
`npm run clone-component -- @/components/ui/<name> <app>`.

## Styles

`src/index.css` emits Tailwind utilities scoped to `.care-ccn-fe` and only
references the theme (CARE defines the variables). Unscoped utilities load
after CARE's stylesheet and override its responsive classes on every page,
e.g. the landing page's "Search Facilities" button. Wrap every root the app
renders (slot components, pages, portalled sheet content) in `CcnScope` or
`CCN_SCOPE` from `src/lib/scope.ts`.

## One React

Federation shares `react` only for ES `import` statements. A CommonJS
`require("react")` in a dependency bundles a second React with no renderer,
and hooks then fail with "Cannot read properties of null". `@base-ui/react`
gets `useSyncExternalStore` from the CommonJS `use-sync-external-store/shim`,
so `vite.config.mts` aliases it (and `/with-selector`) to the ES modules in
`src/lib/shims`. After adding a dependency, check that no chunk other than
`__federation_shared_react*` imports the bundled `react-*.js`:

```bash
grep -l 'from "./react-' dist/assets/*.js
```

## Development

```bash
npm install
npm start          # vite build --watch + vite preview on :4174
```

Enable it in `care_fe/.env.local` and restart CARE's dev server:

```
REACT_ENABLED_APPS=ohcnetwork/care_ccn_fe@localhost:4174/assets/remoteEntry.js
```

The plugin rebuilds on change; reload CARE to pick it up (there is no HMR
across the federation boundary).

## Checks

```bash
npm run typecheck
npm run test:unit
npm run lint
```

`e2e/referral-network.spec.ts` uses CARE's Playwright helpers. Copy it to
`care_fe/tests/facility/referrals/` and run it from `care_fe` with this app
enabled in `REACT_ENABLED_APPS`.
