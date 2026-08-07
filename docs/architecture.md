# Architecture

`content-manager-web` is the admin CMS for the Aquifer platform. Internal
users and translation-company users use it to create, edit, review, assign,
and publish resource content, and to manage projects, users, and reporting.
It is a client of `Aquifer.API` — for how it fits with the other repos, see
[ecosystem.md in aquifer-server](https://github.com/eten-tech/aquifer-server/blob/master/docs/ecosystem.md).

## Stack

- **SvelteKit 2 + Svelte 5**, static-prerendered via `@sveltejs/adapter-static`
  (it's a pure SPA; all data comes from the API at runtime)
- **Vite 5**, **TailwindCSS 4 + DaisyUI 5**, **Chart.js** for reporting
- **Auth0 SPA SDK** for authentication
- **svelte-i18n** for localization
- Deployed to **Azure Static Web Apps** (QA and Prod) via GitHub Actions

## Configuration

Runtime config is baked in at build/dev time from env files. `yarn use-config
<name>` concatenates `config/.env.global` + `config/.env.<name>` (plus the
current git SHA as `PUBLIC_COMMIT_SHA`) into a root `.env`, which Vite reads.
Available configs: `local` (API at `localhost:5257`), `qa`, `prod`.

`src/lib/config.ts` is the typed list of supported `PUBLIC_*` variables:
API URL and API key, Auth0 domain/client ID/audience, App Insights connection
string.

## Talking to the API

All API calls go through `src/lib/utils/http-service.ts` (`getFromApi`,
`postToApi`, etc.), which:

- targets `PUBLIC_AQUIFER_API_URL` (`Aquifer.API`, the internal API),
- attaches **both** an `api-key` header (the app-level key) and an
  `Authorization: Bearer` Auth0 JWT (the user) — the server requires each,
- attaches a `bn-source: admin-cms` header so the server can attribute
  requests/analytics to this app,
- throws typed errors (`ApiError`, `FetchError`, `TokenMissingError`) rather
  than returning failed responses.

Don't call `fetch` against the API directly; add a helper here if the shape
you need doesn't exist.

## Auth and permissions

`src/lib/stores/auth.ts` owns the Auth0 client (refresh tokens, localstorage
cache). After Auth0 login, the app fetches its own `CurrentUser` record from
the API, which carries the server-computed **`permissions`** list. The
`Permission` enum in that file mirrors the server's permission strings; UI
authorization is done with the derived `userCan(...)` store, plus
`userIsInCompany(...)` / `userIsEqual(...)` helpers. Pages must `await
parent()` in their `+page.ts` before using these stores (the user record
loads in the root layout).

Roles (Editor, Manager, Publisher, Admin, CommunityReviewer, Reviewer…) map to
permission sets on the server; the dashboard each role lands on differs (see
below).

## Route map

| Route | Purpose |
|---|---|
| `(dashboard)` | Role-specific landing dashboards (Editor / Manager / Publisher / CommunityReviewer), each with its own table columns — this is the "my work" queue driven by content assignments |
| `resources` | Resource search/list |
| `resources/[resourceContentId]` | **The content editor** — the core of the app (see below) |
| `projects` (+ `new`, `[projectId]`) | Project CRUD, progress tracking, per-project reporting |
| `users` | User and company management |
| `reporting` | Operational reports (charts/tables, CSV download) |
| `management-reports` | Higher-level/dynamic reports |
| `settings` | User/app settings |
| `help` | CMS help content (served from `HelpDocuments` in the DB) |

## The resource editor

`resources/[resourceContentId]` is where most of the complexity lives:

- **Tiptap editor** built on the shared `aquifer-tiptap` package (GitHub
  dependency), with app-specific wiring in `src/lib/components/tiptap/` and
  `editor/`. Editing the shared node types (Bible references, comments,
  footnotes) happens in the aquifer-tiptap repo, not here.
- **Side-by-side translation view**: source and target language versions with
  scroll syncing (`scrollSync` store, `ScrollSyncLockToggle`).
- **Diff rendering**: `TiptapDiffRenderer` + `htmldiff-ts` running in the
  `workers/html-differ.ts` web worker so large diffs don't block the UI.
- **AI features**: machine-translation drafts with rating
  (`MachineTranslationRating`), AI streaming content
  (`utils/ai-streaming-content.ts`) — backed by `Aquifer.AI` on the server.
- **Comments & mentions**: `components/comments`, `components/mentions`,
  `stores/comments.ts` — inline editorial discussion on content versions.
- **Workflow UI**: assignment (`UserSelector`), status transitions,
  translation/not-applicable handling (`TranslationSelector`,
  `NotApplicableReasonSelector`), and audit sidebars
  (`VersionStatusHistorySidebar`, `BibleReferencesSidebar`).
- **Auto-save/change tracking**: `utils/auto-save-store.ts` and
  `change-tracking-store.ts`.

The status transitions available here drive the content lifecycle documented
in
[aquifer-server's architecture.md](https://github.com/eten-tech/aquifer-server/blob/master/docs/architecture.md#content-lifecycle-draft--published).

## State, i18n, telemetry

- **State**: plain Svelte stores in `src/lib/stores/` (auth, projects,
  resources, resource editor, reporting). No external state library.
- **i18n**: `svelte-i18n` with locale JSON in `src/lib/i18n/locales/`. A
  custom eslint plugin (`eslint-plugin-svelte-translate-check`, also an
  eten-tech repo) fails the lint on unused translations — run the full
  `yarn lint` before pushing.
- **Telemetry**: Application Insights via `src/lib/logger.ts`;
  `hooks.client.ts` logs load-function errors to App Insights before showing
  `+error.svelte`.

## Deployment

Static build (`yarn build` → `build/`) deployed to Azure Static Web Apps by
GitHub Actions (see `.github/workflows/`), with build notifications via the
org's `github-action-slack-notify-build` action. `yarn
build-with-source-maps` exists for debugging production issues.

---
_Last verified: 2026-08-03_
