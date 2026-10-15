import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const sourceDirectory = join(root, "src", "assets");
const distributionDirectory = join(root, "dist");
type BrandColor = { id: string; name: string; value: string };
type BrandPalette = { colors: BrandColor[] };

const brandPalette = JSON.parse(
  await readFile(join(sourceDirectory, "brand-palette.json"), "utf8"),
) as BrandPalette;
if (!Array.isArray(brandPalette.colors)) {
  throw new Error("brand-palette.json must contain a colors array");
}
if (brandPalette.colors.some((color) => !color.id || !color.name || !/^#[0-9a-f]{6}$/i.test(color.value))) {
  throw new Error("brand-palette.json contains an invalid color");
}
const paletteById = new Map(brandPalette.colors.map((color) => [color.id, color]));
if (paletteById.size !== brandPalette.colors.length) {
  throw new Error("brand-palette.json contains duplicate color IDs");
}
function paletteValue(id: string) {
  const color = paletteById.get(id);
  if (!color || !/^#[0-9a-f]{6}$/i.test(color.value)) {
    throw new Error(`brand-palette.json has no valid ${id} color`);
  }
  return color.value.toLowerCase();
}

const navy = paletteValue("logo-navy");
const accent = paletteValue("accent-blue");
const white = paletteValue("white");
const assets = {
  logo: { source: "payloadbay-logo.svg", viewBox: "0 0 4538 1000", widths: [512, 1024, 2048] },
  mark: { source: "payloadbay-mark.svg", viewBox: "0 0 1000 1000", widths: [64, 128, 256, 512, 1024] },
} as const;
const faviconWidths = [16, 32, 48] as const;
const iconWidths = [64, 128, 256, 512, 1024] as const;
const iconProfiles = [
  { name: "transparent", background: null, padded: false, rounded: false, inverse: false },
  { name: "dark-transparent", background: null, padded: false, rounded: false, inverse: true },
  { name: "transparent-padded", background: null, padded: true, rounded: false, inverse: false },
  { name: "dark-transparent-padded", background: null, padded: true, rounded: false, inverse: true },
  { name: "light-square", background: white, padded: true, rounded: false, inverse: false },
  { name: "light-rounded", background: white, padded: true, rounded: true, inverse: false },
  { name: "dark-square", background: navy, padded: true, rounded: false, inverse: true },
  { name: "dark-rounded", background: navy, padded: true, rounded: true, inverse: true },
] as const;
const logoProfiles = [
  { name: "transparent", background: null, padded: false, rounded: false, inverse: false },
  { name: "dark-transparent", background: null, padded: false, rounded: false, inverse: true },
  { name: "transparent-padded", background: null, padded: true, rounded: false, inverse: false },
  { name: "dark-transparent-padded", background: null, padded: true, rounded: false, inverse: true },
  { name: "light-panel", background: white, padded: true, rounded: false, inverse: false },
  { name: "light-rounded", background: white, padded: true, rounded: true, inverse: false },
  { name: "dark-panel", background: navy, padded: true, rounded: false, inverse: true },
  { name: "dark-rounded", background: navy, padded: true, rounded: true, inverse: true },
] as const;

type IconProfile = (typeof iconProfiles)[number];
type LogoProfile = (typeof logoProfiles)[number];

const logoViewBox = "0 0 4538 1000";
const logoCanvasWidth = 4538;
const logoCanvasHeight = 1000;
const logoOffsetX = 567.25;
const logoOffsetY = 125;
const logoScale = 0.75;
const markViewBox = "0 0 1000 1000";
const markPadding = 125;
const markScale = 0.75;
const roundedRadius = 220;
const paletteViewBox = "0 0 240 240";
const paletteWidth = 240;
const paletteHeight = 240;

function validateSource(svg: string, name: string, expectedViewBox: string) {
  if (!svg.includes("<svg") || !svg.includes(`viewBox="${expectedViewBox}"`)) {
    throw new Error(`${name} does not have the expected SVG viewBox`);
  }
  const forbidden = [
    /<script\b/i,
    /<foreignObject\b/i,
    /\son[a-z]+\s*=/i,
    /<(?:image|use)\b[^>]*(?:href|xlink:href)\s*=/i,
    /url\s*\(\s*["']?(?:https?:|\/\/)/i,
  ];
  if (forbidden.some((pattern) => pattern.test(svg))) {
    throw new Error(`${name} contains active or externally loaded SVG content`);
  }
}

function createPaletteSwatch(color: BrandColor) {
  const stroke = color.id === "white" ? ` stroke="${navy}" stroke-opacity="0.16" stroke-width="2"` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${paletteViewBox}"><rect x="4" y="4" width="232" height="232" rx="24" ry="24" fill="${color.value}"${stroke}/></svg>\n`;
  validateSource(svg, `${color.id}.svg`, paletteViewBox);
  return svg;
}

function createDistributedSvg(svg: string) {
  return `${svg
    .replace(/^<\?xml[^>]*>\s*/i, "")
    .replace(/^<!DOCTYPE[^>]*>\s*/i, "")
    .replace(/\s+xmlns:xlink="[^"]*"/i, "")
    .replace(/\s+xmlns:serif="[^"]*"/i, "")
    .replace(/\s+xml:space="preserve"/i, "")
    .trim()}\n`;
}

function extractSvgContents(svg: string) {
  const match = svg.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>\s*$/i);
  if (!match) throw new Error("Could not extract the mark SVG contents");
  return match[1].trim();
}

function validateBrandArtworkColors(svg: string, name: string) {
  const normalized = svg.toLowerCase();
  if (!normalized.includes(navy) || !normalized.includes(accent)) {
    throw new Error(`${name} does not use the canonical logo navy and accent blue`);
  }
}

function createIconSvg(mark: string, profile: IconProfile) {
  let contents = extractSvgContents(mark);
  if (profile.inverse) contents = contents.replace(new RegExp(navy, "gi"), white);

  const background = profile.background
    ? `<rect width="1000" height="1000"${profile.rounded ? ` rx="${roundedRadius}" ry="${roundedRadius}"` : ""} fill="${profile.background}"/>`
    : "";
  const artwork = profile.padded
    ? `<g transform="translate(${markPadding} ${markPadding}) scale(${markScale})">${contents}</g>`
    : contents;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${markViewBox}">${background}${artwork}</svg>\n`;

  validateSource(svg, `${profile.name}.svg`, markViewBox);
  if (!svg.toLowerCase().includes(accent)) {
    throw new Error(`${profile.name}.svg does not preserve the accent color`);
  }
  if (profile.inverse && (contents.toLowerCase().includes(navy) || !contents.toLowerCase().includes(white))) {
    throw new Error(`${profile.name}.svg does not invert the primary artwork`);
  }
  return svg;
}

function createLogoSvg(logo: string, profile: LogoProfile) {
  let contents = extractSvgContents(logo);
  if (profile.inverse) contents = contents.replace(new RegExp(navy, "gi"), white);

  const background = profile.background
    ? `<rect width="${logoCanvasWidth}" height="${logoCanvasHeight}"${profile.rounded ? ` rx="${roundedRadius}" ry="${roundedRadius}"` : ""} fill="${profile.background}"/>`
    : "";
  const artwork = profile.padded
    ? `<g transform="translate(${logoOffsetX} ${logoOffsetY}) scale(${logoScale})">${contents}</g>`
    : contents;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${logoViewBox}">${background}${artwork}</svg>\n`;

  validateSource(svg, `${profile.name}.svg`, logoViewBox);
  if (!svg.toLowerCase().includes(accent)) {
    throw new Error(`${profile.name}.svg does not preserve the accent color`);
  }
  if (profile.inverse && (contents.toLowerCase().includes(navy) || !contents.toLowerCase().includes(white))) {
    throw new Error(`${profile.name}.svg does not invert the primary artwork`);
  }
  return svg;
}

function renderSvg(svg: string, width: number) {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: false },
  }).render();
}

async function renderPng(svg: string, width: number, output: string) {
  const rendered = renderSvg(svg, width);
  await writeFile(output, rendered.asPng());
  return { width: rendered.width, height: rendered.height, pixels: rendered.pixels };
}

function pixelAt(pixels: Buffer, index: number) {
  return [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]];
}

function assertPixel(actual: number[], expected: number[], message: string) {
  if (!actual.every((channel, index) => channel === expected[index])) {
    throw new Error(`${message}: expected ${expected.join(",")}, got ${actual.join(",")}`);
  }
}

function assertContainsPixel(pixels: Buffer, expected: number[], message: string) {
  for (let index = 0; index < pixels.length; index += 4) {
    if (expected.every((channel, offset) => Math.abs(pixels[index + offset] - channel) <= (offset === 3 ? 5 : 12))) return;
  }
  throw new Error(`${message}: ${expected.join(",")} was not found`);
}

function hexToRgba(value: string) {
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
    255,
  ];
}

const navyRgba = hexToRgba(navy);
const accentRgba = hexToRgba(accent);
const whiteRgba = hexToRgba(white);

function validatePaletteSwatch(color: BrandColor, rendered: { width: number; height: number; pixels: Buffer }) {
  if (rendered.width !== paletteWidth || rendered.height !== paletteHeight) {
    throw new Error(`${color.id}.svg has unexpected rendered dimensions`);
  }
  assertPixel(
    pixelAt(rendered.pixels, (Math.floor(rendered.height / 2) * rendered.width + Math.floor(rendered.width / 2)) * 4),
    hexToRgba(color.value),
    `${color.id}.svg has an unexpected center pixel`,
  );
}

function validateRenderedIcon(profile: IconProfile, width: number, pixels: Buffer) {
  const corner =
    profile.background && !profile.rounded
      ? profile.background === navy
        ? navyRgba
        : whiteRgba
      : [0, 0, 0, 0];
  assertPixel(pixelAt(pixels, 0), corner, `${profile.name}-${width}.png has an unexpected corner pixel`);
  if (width >= 64) {
    assertContainsPixel(
      pixels,
      accentRgba,
      `${profile.name}-${width}.png does not preserve the accent color`,
    );
    assertContainsPixel(
      pixels,
      profile.inverse ? whiteRgba : navyRgba,
      `${profile.name}-${width}.png does not contain the expected primary artwork color`,
    );
  }
}

function validateRenderedLogo(profile: LogoProfile, width: number, pixels: Buffer) {
  const corner =
    profile.background && !profile.rounded
      ? profile.background === navy
        ? navyRgba
        : whiteRgba
      : [0, 0, 0, 0];
  assertPixel(pixelAt(pixels, 0), corner, `${profile.name}-${width}w.png has an unexpected corner pixel`);
  assertContainsPixel(
    pixels,
    accentRgba,
    `${profile.name}-${width}w.png does not preserve the accent color`,
  );
  assertContainsPixel(
    pixels,
    profile.inverse ? whiteRgba : navyRgba,
    `${profile.name}-${width}w.png does not contain the expected primary artwork color`,
  );
}

async function generate(outputRoot: string) {
  const logoDirectory = join(outputRoot, "logo");
  const markDirectory = join(outputRoot, "mark");
  const iconDirectory = join(outputRoot, "icon");
  const faviconDirectory = join(outputRoot, "favicon");
  const paletteDirectory = join(outputRoot, "palette", "brand");
  await Promise.all(
    [logoDirectory, markDirectory, iconDirectory, faviconDirectory, paletteDirectory].map((directory) =>
      mkdir(directory, { recursive: true }),
    ),
  );
  const distributedSvgs = new Map<string, string>();

  for (const [kind, configuration] of Object.entries(assets)) {
    const source = await readFile(join(sourceDirectory, configuration.source), "utf8");
    validateSource(source, configuration.source, configuration.viewBox);
    validateBrandArtworkColors(source, configuration.source);
    const distributed = createDistributedSvg(source);
    distributedSvgs.set(kind, distributed);
    const targetDirectory = kind === "logo" ? logoDirectory : markDirectory;
    await writeFile(join(targetDirectory, configuration.source), distributed);
    for (const width of configuration.widths) {
      const suffix = kind === "logo" ? `${width}w` : `${width}`;
      const output = join(targetDirectory, `${basename(configuration.source, ".svg")}-${suffix}.png`);
      const dimensions = await renderPng(distributed, width, output);
      if (dimensions.width !== width || (kind === "mark" && dimensions.height !== width)) {
        throw new Error(`Unexpected dimensions for ${relative(outputRoot, output)}`);
      }
    }
  }

  const mark = distributedSvgs.get("mark");
  if (!mark) throw new Error("Mark source was not generated");
  const logo = distributedSvgs.get("logo");
  if (!logo) throw new Error("Logo source was not generated");

  for (const profile of logoProfiles) {
    const variant = createLogoSvg(logo, profile);
    await writeFile(join(logoDirectory, `payloadbay-logo-${profile.name}.svg`), variant);
    for (const width of assets.logo.widths) {
      const output = join(logoDirectory, `payloadbay-logo-${profile.name}-${width}w.png`);
      const rendered = await renderPng(variant, width, output);
      const expectedHeight = Math.round((width * logoCanvasHeight) / logoCanvasWidth);
      if (rendered.width !== width || rendered.height !== expectedHeight) {
        throw new Error(`Unexpected dimensions for ${relative(outputRoot, output)}`);
      }
      validateRenderedLogo(profile, width, rendered.pixels);
    }
  }

  for (const color of brandPalette.colors) {
    const swatch = createPaletteSwatch(color);
    await writeFile(join(paletteDirectory, `${color.id}.svg`), swatch);
    validatePaletteSwatch(color, renderSvg(swatch, paletteWidth));
  }

  const generatedIcons = new Map<string, string>();
  for (const profile of iconProfiles) {
    const icon = createIconSvg(mark, profile);
    generatedIcons.set(profile.name, icon);
    await writeFile(join(iconDirectory, `payloadbay-icon-${profile.name}.svg`), icon);
    for (const width of iconWidths) {
      const output = join(iconDirectory, `payloadbay-icon-${profile.name}-${width}.png`);
      const rendered = await renderPng(icon, width, output);
      if (rendered.width !== width || rendered.height !== width) {
        throw new Error(`Unexpected dimensions for ${relative(outputRoot, output)}`);
      }
      validateRenderedIcon(profile, width, rendered.pixels);
    }
  }

  const favicon = generatedIcons.get("light-rounded");
  if (!favicon) throw new Error("Light rounded icon was not generated");
  await writeFile(join(faviconDirectory, "favicon.svg"), favicon);
  const faviconPngs: string[] = [];
  for (const width of faviconWidths) {
    const output = join(faviconDirectory, `favicon-${width}x${width}.png`);
    const rendered = await renderPng(favicon, width, output);
    if (rendered.width !== width || rendered.height !== width) {
      throw new Error(`Unexpected dimensions for ${relative(outputRoot, output)}`);
    }
    validateRenderedIcon(iconProfiles.find((profile) => profile.name === "light-rounded")!, width, rendered.pixels);
    faviconPngs.push(output);
  }
  await writeFile(join(faviconDirectory, "favicon.ico"), await pngToIco(faviconPngs));
}

async function listFiles(directory: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(join(directory, entry.name), path)));
    else if (entry.name !== "README.md") files.push(path);
  }
  return files.sort();
}

async function compareDirectories(expected: string, actual: string) {
  const [expectedFiles, actualFiles] = await Promise.all([listFiles(expected), listFiles(actual)]);
  if (JSON.stringify(expectedFiles) !== JSON.stringify(actualFiles)) {
    throw new Error("Generated asset file list is stale; run `bun run assets:generate`");
  }
  for (const file of expectedFiles) {
    const [expectedContents, actualContents] = await Promise.all([
      readFile(join(expected, file)),
      readFile(join(actual, file)),
    ]);
    if (!expectedContents.equals(actualContents)) {
      throw new Error(`${file} is stale; run \`bun run assets:generate\``);
    }
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode === "generate") {
    for (const directory of ["logo", "mark", "icon", "favicon", "palette"]) {
      await rm(join(distributionDirectory, directory), { recursive: true, force: true });
    }
    await generate(distributionDirectory);
    console.log("Generated brand assets in dist/.");
    return;
  }
  if (mode === "check") {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "payloadbay-brand-"));
    try {
      await generate(temporaryRoot);
      await compareDirectories(temporaryRoot, distributionDirectory);
      console.log("Generated brand assets are current.");
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
    return;
  }
  throw new Error("Usage: bun run scripts/assets.ts <generate|check>");
}

await main();
