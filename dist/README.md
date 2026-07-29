# Generated brand assets

Do not edit files in this directory manually.

Distributed SVG, PNG, and favicon files are generated from the canonical SVG sources in [`../src/assets`](../src/assets). Change the canonical source or generator and regenerate the complete distribution instead of repairing an output file.

Run `bun run assets:generate` after changing a canonical source. CI runs `bun run assets:check` and rejects stale or manually edited outputs.
