#!/usr/bin/env node
/** Verify the presentation overlay against the uploaded web source without exposing source contents. */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseline = path.resolve(process.argv[2] || "/workspace/tmv-ui-only-baseline/web");
const working = path.resolve(process.argv[3] || path.join(repository, "web"));
const output = path.resolve(process.argv[4] || path.join(repository, "docs", "ui-only-preservation.json"));
const edited = new Set([
  "src/screens/admin/dashboard/Layout.tsx",
  "src/screens/admin/dashboard/pages/OverviewPage.tsx",
]);
const additions = new Set([
  "src/screens/admin/dashboard/aurora.css",
  "src/screens/admin/dashboard/hooks/useDashboardTheme.ts",
  "src/screens/admin/dashboard/hooks/useDashboardTheme.test.tsx",
  "src/screens/admin/dashboard/styles/ui-only-common.css",
  "src/screens/admin/dashboard/styles/ui-only-overview.css",
  "src/screens/admin/dashboard/styles/ui-only-reports.css",
]);
const ignoredDirectories = new Set(["node_modules", "dist", ".git"]);
const hash = value => createHash("sha256").update(value).digest("hex");

async function files(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = new Map();
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
      for (const pair of await files(root, absolute)) result.set(...pair);
    } else if (entry.isFile()) {
      result.set(path.relative(root, absolute).split(path.sep).join("/"), await readFile(absolute));
    }
  }
  return result;
}

const [original, current] = await Promise.all([files(baseline), files(working)]);
const manifest = [...original].sort(([a], [b]) => a.localeCompare(b)).map(([filename, content]) => {
  const next = current.get(filename);
  return {
    path: filename,
    originalSha256: hash(content),
    currentSha256: next === undefined ? null : hash(next),
    status: next === undefined ? "missing" : content.equals(next) ? "unchanged" : edited.has(filename) ? "allowed-presentation-edit" : "unexpected-edit",
  };
});
const newFiles = [...current.keys()].filter(filename => !original.has(filename)).sort().map(filename => ({
  path: filename, sha256: hash(current.get(filename)), allowed: additions.has(filename),
}));
const failures = manifest.filter(file => ["missing", "unexpected-edit"].includes(file.status)).map(file => file.path);
failures.push(...newFiles.filter(file => !file.allowed).map(file => file.path));

// Compare normalized TypeScript with JSX presentation elided. Added imports and
// declarations are restricted to CSS, the theme hook, and its three display icons.
// JSX event handlers and other runtime bindings are checked separately below.
let astChecks = [];
try {
  const require = createRequire(path.join(working, "package.json"));
  const ts = require("typescript");
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
  const isJsx = node => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);
  const visualAttributes = new Set([
    "className", "style", "color", "fill", "fillOpacity", "stroke", "strokeWidth", "strokeOpacity", "strokeDasharray",
    "radius", "height", "width", "size", "viewBox", "margin", "padding", "r", "cx", "cy", "x", "y", "dx", "dy",
    "offset", "stopColor", "stopOpacity", "opacity", "gradientUnits", "x1", "x2", "y1", "y2", "id", "aria-hidden",
    "axisLine", "tickLine", "tick", "activeDot", "dot", "minTickGap", "maxBarSize", "cursor", "contentStyle", "labelStyle", "itemStyle",
  ]);
  function source(filename, contents) {
    return ts.createSourceFile(filename, contents.toString("utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  }
  function normalized(filename, contents) {
    const tree = source(filename, contents);
    const transform = ts.transform(tree, [context => {
      const visitor = node => {
        if (isJsx(node)) return ts.factory.createStringLiteral("[JSX presentation]");
        if (ts.isImportDeclaration(node)) {
          const module = node.moduleSpecifier.text;
          if (module.endsWith(".css") || module === "./hooks/useDashboardTheme") return undefined;
          if (module === "lucide-react" && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
            const names = node.importClause.namedBindings.elements.filter(name => !["Sun", "Moon", "Monitor"].includes(name.name.text));
            return ts.factory.updateImportDeclaration(node, node.modifiers, ts.factory.updateImportClause(node.importClause,
              node.importClause.isTypeOnly, node.importClause.name, ts.factory.updateNamedImports(node.importClause.namedBindings, names)), node.moduleSpecifier, node.attributes);
          }
        }
        if (ts.isVariableStatement(node) && node.declarationList.declarations.every(declaration => ts.isIdentifier(declaration.name) && ["dashboardTheme", "ThemeIcon"].includes(declaration.name.text))) return undefined;
        return ts.visitEachChild(node, visitor, context);
      };
      return root => ts.visitNode(root, visitor);
    }]);
    try { return printer.printFile(transform.transformed[0]); }
    finally { transform.dispose(); }
  }
  function runtimeBindings(filename, contents) {
    const tree = source(filename, contents);
    const bindings = [];
    const print = node => {
      const transformed = ts.transform(node, [context => {
        const visit = value => isJsx(value) ? ts.factory.createStringLiteral("[JSX presentation]") : ts.visitEachChild(value, visit, context);
        return root => ts.visitNode(root, visit);
      }]);
      try { return printer.printNode(ts.EmitHint.Unspecified, transformed.transformed[0], tree); }
      finally { transformed.dispose(); }
    };
    const visit = node => {
      if (ts.isJsxElement(node)) {
        const attributes = node.openingElement.attributes.properties;
        if (attributes.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === "title" && attribute.initializer?.getText(tree) === '"Dashboard theme"')) return;
      }
      if (ts.isJsxAttribute(node)) {
        const name = node.name.getText(tree);
        if (visualAttributes.has(name)) return;
        if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) bindings.push([name, print(node.initializer.expression)]);
        return;
      }
      if (ts.isJsxSpreadAttribute(node)) { bindings.push(["spread", print(node.expression)]); return; }
      if (ts.isJsxExpression(node) && node.expression) bindings.push(["child", print(node.expression)]);
      ts.forEachChild(node, visit);
    };
    visit(tree);
    return bindings;
  }
  astChecks = [...edited].map(filename => {
    const originalLogic = normalized(filename, original.get(filename));
    const currentLogic = normalized(filename, current.get(filename));
    const originalBindings = runtimeBindings(filename, original.get(filename));
    const currentBindings = runtimeBindings(filename, current.get(filename));
    return {
      path: filename,
      nonJsxLogicUnchanged: originalLogic === currentLogic,
      originalLogicSha256: hash(originalLogic), currentLogicSha256: hash(currentLogic),
      runtimeBindingsUnchanged: JSON.stringify(originalBindings) === JSON.stringify(currentBindings),
      originalRuntimeBindingCount: originalBindings.length, currentRuntimeBindingCount: currentBindings.length,
      originalRuntimeBindingsSha256: hash(JSON.stringify(originalBindings)), currentRuntimeBindingsSha256: hash(JSON.stringify(currentBindings)),
    };
  });
  failures.push(...astChecks.filter(check => !check.nonJsxLogicUnchanged || !check.runtimeBindingsUnchanged).map(check => `${check.path}: AST behavior changed`));
} catch (error) {
  failures.push(`AST verification unavailable: ${error.message}`);
}

const protectedCategories = {
  originalTests: filename => /\.test\.[cm]?[jt]sx?$/.test(filename),
  apiAndAuth: filename => filename.startsWith("src/api/") || /(?:^|\/)api\.[jt]s$/.test(filename) || /(?:auth|login|session)/i.test(filename),
  driverWorkflow: filename => filename.startsWith("src/components/driver/") || /(?:JobWorkflowScreen|JobListScreen|workflow\/)/.test(filename),
  pdfAndReports: filename => /(?:Paper[A-Z]|PdfPreview|ReportPreviewCanvas|PrintPortal|reportDocument|printReady|driverReportDownload|DriverReport|driverReport\.|ReportReturn|reportNavigation|SubmissionDetailDrawer|FinishedJobsPage)/.test(filename),
};
const categories = Object.fromEntries(Object.entries(protectedCategories).map(([category, matches]) => {
  const selected = manifest.filter(file => matches(file.path));
  return [category, { count: selected.length, byteIdentical: selected.every(file => file.status === "unchanged") }];
}));
const report = {
  baselineSourceFileCount: original.size,
  currentSourceFileCount: current.size,
  byteIdenticalOriginalFileCount: manifest.filter(file => file.status === "unchanged").length,
  allowedPresentationEditCount: manifest.filter(file => file.status === "allowed-presentation-edit").length,
  allowedAddedFileCount: newFiles.filter(file => file.allowed).length,
  categories, astChecks, newFiles, failures, passed: failures.length === 0,
  caveats: ["The hash baseline intentionally excludes generated dependencies/build output and does not contain the uploaded .env.local. The UI overlay must never include or overwrite environment files.",
    "AST checks compare non-JSX code and runtime JSX expressions, with only documented theme additions and visual attributes elided. They complement the unchanged operational source and executed tests; they do not prove external API behavior."],
  files: manifest,
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, files: undefined, newFiles: report.newFiles.map(file => ({ path: file.path, allowed: file.allowed })) }, null, 2));
if (!report.passed) process.exitCode = 1;
