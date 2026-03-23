import { writeFileSync } from "fs";
import type { ExcalidrawElement, ExcalidrawFile, Theme } from "../types/index.js";
import { preflightValidate } from "../validator/preflight.js";
import { getViewBackground } from "../templates/themes.js";

export function buildExcalidrawFile(
  elements: ExcalidrawElement[],
  theme: Theme
): ExcalidrawFile {
  return {
    type: "excalidraw",
    version: 2,
    source: "excalidraw-gen",
    elements,
    appState: {
      gridSize: 20,
      viewBackgroundColor: getViewBackground(theme),
    },
    files: {},
  };
}

export function exportToFile(
  elements: ExcalidrawElement[],
  theme: Theme,
  outputPath: string
): void {
  preflightValidate(elements);
  const file = buildExcalidrawFile(elements, theme);
  const json = JSON.stringify(file, null, 2);
  writeFileSync(outputPath, json, "utf-8");
}

export function exportToStdout(
  elements: ExcalidrawElement[],
  theme: Theme
): void {
  preflightValidate(elements);
  const file = buildExcalidrawFile(elements, theme);
  process.stdout.write(JSON.stringify(file, null, 2) + "\n");
}
