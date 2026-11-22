# Cubby

A custom skin for the Decent Espresso machine, built on [Decaid](https://github.com/decentespresso/decaid). It includes live shot traces, shot history and ratings, a bean library, and profile favorites.

## Install on your tablet

1. Open **Decaid → Launcher → Skins → ⚙ → Install skin → GitHub Release**.
2. Enter `andreicstoica/decent-skin`. If prompted for an asset name, enter `decent-skin.zip`.
3. To update later, use **Skins → ⚙ → Check for updates** or enable automatic updates in Decaid.

For offline installation, download `decent-skin.zip` from [Releases](https://github.com/andreicstoica/decent-skin/releases), copy it to the tablet, and choose **Install skin → ZIP file**. No extraction is needed.

This skin uses Decaid's shared profile library. Profiles already in Decaid are available without reimporting. For profiles from the classic DE1 app, use **Decaid → Data → Import from de1app** first.

## Develop locally

```sh
npm ci
npm run dev
```

Run `npm test` for the fixture tests (Node 22+), and `npm run lint` before submitting changes.

The skin connects to Decaid on port `8080` of the same host. For a development gateway on another host, copy `.env.example` to `.env.local` and set `VITE_GATEWAY_URL`. Leave that override unset when building for distribution.

## Build an installable release

```sh
npm run build
(cd dist && zip -r ../decent-skin.zip .)
```

Attach the ZIP to a new GitHub release, keeping `decent-skin.zip` as the asset name across releases. Update `public/manifest.json` to match the release version.
