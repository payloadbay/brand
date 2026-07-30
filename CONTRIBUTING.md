# Contributing to the Payload Bay brand

The organization-wide [Payload Bay contribution guidelines](https://github.com/payloadbay/.github/blob/master/CONTRIBUTING.md) apply to this repository. The rules below additionally cover brand assets and theme-builder references.

## Brand asset changes

Only edit the canonical SVG source files in [`src/assets`](src/assets):

```text
src/assets/payloadbay-logo.svg
src/assets/payloadbay-mark.svg
```

Do not manually create, edit, optimize, or replace files in `dist/`. All SVG, PNG, logo surface variants, application-icon variants, and favicon files placed there are generated from the canonical sources. New variant geometry, backgrounds, or color transformations belong in the generator; do not add a second manually maintained SVG source for a derived variant. After changing a source SVG or the generator, use the repository's asset-generation command and commit the change together with the resulting generated files.

Regenerate and validate the distribution after changing a source:

```bash
bun run assets:generate
bun run assets:check
```

When changing a canonical SVG:

- preserve the intended proportions and geometry;
- do not reconstruct the wordmark using an installed font;
- do not change colors, spacing, or composition without documenting the design decision;
- do not add scripts, event handlers, external images, external fonts, or network references;
- include a clear before-and-after preview in the pull request; and
- verify both the logo and standalone mark at their intended sizes.

Generated output must be fixed by changing its source or generator and regenerating it. Never repair an individual PNG, ICO, or generated SVG by hand.

## Theme-builder references

`PRODUCT.md` and `DESIGN.md` are reference exports from the theme builder. Preserve their exported structure when updating them and explain which theme-builder changes produced the update.

The SVG data embedded in `PRODUCT.md` is retained as part of that reference export. The directly usable files in `src/assets` must represent the same logo and mark.
