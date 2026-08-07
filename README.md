# Content Manager Web

The admin CMS for the [Aquifer](https://aquifer.bible) platform. Internal
users and translation companies use it to create, edit, review, and publish
resource content, and to manage projects, users, and reporting. It's a
SvelteKit SPA backed by `Aquifer.API` in the
[aquifer-server](https://github.com/eten-tech/aquifer-server) repo — see the
[ecosystem overview](https://github.com/eten-tech/aquifer-server/blob/master/docs/ecosystem.md)
for how it fits with the other apps.

## Quickstart

```bash
# 1. Install dependencies
yarn install

# 2. Select a config (writes the root .env)
yarn use-config local   # talk to a locally-running Aquifer.API
# yarn use-config qa    # talk to the QA environment

# 3. Run
yarn dev -- --open
```

Available configs are the `config/.env.*` files (`local`, `qa`, `prod`).
To run against a local API, set up
[aquifer-server](https://github.com/eten-tech/aquifer-server) first.

## Lint and test

```bash
yarn lint   # prettier + eslint + unused-translation check + svelte-check
yarn test   # vitest
```

## Documentation

| Doc | What's in it |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Config system, API/auth/permissions model, route map, the resource editor, deployment |
| [aquifer-server docs](https://github.com/eten-tech/aquifer-server/tree/master/docs) | Ecosystem map, server architecture, and the content lifecycle this app drives |
