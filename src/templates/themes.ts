import type { Theme, TemplateDefinition, TemplateNodeDef } from "../types/index.js";

interface ThemeColors {
  /** Override backgroundColor for all nodes */
  backgroundTint?: (base: string) => string;
  /** Override strokeColor for all nodes */
  strokeTint?: (base: string) => string;
  viewBackgroundColor: string;
}

const PASTEL_LIGHTEN: Record<string, string> = {
  "#d0bfff": "#ede0ff",
  "#b2f2bb": "#d8f5df",
  "#a5d8ff": "#d0ecff",
  "#fff3bf": "#fffbe0",
  "#ffe8cc": "#fff4e5",
  "#ffec99": "#fff5cc",
  "#ffa8a8": "#ffd4d4",
  "#ffc9c9": "#ffe4e4",
  "#e599f7": "#f3d4fb",
  "#e7f5ff": "#f0f9ff",
  "#fff0f6": "#ffe0ef",
  "#ffd8a8": "#ffedd0",
  "#e3fafc": "#f0feff",
  "#d3f9d8": "#e8fceb",
  "#dee2e6": "#f1f3f5",
  "#f8f9fa": "#ffffff",
};

const DARK_BG: Record<string, string> = {
  "#d0bfff": "#3d2b70",
  "#b2f2bb": "#1a4a26",
  "#a5d8ff": "#1a3d5c",
  "#fff3bf": "#4a3d00",
  "#ffe8cc": "#4a2e00",
  "#ffec99": "#4a3800",
  "#ffa8a8": "#5c1a1a",
  "#ffc9c9": "#5c2020",
  "#e599f7": "#4a1a5c",
  "#e7f5ff": "#0a2040",
  "#fff0f6": "#3d0a20",
  "#ffd8a8": "#4a2800",
  "#e3fafc": "#0a3a40",
  "#d3f9d8": "#0a3010",
  "#dee2e6": "#2a2a2a",
  "#f8f9fa": "#1a1a1a",
  "transparent": "transparent",
};

const DARK_STROKE: Record<string, string> = {
  "#7048e8": "#c4a3ff",
  "#2f9e44": "#74e88e",
  "#1971c2": "#74c0fc",
  "#fab005": "#ffd43b",
  "#fd7e14": "#ffa94d",
  "#f08c00": "#ffc94d",
  "#c92a2a": "#ff8787",
  "#e03131": "#ffa8a8",
  "#9c36b5": "#da77f2",
  "#c2255c": "#f783ac",
  "#e8590c": "#ffa94d",
  "#0c8599": "#66d9e8",
  "#40c057": "#8ce99a",
  "#495057": "#adb5bd",
};

function applyTheme(def: TemplateNodeDef, theme: Theme): TemplateNodeDef {
  if (theme === "default") return def;

  const bgMap = theme === "pastel" ? PASTEL_LIGHTEN : DARK_BG;
  const strokeMap = theme === "dark" ? DARK_STROKE : undefined;

  const bg = bgMap[def.style.backgroundColor] ?? def.style.backgroundColor;
  const stroke = strokeMap
    ? (strokeMap[def.style.strokeColor] ?? def.style.strokeColor)
    : def.style.strokeColor;

  return {
    ...def,
    style: { ...def.style, backgroundColor: bg, strokeColor: stroke },
  };
}

export function applyThemeToTemplate(
  template: TemplateDefinition,
  theme: Theme
): TemplateDefinition {
  if (theme === "default") return template;

  const nodes: Record<string, TemplateNodeDef> = {};
  for (const [key, def] of Object.entries(template.nodes)) {
    nodes[key] = applyTheme(def, theme);
  }
  return {
    ...template,
    nodes,
    defaultNode: applyTheme(template.defaultNode, theme),
  };
}

export function getViewBackground(theme: Theme): string {
  if (theme === "dark") return "#1a1a2e";
  return "#ffffff";
}
