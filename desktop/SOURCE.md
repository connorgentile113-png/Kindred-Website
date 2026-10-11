# Desktop source handoff

This directory was recovered from the public Kindred 0.5.2 application update:
https://github.com/connorgentile113-png/Kindred-Website/releases/download/v0.5.2/kindred-update-0.5.2.tar.gz

Verified archive SHA-256:
`725220fecd901989b9d0ab4e15ae4d33d1be3eb58e9118ca01bdf75b3475ca1f`

The release archive explicitly distributes these application files. The private
`CE-CODE-official/Kindred-OS` repository was unavailable to this development task.
The source is retained here so the requested desktop changes are reviewable and
can be built and tested, without altering the existing published release.

The confidence improvements are in `native/main.js` and `native/practice.mjs`:
an introduction reachable from Home, isolated practice notes, confirmation before
removal, and immediate Undo with persistent restoration of real documents.

Run application checks from this directory using the commands in README.md.
Never run installer, disk-flashing, shutdown, deployment, or release publication
scripts as part of testing. Native smoke tests isolate storage and simulate power.
The outer `public/` directory is the canonical live website; `web/` here is the
original OS archive's bundled website and compatibility prototype.

This source change does not update installed machines or replace an ISO. A future
application release needs a new version, verified artifacts, and a deliberate
update-channel publication. Existing release metadata remains accurate.

The recovered source is now version **0.5.3 (unreleased)**. A local update archive
can be built with `python3 scripts/build-update.py`. The generated manifest is
ignored and is not the published update channel. Only deliberate release
publication should advance the website’s `public/updates/version.json`.
