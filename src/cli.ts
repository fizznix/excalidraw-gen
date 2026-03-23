#!/usr/bin/env node
import { readFileSync } from "fs";
import { Command } from "commander";
import { parse, ParseError } from "./parser/index.js";
import { validate } from "./validator/index.js";
import { normalize } from "./normalizer/index.js";
import { getTemplate, registerTemplate } from "./templates/index.js";
import { applyThemeToTemplate } from "./templates/themes.js";
import { runLayout, registerLayoutEngine } from "./layout/index.js";
import { render } from "./renderer/index.js";
import { exportToFile, exportToStdout } from "./exporter/index.js";
import { PreflightError } from "./validator/preflight.js";
import type { GenerateOptions, Theme, LayoutType } from "./types/index.js";

const program = new Command();

program
  .name("excalidraw-gen")
  .description("Generate Excalidraw-compatible JSON diagrams from structured input specs")
  .version("0.1.0");

program
  .command("generate <input>")
  .description("Generate an Excalidraw diagram from a JSON spec file")
  .option(
    "--template <name>",
    "Diagram template: flowchart | architecture",
    "flowchart"
  )
  .option(
    "--theme <name>",
    "Color theme: default | pastel | dark",
    "default"
  )
  .option(
    "--layout <type>",
    "Layout algorithm: dag | grid",
    "dag"
  )
  .option("--out <filepath>", "Output file path (default: stdout)")
  .option(
    "--no-deterministic",
    "Disable deterministic mode (enabled by default)"
  )
  .option(
    "--max-nodes <n>",
    "Maximum nodes allowed",
    (v) => parseInt(v, 10),
    200
  )
  .action(
    (
      inputPath: string,
      opts: {
        template: string;
        theme: string;
        layout: string;
        out?: string;
        deterministic: boolean;
        maxNodes: number;
      }
    ) => {
      const options: GenerateOptions = {
        template: opts.template as GenerateOptions["template"],
        theme: opts.theme as Theme,
        layout: opts.layout as LayoutType,
        out: opts.out,
        deterministic: opts.deterministic,
        maxNodes: opts.maxNodes,
      };

      try {
        // ── 1. Read input ──────────────────────────────────────────────────
        let inputContent: string;
        try {
          inputContent = readFileSync(inputPath, "utf-8");
        } catch {
          process.stderr.write(`Error: Cannot read file "${inputPath}"\n`);
          process.exit(1);
        }

        // ── 2. Parse ───────────────────────────────────────────────────────
        let diagram;
        try {
          diagram = parse(inputContent);
        } catch (err) {
          if (err instanceof ParseError) {
            process.stderr.write(`Parse error: ${err.message}\n`);
            process.exit(1);
          }
          throw err;
        }

        // ── 3. Validate (input) ────────────────────────────────────────────
        const { errors, warnings } = validate(diagram, { maxNodes: options.maxNodes });
        for (const warn of warnings) {
          process.stderr.write(`Warning: ${warn}\n`);
        }
        if (errors.length > 0) {
          for (const err of errors) {
            process.stderr.write(`Error: ${err}\n`);
          }
          process.exit(1);
        }

        // ── 4. Normalize ───────────────────────────────────────────────────
        const { diagram: normalDiagram, warnings: normWarnings } = normalize(diagram);
        for (const warn of normWarnings) {
          process.stderr.write(`Warning: ${warn}\n`);
        }

        // ── 5. Layout ──────────────────────────────────────────────────────
        const layoutNodes = runLayout(normalDiagram, options.layout);

        // ── 6. Template + Theme ────────────────────────────────────────────
        const baseTemplate = getTemplate(options.template);
        const template = applyThemeToTemplate(baseTemplate, options.theme);

        // ── 7. Render ──────────────────────────────────────────────────────
        const elements = render(normalDiagram, layoutNodes, template);

        // ── 8. Export ──────────────────────────────────────────────────────
        if (options.out) {
          exportToFile(elements, options.theme, options.out);
          process.stderr.write(`✓ Diagram written to ${options.out}\n`);
        } else {
          exportToStdout(elements, options.theme);
        }
      } catch (err) {
        if (err instanceof PreflightError) {
          process.stderr.write(`${err.message}\n`);
          process.exit(1);
        }
        if (err instanceof Error) {
          process.stderr.write(`Unexpected error: ${err.message}\n`);
        } else {
          process.stderr.write(`Unexpected error: ${String(err)}\n`);
        }
        process.exit(1);
      }
    }
  );

program.parse(process.argv);
