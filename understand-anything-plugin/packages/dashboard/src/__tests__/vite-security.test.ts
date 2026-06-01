import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readJsonFileWithLimit, readSourceFile } from "../../vite.config";

describe("vite security guards", () => {
  let tempDirs: string[] = [];
  let priorGraphDir: string | undefined;

  afterEach(() => {
    process.env.GRAPH_DIR = priorGraphDir;
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
    tempDirs = [];
    priorGraphDir = undefined;
  });

  it("rejects file-content requests whose realpath escapes the project root", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "ua-dashboard-project-"));
    const outsideRoot = mkdtempSync(join(tmpdir(), "ua-dashboard-outside-"));
    tempDirs.push(projectRoot, outsideRoot);
    priorGraphDir = process.env.GRAPH_DIR;

    mkdirSync(join(projectRoot, ".understand-anything"), { recursive: true });
    mkdirSync(join(projectRoot, "src"), { recursive: true });
    writeFileSync(
      join(projectRoot, ".understand-anything/knowledge-graph.json"),
      JSON.stringify({ nodes: [{ filePath: "src/link.ts" }] }),
      "utf-8",
    );

    const outsideFile = join(outsideRoot, "secret.ts");
    writeFileSync(outsideFile, "export const secret = true;\n", "utf-8");
    symlinkSync(outsideFile, join(projectRoot, "src/link.ts"));

    process.env.GRAPH_DIR = projectRoot;
    const result = readSourceFile(new URL("http://127.0.0.1/file-content.json?path=src/link.ts"));
    expect(result.statusCode).toBe(404);
    expect(result.payload).toEqual({ error: "File not found" });
  });

  it("rejects oversized JSON payloads before parsing", () => {
    const dir = mkdtempSync(join(tmpdir(), "ua-dashboard-json-"));
    tempDirs.push(dir);
    const jsonPath = join(dir, "oversized.json");
    writeFileSync(jsonPath, JSON.stringify({ blob: "x".repeat(1024) }), "utf-8");

    const result = readJsonFileWithLimit(jsonPath, 32);
    expect(result.statusCode).toBe(413);
    expect(result.payload).toEqual({ error: "Graph file is too large to serve" });
  });
});
