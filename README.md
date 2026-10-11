# Kindred OS website & downloads

The public home of [Kindred OS](https://kindredos.web.app): website files,
installation information, and verified OS downloads in [GitHub Releases](https://github.com/connorgentile113-png/Kindred-Website/releases/).

### Check out the License page to see up to date info on if you are eligible to use it

# Our full terms of service and policy can be found below:
[Terms](https://kindredos.web.app/tos) \
<br>
[Policy](https://kindredos.web.app/policy)

## Development

Run `python3 scripts/serve.py --port 8080` to serve the static website. There is
no build step. See [website checks](tests/README.md) for browser regression and
accessibility tests.

The website includes comfortable reading settings and an isolated practice area
at `/practice`. Appearance choices are stored in this browser when permitted;
practice notes are never saved to disk or sent anywhere.

The [desktop application source handoff](desktop/SOURCE.md) contains the publicly
released 0.5.2 source, recovered and checksum-verified, plus the unreleased 0.5.3
confidence improvements. The live website files remain in `public/`. Desktop
source changes do not update installed machines, release metadata, or the ISO.
