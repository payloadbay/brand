import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const sourceDirectory = join(root, "src", "assets");
const distributionDirectory = join(root, "dist");
const assets = {
  logo: { source: "payloadbay-logo.svg", viewBox: "0 0 4538 1000", widths: [512, 1024, 2048] },
  mark: { source: "payloadbay-mark.svg", viewBox: "0 0 1000 1000", widths: [64, 128, 256, 512, 1024] },
} as const;
const faviconWidths = [16, 32, 48] as const;
const iconWidths = [64, 128, 256, 512, 1024] as const;
const iconProfiles = [
  { name: "transparent-padded", background: null, rounded: false, inverse: false },
  { name: "light-square", background: "#ffffff", rounded: false, inverse: false },
  { name: "light-rounded", background: "#ffffff", rounded: true, inverse: false },
  { name: "dark-square", background: "#09182b", rounded: false, inverse: true },
  { name: "dark-rounded", background: "#09182b", rounded: true, inverse: true },
] as const;

type IconProfile = (typeof iconProfiles)[number];

const markViewBox = "0 0 1000 1000";
const markPadding = 125;
const markScale = 0.75;
const roundedRadius = 220;
const navy = "#09182b";
const accent = "#156fde";

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

function createIconSvg(mark: string, profile: IconProfile) {
  let contents = extractSvgContents(mark);
  if (profile.inverse) contents = contents.replace(/#09182b/gi, "#ffffff");

  const background = profile.background
    ? `<rect width="1000" height="1000"${profile.rounded ? ` rx="${roundedRadius}" ry="${roundedRadius}"` : ""} fill="${profile.background}"/>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${markViewBox}">${background}<g transform="translate(${markPadding} ${markPadding}) scale(${markScale})">${contents}</g></svg>\n`;

  validateSource(svg, `${profile.name}.svg`, markViewBox);
  if (!svg.toLowerCase().includes(accent)) {
    throw new Error(`${profile.name}.svg does not preserve the accent color`);
  }
  if (profile.inverse && (contents.toLowerCase().includes(navy) || !contents.toLowerCase().includes("#ffffff"))) {
    throw new Error(`${profile.name}.svg does not invert the primary artwork`);
  }
  return svg;
}

async function renderPng(svg: string, width: number, output: string) {
  const rendered = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: false },
  }).render();
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

function validateRenderedIcon(profile: IconProfile, width: number, pixels: Buffer) {
  const corner =
    profile.background && !profile.rounded
      ? profile.background === navy
        ? [9, 24, 43, 255]
        : [255, 255, 255, 255]
      : [0, 0, 0, 0];
  assertPixel(pixelAt(pixels, 0), corner, `${profile.name}-${width}.png has an unexpected corner pixel`);
  if (width >= 64) {
    assertContainsPixel(
      pixels,
      [21, 111, 222, 255],
      `${profile.name}-${width}.png does not preserve the accent color`,
    );
    assertContainsPixel(
      pixels,
      profile.inverse ? [255, 255, 255, 255] : [9, 24, 43, 255],
      `${profile.name}-${width}.png does not contain the expected primary artwork color`,
    );
  }
}

async function generate(outputRoot: string) {
  const logoDirectory = join(outputRoot, "logo");
  const markDirectory = join(outputRoot, "mark");
  const iconDirectory = join(outputRoot, "icon");
  const faviconDirectory = join(outputRoot, "favicon");
  await Promise.all(
    [logoDirectory, markDirectory, iconDirectory, faviconDirectory].map((directory) =>
      mkdir(directory, { recursive: true }),
    ),
  );
  const distributedSvgs = new Map<string, string>();

  for (const [kind, configuration] of Object.entries(assets)) {
    const source = await readFile(join(sourceDirectory, configuration.source), "utf8");
    validateSource(source, configuration.source, configuration.viewBox);
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
    validateRenderedIcon(iconProfiles[2], width, rendered.pixels);
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
    for (const directory of ["logo", "mark", "icon", "favicon"]) {
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
