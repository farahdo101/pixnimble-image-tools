# Browser verification

The regular test suite has no dependencies. The optional browser suite uses Playwright for a real Chromium session and creates its own synthetic PNG fixture.

From the repository root:

```sh
npm install --no-save --package-lock=false @playwright/test
npx playwright install chromium
node test/browser.mjs
```

If Google Chrome is already installed, use it instead of downloading Chromium:

```sh
PLAYWRIGHT_CHANNEL=chrome node test/browser.mjs
```

The test starts its own local server on port 4175. Override with `BROWSER_TEST_PORT` if needed. Screenshots are saved under ignored `test-results/`.

Coverage includes downloaded output, fit/cover/stretch dimensions, all three encoders, transparent output, JPEG white background, browser-decoder fallback, unsupported encoder rejection, damaged input, stale preview cleanup, signature detection despite a misleading filename, dimension calculation, mobile width, outbound requests and static-server restrictions.

Also manually check keyboard focus, labels, readable contrast, and the layout on a narrow viewport when changing the interface. Browser implementations can differ; passing Chromium tests does not certify every browser.
