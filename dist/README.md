# Generated brand assets

Do not edit files in this directory manually.

Distributed SVG, PNG, and favicon files are generated from the canonical SVG sources in [`../src/assets`](../src/assets). Change the canonical source or generator and regenerate the complete distribution instead of repairing an output file.

Run `bun run assets:generate` after changing a canonical source. CI runs `bun run assets:check` and rejects stale or manually edited outputs.

## Distribution layout

- `logo/` contains the complete mark and wordmark.
- `mark/` contains the original standalone mark on its unchanged transparent canvas.
- `icon/` contains application-icon profiles generated from the standalone mark. They use 12.5% canvas padding; rounded profiles use a 22% corner radius. Dark profiles use navy (`#09182b`) backgrounds, turn the navy artwork white, and preserve the blue accent (`#156fde`).
- `favicon/` contains the light rounded icon as SVG, 16/32/48 pixel PNGs, and a multi-resolution ICO.

Every icon profile in `icon/` is distributed as SVG and as 64, 128, 256, 512, and 1024 pixel PNGs. Generated outputs are kept separate from `src/assets` so the canonical editable sources cannot be confused with derived files.
