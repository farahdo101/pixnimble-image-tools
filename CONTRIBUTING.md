# Contributing

Bug reports, small fixes and focused utility improvements are welcome. For a larger change, open an issue to describe the problem and proposed API before implementing it.

1. Use Node.js 22 or newer.
2. Run `npm start` and open the demo at http://127.0.0.1:4174/demo/.
3. Add a regression test when changing processing behavior.
4. Run `npm run check`; follow [browser verification](test/BROWSER.md) for browser changes.
5. Describe the behavior, limits and validation in your pull request.

Keep runtime dependencies at zero. Keep pure utilities independent of DOM APIs. Avoid uploads, telemetry, external fonts and third-party scripts in the demo. Do not commit private images, credentials, deployment configuration or generated test results. Use synthetic test images or properly licensed fixtures.

Contributions are made under the repository's MIT license. The public scope is small developer utilities and examples; production-site infrastructure is outside this repository.
