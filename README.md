# care_ccn_fe

CARE frontend app for referrals over the CCN (Beckn) network. It pairs with
the `care_ccn_be` backend plugin (`/api/care_ccn_be/...`).

It works with CARE's `develop` branch as it is: it uses only the plugin points
CARE already has, and needs no changes to `care_fe`.

It adds:

- A **Network (CCN)** option in the "Refer to" dropdown of CARE's New
  Referral dialog. Choosing it runs the network workflow in the same dialog:
  search the network, pick an organization and service, answer its request
  form, review and send. Choosing a CARE type there returns to CARE's form;
  once sent, the dialog closes and the referral lists refresh. This overrides
  CARE's `CreateReferralDialog` (to know the dialog's patient and encounter
  and to close it) and `ReferralDestinationPicker`. Without the
  `CreateReferralDialog` override, the option opens the network referral
  page instead.
- A **Network** badge next to the status of network referrals, in CARE's
  referral lists and on the referral and respond pages. On the referral page
  the badge opens the network transaction status (status, last error,
  counterparty, activity, and a "Request update" button). This overrides
  CARE's `ReferralStatusBadge`. CARE passes that badge only the status, so the
  override finds the referral from the list row's link or the `referralId`
  route param.

  The overrides need CARE built with:

  ```env
  REACT_MFE_REGISTERED_COMPONENTS=CreateReferralDialog,ReferralDestinationPicker,ReferralStatusBadge
  ```

  Without it CARE's dialog and badges are unchanged and the buttons below
  still work.

- **Refer via network** buttons, through CARE's `EncounterActions` (encounter
  actions) and `PatientInfoCardActions` (patient card) slots.
- A **New network referral** page at
  `/facility/:facilityId/patient/:patientId/network_referral` (optional
  `?encounterId=`): search the network, pick an organization, answer the
  receiving facility's request form, review and send it
  (`select` → `init` → `confirm`). The referral created at this facility then
  opens on CARE's referral page. The page and the dialog share
  `src/components/network/NetworkReferralWorkflow.tsx`.
- **Network referrals** page at `/facility/:facilityId/network_referrals`, with
  a facility sidebar link (outgoing and incoming network transactions).

CARE's questionnaire engine is not available to an app, so the request form is
rendered by `src/components/network/form/`. It covers the types request forms
use (text, numbers, yes/no, dates, times, URLs, choices with fixed options,
groups and `enable_when`). A form with clinical (structured), quantity,
value-set or repeating-group questions is reported as unsupported and cannot
be sent.

`src/pluginContract.ts` repeats the parts of `care_fe/src/pluginTypes.ts` this
app uses; keep both in step.

## Layout

The layout follows `care_kutumba_fe`:

| Path                         | What                                                          |
| ---------------------------- | ------------------------------------------------------------- |
| `src/manifest.tsx`           | The manifest CARE loads (`./manifest` federation expose)      |
| `src/routes.tsx`             | Pages                                                         |
| `src/apis/`                  | API route definitions (`ccn.ts`, and the core `care.ts` ones) |
| `src/lib/request.ts`         | Fetch client: `window.CARE_API_URL` plus CARE's access token  |
| `src/types/`                 | CCN types and the trimmed CARE types this app uses            |
| `src/components/network/`    | Network search, request form and the send workflow            |
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
