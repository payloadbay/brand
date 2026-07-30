# Generated brand assets

Do not edit files in this directory manually.

Distributed SVG, PNG, favicon, and palette files are generated from the canonical SVG sources and palette definition in [`../src/assets`](../src/assets). Change the canonical source or generator and regenerate the complete distribution instead of repairing an output file.

Run `bun run assets:generate` after changing a canonical source. CI runs `bun run assets:check` and rejects stale or manually edited outputs.

## Distribution layout

- `logo/` contains the original complete logo and five surface profiles generated from it. Derived profiles retain the original aspect ratio, scale the artwork to 75%, and center it with 12.5% relative padding. Rounded profiles use a 22% corner radius. Dark profiles use a navy (`#09182b`) background, turn the navy artwork white, and preserve the blue accent (`#156fde`).
- `mark/` contains the original standalone mark on its unchanged transparent canvas.
- `icon/` contains application-icon profiles generated from the standalone mark. They use 12.5% canvas padding; rounded profiles use a 22% corner radius. Dark profiles use navy (`#09182b`) backgrounds, turn the navy artwork white, and preserve the blue accent (`#156fde`).
- `favicon/` contains the light rounded icon as SVG, 16/32/48 pixel PNGs, and a multi-resolution ICO.
- `palette/brand/` contains generated SVG swatches for the three identity colors defined in `src/assets/brand-palette.json`. They support the Brand Guide and are not product UI tokens.

Every logo profile in `logo/` is distributed as SVG and as 512, 1024, and 2048 pixel-wide PNGs. Every icon profile in `icon/` is distributed as SVG and as 64, 128, 256, 512, and 1024 pixel PNGs. Generated outputs are kept separate from `src/assets` so the canonical editable sources cannot be confused with derived files.
