#!/usr/bin/env node
/** Apply the TMV presentation patch to the user's own archive, locally. */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PATCH_FILES = Object.freeze([
  "src/screens/admin/dashboard/Layout.tsx",
  "src/screens/admin/dashboard/pages/OverviewPage.tsx",
  "src/screens/admin/dashboard/aurora.css",
  "src/screens/admin/dashboard/hooks/useDashboardTheme.ts",
  "src/screens/admin/dashboard/styles/ui-only-overview.css",
  "src/screens/admin/dashboard/styles/ui-only-reports.css",
  "src/screens/admin/dashboard/styles/ui-only-common.css",
]);

export const BASELINE_HASHES = Object.freeze({
  "web/src/screens/admin/dashboard/Layout.tsx":
    "7a2b8bc89ac17a27478f54614f9e1e91f99759a914c2a1c3200c7e29dfa21f66",
  "web/src/screens/admin/dashboard/pages/OverviewPage.tsx":
    "2b13753824c863884d9282539f5bb2e91b7e23f66ca836bc531a76514944c227",
});

// All user-supplied paths are environment values, never executable commands.
const POWERSHELL_ZIP = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$mode = $env:TMV_UI_ZIP_MODE
if ($mode -eq 'inspect') {
  $archive = [System.IO.Compression.ZipFile]::OpenRead($env:TMV_UI_ZIP_INPUT)
  try {
    $entries = New-Object 'System.Collections.Generic.List[object]'
    $hashes = @{}
    foreach ($entry in $archive.Entries) {
      [void]$entries.Add(@{
        name = $entry.FullName
        size = $entry.Length
        compressedSize = $entry.CompressedLength
        attributes = ([int64]$entry.ExternalAttributes -band 4294967295)
      })
      if ($entry.FullName -eq 'web/src/screens/admin/dashboard/Layout.tsx' -or
          $entry.FullName -eq 'web/src/screens/admin/dashboard/pages/OverviewPage.tsx') {
        $stream = $entry.Open()
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try {
          $hashes[$entry.FullName] = ([System.BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
        } finally { $sha.Dispose(); $stream.Dispose() }
      }
    }
    @{ entries = $entries.ToArray(); hashes = $hashes } | ConvertTo-Json -Depth 6 -Compress
  } finally { $archive.Dispose() }
} elseif ($mode -eq 'extract') {
  [System.IO.Compression.ZipFile]::ExtractToDirectory($env:TMV_UI_ZIP_INPUT, $env:TMV_UI_ZIP_TARGET)
} elseif ($mode -eq 'create') {
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $env:TMV_UI_ZIP_SOURCE, $env:TMV_UI_ZIP_TARGET,
    [System.IO.Compression.CompressionLevel]::Optimal, $true)
} else { throw 'Invalid archive operation.' }
`;

// Python's standard-library ZIP implementation permits the same checks on Linux
// and macOS. Windows always uses the built-in PowerShell/.NET ZIP implementation.
const PYTHON_ZIP = String.raw`
import hashlib, json, os, pathlib, zipfile
mode = os.environ["TMV_UI_ZIP_MODE"]
if mode == "inspect":
    with zipfile.ZipFile(os.environ["TMV_UI_ZIP_INPUT"]) as archive:
        entries = [{"name": e.filename, "size": e.file_size,
                    "compressedSize": e.compress_size,
                    "attributes": e.external_attr} for e in archive.infolist()]
        hashes = {}
        for name in ("web/src/screens/admin/dashboard/Layout.tsx",
                     "web/src/screens/admin/dashboard/pages/OverviewPage.tsx"):
            if name in archive.namelist():
                with archive.open(name) as entry:
                    hashes[name] = hashlib.file_digest(entry, "sha256").hexdigest()
        print(json.dumps({"entries": entries, "hashes": hashes}))
elif mode == "extract":
    with zipfile.ZipFile(os.environ["TMV_UI_ZIP_INPUT"]) as archive:
        archive.extractall(os.environ["TMV_UI_ZIP_TARGET"])
elif mode == "create":
    source = pathlib.Path(os.environ["TMV_UI_ZIP_SOURCE"])
    with zipfile.ZipFile(os.environ["TMV_UI_ZIP_TARGET"], "w", zipfile.ZIP_DEFLATED) as archive:
        archive.write(source, source.name + "/")
        for entry in sorted(source.rglob("*")):
            if entry.is_symlink():
                raise ValueError("Symbolic links cannot be included in the updated archive.")
            archive.write(entry, entry.relative_to(source.parent).as_posix())
else:
    raise ValueError("Invalid archive operation.")
`;

function archiveTool() {
  if (process.platform === "win32") {
    const executable = path.join(
      process.env.SystemRoot || "C:\\Windows",
      "System32", "WindowsPowerShell", "v1.0", "powershell.exe",
    );
    return {
      executable,
      args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", POWERSHELL_ZIP],
    };
  }
  for (const executable of ["python3", "python"]) {
    const result = spawnSync(executable, ["--version"], { encoding: "utf8" });
    if (result.status === 0) return { executable, args: ["-c", PYTHON_ZIP] };
  }
  throw new Error("Python 3 is required for archive handling on Linux/macOS. Windows needs no extra ZIP software.");
}

function runArchive(tool, mode, values) {
  const result = spawnSync(tool.executable, tool.args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, TMV_UI_ZIP_MODE: mode, ...values },
  });
  if (result.error || result.status !== 0) {
    // Do not echo archive content, environment values, or backend exception dumps.
    throw new Error(`Archive ${mode} failed. Check that the ZIP is valid and the folder is writable.`);
  }
  return result.stdout.trim().replace(/^\uFEFF/, "");
}

export function validateArchive(index) {
  if (!index || !Array.isArray(index.entries) || index.entries.length === 0) {
    throw new Error("The ZIP contains no readable application files.");
  }
  if (index.entries.length > 10_000) throw new Error("The ZIP contains too many entries.");
  const names = new Set();
  let totalBytes = 0;
  for (const entry of index.entries) {
    const name = entry.name;
    if (typeof name !== "string" || !name.startsWith("web/") ||
        /[\\:*?<>|"\x00-\x1f\x7f]/.test(name)) {
      throw new Error("The ZIP contains an unsafe path or files outside the web folder.");
    }
    const parts = name.replace(/\/$/, "").split("/");
    if (parts.some((part) => !part || part === "." || part === ".." ||
        /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
      throw new Error("The ZIP contains an unsafe path.");
    }
    const identity = name.replace(/\/$/, "").toLowerCase();
    if (names.has(identity)) throw new Error("The ZIP contains duplicate or case-conflicting paths.");
    names.add(identity);
    const attributes = Number(entry.attributes) >>> 0;
    if (((attributes >>> 16) & 0xf000) === 0xa000 || (attributes & 0x400) !== 0) {
      throw new Error("The ZIP contains a symbolic link or reparse point.");
    }
    if (!Number.isSafeInteger(entry.size) || entry.size < 0 ||
        !Number.isSafeInteger(entry.compressedSize) || entry.compressedSize < 0) {
      throw new Error("The ZIP contains invalid file metadata.");
    }
    totalBytes += entry.size;
    if (totalBytes > 512 * 1024 * 1024 ||
        (entry.size > 10 * 1024 * 1024 && entry.size > Math.max(entry.compressedSize, 1) * 1_000)) {
      throw new Error("The ZIP exceeds the safe extraction limit.");
    }
  }
  if (!names.has("web/package.json")) throw new Error("The ZIP does not contain web/package.json.");
  for (const [name, hash] of Object.entries(BASELINE_HASHES)) {
    if (index.hashes?.[name] !== hash) {
      throw new Error("This ZIP has a different Layout or Overview revision. No files were changed. Use the original web.zip supplied for this UI update.");
    }
  }
  for (const filename of PATCH_FILES.slice(2)) {
    if (names.has(`web/${filename}`.toLowerCase())) {
      throw new Error("The ZIP already contains one of the new UI files. No files were changed.");
    }
  }
}

async function filesUnder(directory, prefix = "") {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error("The UI overlay must not contain symbolic links.");
    if (entry.isDirectory()) files.push(...await filesUnder(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
    else throw new Error("The UI overlay contains an unsupported file type.");
  }
  return files.sort();
}

async function validateOverlay(overlay) {
  const directory = path.join(overlay, "web");
  const files = await filesUnder(directory);
  const expected = [...PATCH_FILES].sort();
  if (files.length !== expected.length || files.some((name, i) => name !== expected[i])) {
    throw new Error("The UI overlay must contain exactly the seven approved presentation files under web/. Unexpected files were rejected.");
  }
  for (const name of files) {
    if ((await fs.stat(path.join(directory, name))).size === 0) {
      throw new Error("The UI overlay contains an empty file.");
    }
  }
}

function desktopDirectory() {
  if (process.platform === "win32") {
    const executable = path.join(process.env.SystemRoot || "C:\\Windows",
      "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    const result = spawnSync(executable,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "[Environment]::GetFolderPath('Desktop')"],
      { encoding: "utf8", windowsHide: true });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  return path.join(os.homedir(), "Desktop");
}

export async function applyUi({ input, output, overlay }) {
  if (Number(process.versions.node.split(".")[0]) < 24) throw new Error("Install Node.js 24 or newer, then run this helper again.");
  input = path.resolve(input);
  output = path.resolve(output);
  overlay = path.resolve(overlay);
  if (existsSync(output)) throw new Error("The output folder already exists. Choose a new --output folder; existing folders are never overwritten.");
  if (!(await fs.stat(input)).isFile()) throw new Error("The original ZIP was not found.");
  await validateOverlay(overlay);
  const tool = archiveTool();
  let index;
  try { index = JSON.parse(runArchive(tool, "inspect", { TMV_UI_ZIP_INPUT: input })); }
  catch { throw new Error("The original ZIP could not be inspected. No files were changed."); }
  validateArchive(index);
  const originalHash = createHash("sha256").update(await fs.readFile(input)).digest("hex");
  const parent = path.dirname(output);
  await fs.mkdir(parent, { recursive: true });
  const stage = await fs.mkdtemp(path.join(parent, ".tmv-ui-staging-"));
  let outputCreated = false;
  try {
    runArchive(tool, "extract", { TMV_UI_ZIP_INPUT: input, TMV_UI_ZIP_TARGET: stage });
    const web = path.join(stage, "web");
    // dist is generated output, not application logic. Drop it only from the
    // new copy so old compiled code cannot accidentally masquerade as new UI.
    await fs.rm(path.join(web, "dist"), { recursive: true, force: true });
    for (const filename of PATCH_FILES) {
      const destination = path.join(web, filename);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(path.join(overlay, "web", filename), destination);
    }
    const zip = path.join(stage, "web-new-ui.zip");
    runArchive(tool, "create", { TMV_UI_ZIP_SOURCE: web, TMV_UI_ZIP_TARGET: zip });
    // Detect a concurrent source change without altering that source.
    const afterHash = createHash("sha256").update(await fs.readFile(input)).digest("hex");
    if (afterHash !== originalHash) throw new Error("The original ZIP changed while copying. Run again with a stable original archive.");
    await fs.mkdir(output); // Exclusive reservation: never replace an existing directory.
    outputCreated = true;
    await fs.rename(web, path.join(output, "web"));
    await fs.rename(zip, path.join(output, "web-new-ui.zip"));
    const instructions = [
      "TMV presentation update applied locally.",
      "",
      "Only Layout.tsx, OverviewPage.tsx and five new presentation files changed.",
      "Original application logic, API/authentication, PDF preview, exports, tests,",
      "dependencies and configuration files were copied byte-for-byte.",
      "The original web.zip was not modified. Its private files stay on this computer.",
      "The old generated dist/ folder was omitted from the new copy. Rebuild before using it.",
      "",
      "Open a terminal in the web folder. With Node.js 24 or newer installed, run:",
      "  npm ci",
      "  npm run build",
      "  npm run dev -- --host localhost --port 3004",
      "Then open http://localhost:3004 and keep the terminal open.",
      "Your original API configuration is preserved. The original backend must be reachable.",
      "Nothing was installed, started, sent or deployed automatically.",
      "",
      "web-new-ui.zip contains your updated application and your original private configuration.",
      "Keep it private; do not upload it publicly or commit credentials.",
      "",
    ].join("\r\n");
    await fs.writeFile(path.join(output, "UI-UPDATE-INFO.txt"), instructions);
    return { output, zip: path.join(output, "web-new-ui.zip"), patchFiles: PATCH_FILES.length };
  } catch (error) {
    if (outputCreated) {
      error.message += " The new output folder may be incomplete. The original ZIP is unchanged; choose another output folder to retry.";
    }
    throw error;
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
  }
}

function optionsFromArgs(args) {
  if (args.includes("--help") || args.includes("-h")) return null;
  const values = {};
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i];
    if (!["--input", "--output", "--overlay"].includes(name) || !args[i + 1] || args[i + 1].startsWith("--")) {
      throw new Error("Use --input <web.zip>, --output <new folder>, and optionally --overlay <UI patch folder>.");
    }
    if (values[name]) throw new Error(`The ${name} option was provided more than once.`);
    values[name] = args[i + 1];
  }
  const desktop = desktopDirectory();
  return {
    input: values["--input"] || path.join(desktop, "web.zip"),
    output: values["--output"] || path.join(desktop, "TMV-New-UI"),
    overlay: values["--overlay"] || path.dirname(fileURLToPath(import.meta.url)),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = optionsFromArgs(process.argv.slice(2));
    if (!options) {
      console.log("TMV UI-only update (Node.js 24+)\n\nDefault: Desktop/web.zip -> Desktop/TMV-New-UI\n\nnode apply-new-ui.mjs --input <original web.zip> --output <new folder> [--overlay <patch folder>]\n\nThe original ZIP is never overwritten. No software or server is started automatically.");
    } else {
      const result = await applyUi(options);
      console.log(`UI update complete.\nNew application: ${path.join(result.output, "web")}\nLocal updated ZIP: ${result.zip}\n\nThe original web.zip is unchanged. See UI-UPDATE-INFO.txt for rebuild and localhost instructions.`);
    }
  } catch (error) {
    console.error(`UI update stopped: ${error.message}`);
    process.exitCode = 1;
  }
}
