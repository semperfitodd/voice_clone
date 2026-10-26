#!/usr/bin/env node
/** Export all diagrams/*.excalidraw to exports/*.png and exports/*.svg via @excalidraw/utils + Playwright. */
const fs = require("fs");
const path = require("path");
const { firefox } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const DIAGRAMS_DIR = path.join(ROOT, "diagrams");
const EXPORTS_DIR = path.join(ROOT, "exports");

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script src="https://unpkg.com/@excalidraw/utils@0.1.2/dist/excalidraw-utils.min.js"></script>
</body></html>`;

function fixSvgTextY(svg) {
  return svg.replace(/<g transform="[^"]*"[^>]*>[\s\S]*?<\/g>/g, (group) => {
    if (!group.includes('y="NaN"')) {
      return group;
    }

    let lineIndex = 0;
    return group.replace(/<text[\s\S]*?<\/text>/g, (textEl) => {
      if (!textEl.includes('y="NaN"')) {
        return textEl;
      }

      const sizeMatch = textEl.match(/font-size="(\d+)px"/);
      const fontSize = sizeMatch ? Number(sizeMatch[1]) : 16;
      const y = Math.round(fontSize * (1 + lineIndex * 1.25));
      lineIndex += 1;
      return textEl.replace(/y="NaN"/, `y="${y}"`);
    });
  });
}

async function exportDiagram(page, inputPath, baseName) {
  const scene = JSON.parse(fs.readFileSync(inputPath, "utf8"));

  let svg = await page.evaluate(async (sceneData) => {
    const el = await ExcalidrawUtils.exportToSvg({
      elements: sceneData.elements,
      appState: {
        ...sceneData.appState,
        exportBackground: true,
        exportWithDarkMode: false,
      },
      files: sceneData.files || {},
    });
    return el.outerHTML;
  }, scene);

  svg = fixSvgTextY(svg);

  const svgPath = path.join(EXPORTS_DIR, `${baseName}.svg`);
  fs.writeFileSync(svgPath, svg, "utf8");

  await page.setContent(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#fff;}</style></head><body>${svg}</body></html>`,
    { waitUntil: "networkidle" },
  );

  const svgEl = await page.$("svg");
  const pngBuffer = await svgEl.screenshot({ type: "png", omitBackground: false });
  const pngPath = path.join(EXPORTS_DIR, `${baseName}.png`);
  fs.writeFileSync(pngPath, pngBuffer);

  console.log(`Wrote ${svgPath} (${fs.statSync(svgPath).size} bytes)`);
  console.log(`Wrote ${pngPath} (${fs.statSync(pngPath).size} bytes)`);
}

(async () => {
  if (!fs.existsSync(DIAGRAMS_DIR)) {
    console.error(`Missing diagrams directory: ${DIAGRAMS_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(EXPORTS_DIR, { recursive: true });

  const sources = fs
    .readdirSync(DIAGRAMS_DIR)
    .filter((f) => f.endsWith(".excalidraw"))
    .sort();

  if (sources.length === 0) {
    console.error(`No .excalidraw files in ${DIAGRAMS_DIR}`);
    process.exit(1);
  }

  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof ExcalidrawUtils !== "undefined");

  for (const file of sources) {
    const baseName = path.basename(file, ".excalidraw");
    await exportDiagram(page, path.join(DIAGRAMS_DIR, file), baseName);
  }

  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
