# Kindred OS website & downloads

The public home of [Kindred OS](https://kindredos.web.app): website files,
installation information, and verified OS downloads in GitHub Releases.

This repository has a clean history and only the website's required assets.
No VM disks, credentials, OS build checkout, package manager dependencies,
prototype desktop, or Cloud Functions are included. Release binaries are attached
to Releases, not committed into Git history. The installer and application archive
contain the OS payload needed to install or update Kindred.

## Preview

```sh
python3 scripts/serve.py
```

Open http://127.0.0.1:8080. No npm installation or build step is needed.

## Deploy to Firebase Hosting

```sh
KINDRED_FIREBASE_CREDENTIALS=/absolute/path/outside-this-repo/service-account.json bash scripts/deploy.sh
```

The credential file stays outside this repository. The deploy script uploads only
`public/` to the existing `kindredos` Firebase project. It does not deploy functions.

## Release handoff

Attach the tested ISO, application archive and their SHA-256 files to a public
versioned GitHub release. Verify the anonymous download URLs and file hashes before
updating `public/release.json` and `public/updates/version.json`, committing, and
deploying. Existing Kindred 0.5.1 and earlier users need a one-time manual app
upgrade to accept the public download repository; see the website's update section.

The OS build and test workflow lives in the separate build repository. The updater
keeps its fixed-origin, version and SHA-256 checks. HTTPS metadata is not signed;
full power-loss-safe filesystem transactions are not implemented.

## Assets

`public/assets/` contains two real Kindred screenshots and the SVG brand mark.
The site uses local fonts, no third-party analytics, and no external font service.
`/install` and `/guide` use Firebase clean URLs; `/updates/version` rewrites to the
static update manifest. There is no live OS preview.
