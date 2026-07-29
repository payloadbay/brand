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

async function renderPng(svg: string, width: number, output: string) {
  const rendered = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: false },
  }).render();
  await writeFile(output, rendered.asPng());
  return { width: rendered.width, height: rendered.height };
}

async function generate(outputRoot: string) {
  const logoDirectory = join(outputRoot, "logo");
  const markDirectory = join(outputRoot, "mark");
  const faviconDirectory = join(outputRoot, "favicon");
  await Promise.all([logoDirectory, markDirectory, faviconDirectory].map((directory) => mkdir(directory, { recursive: true })));
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
  await writeFile(join(faviconDirectory, "favicon.svg"), mark);
  const faviconPngs: string[] = [];
  for (const width of faviconWidths) {
    const output = join(faviconDirectory, `favicon-${width}x${width}.png`);
    const dimensions = await renderPng(mark, width, output);
    if (dimensions.width !== width || dimensions.height !== width) {
      throw new Error(`Unexpected dimensions for ${relative(outputRoot, output)}`);
    }
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
    for (const directory of ["logo", "mark", "favicon"]) {
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
