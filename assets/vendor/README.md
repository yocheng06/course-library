# JSON5

`json5.mjs` is the unmodified ESM distribution of JSON5 2.2.3 from
https://github.com/json5/json5, licensed under MIT (see `json5.LICENSE.md`).

The batch importer uses `parse` to read data literals, never `eval` or executable
JavaScript. No CDN or runtime package installation is required.

To refresh the vendored files after updating the pinned development dependency:

```sh
npm ci
cp node_modules/json5/dist/index.mjs assets/vendor/json5.mjs
cp node_modules/json5/LICENSE.md assets/vendor/json5.LICENSE.md
```
