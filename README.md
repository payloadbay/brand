# Payload Bay brand

Official product references and brand assets for [Payload Bay](https://payloadbay.dev).

> A safe landing place for every event.

> Receive instantly. Deliver reliably.

## Brand assets

Payload Bay currently provides two canonical SVG sources:

- [`payloadbay-logo.svg`](src/assets/payloadbay-logo.svg) is the complete logo: the mark together with the Payload Bay wordmark.
- [`payloadbay-mark.svg`](src/assets/payloadbay-mark.svg) is the standalone visual mark without text.

Edit only the canonical SVG files in [`src/assets`](src/assets). Files in [`dist`](dist) are generated distributions and must not be edited manually.

Regenerate and validate the distributed SVG, PNG, and favicon files after changing a canonical source:

```bash
bun install
bun run assets:generate
bun run assets:check
```

The generated distribution includes logo PNGs at 512, 1024, and 2048 pixels wide; square mark PNGs at 64, 128, 256, 512, and 1024 pixels; application-icon variants; 16, 32, and 48 pixel favicon PNGs; a multi-resolution `favicon.ico`; and sanitized SVG copies.

### Application icon variants

The standalone mark remains available unchanged on a transparent canvas in [`dist/mark`](dist/mark). Additional application-ready variants are generated from that same canonical mark in [`dist/icon`](dist/icon):

| Variant | Background | Shape | Primary artwork |
| --- | --- | --- | --- |
| Original mark | Transparent | Original canvas | Navy and blue |
| Transparent padded | Transparent | Square canvas with 12.5% padding | Navy and blue |
| Light square | White | Square | Navy and blue |
| Light rounded | White | 22% corner radius | Navy and blue |
| Dark square | Navy | Square | White and blue |
| Dark rounded | Navy | 22% corner radius | White and blue |

Each generated icon variant is available as SVG and as 64, 128, 256, 512, and 1024 pixel PNGs. The favicon package uses the light rounded variant so it remains legible and intentional on browser surfaces that do not provide a predictable background.

## Product references

- [`PRODUCT.md`](PRODUCT.md) describes the product purpose, audience, brand personality, and product context exported by the theme builder.
- [`DESIGN.md`](DESIGN.md) is the theme builder's design reference for colors, typography, spacing, shapes, elevation, and UI guidance.

These reference exports intentionally retain their original structure, including the embedded SVG data in `PRODUCT.md`.

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before changing the brand sources. General Payload Bay contribution rules also apply.

## Licensing and trademarks

Licensing and trademark terms for the Payload Bay name and visual identity have not yet been published. Do not assume that a software license grants permission to use the Payload Bay name, logo, or mark.
