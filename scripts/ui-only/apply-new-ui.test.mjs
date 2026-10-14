import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { applyUi, BASELINE_HASHES, PREVIOUS_UI_HASHES, PATCH_FILES, defaultPaths, validateArchive } from "./apply-new-ui.mjs";

const original = process.env.TMV_TEST_ORIGINAL_ZIP;
const python = process.env.TMV_TEST_PYTHON || "python3";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function zipPython(source, env = {}) {
  const result = spawnSync(python, ["-c", source], {
    encoding: "utf8", env: { ...process.env, ...env }, maxBuffer: 2 * 1024 * 1024,
  });
  assert.equal(result.status, 0, "ZIP test helper must succeed");
  return result.stdout.trim();
}

async function withTemp(work) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "tmv-ui-only-test-"));
  try { await work(directory); }
  finally { await fs.rm(directory, { recursive: true, force: true }); }
}

async function makeOverlay(directory) {
  const overlay = path.join(directory, "UI overlay with spaces");
  for (const filename of PATCH_FILES) {
    const file = path.join(overlay, "web", filename);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `/* local presentation test: ${filename} */\n`);
  }
  return overlay;
}

async function previousUiArchive(directory) {
  const previousFiles = path.join(directory, "previous presentation files");
  for (const filename of PATCH_FILES) {
    const result = spawnSync("git", ["show", `8c55635:web/${filename}`], {
      cwd: repository, maxBuffer: 2 * 1024 * 1024,
    });
    assert.equal(result.status, 0, "previous UI source revision must be available for upgrade test");
    const destination = path.join(previousFiles, "web", filename);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, result.stdout);
  }
  const input = path.join(directory, "previous local web-new-ui.zip");
  zipPython(String.raw`
import json, os, pathlib, zipfile
files = pathlib.Path(os.environ['TEST_PREVIOUS_FILES'])
patches = json.loads(os.environ['TEST_PATCH_FILES'])
with zipfile.ZipFile(os.environ['TEST_ORIGINAL']) as source, zipfile.ZipFile(os.environ['TEST_COPY'], 'w') as target:
    original_names = set(source.namelist())
    for entry in source.infolist():
        content = (files / entry.filename).read_bytes() if entry.filename in patches else source.read(entry)
        target.writestr(entry, content)
    for name in patches:
        if name not in original_names:
            target.writestr(name, (files / name).read_bytes())
`, {
    TEST_ORIGINAL: original, TEST_COPY: input, TEST_PREVIOUS_FILES: previousFiles,
    TEST_PATCH_FILES: JSON.stringify(PATCH_FILES.map((name) => `web/${name}`)),
  });
  return input;
}

function indexWith(name = "web/package.json", additions = []) {
  return {
    entries: [{ name, size: 0, compressedSize: 0, attributes: 0 }, ...additions],
    hashes: { ...BASELINE_HASHES },
  };
}

test("archive paths reject traversal, absolute paths, Windows aliases and links", () => {
  for (const filename of [
    "../outside.txt", "web/../../outside.txt", "/web/file", "C:/web/file",
    "web/..\\outside.txt", "web/a//b", "web/CON.txt", "web/filename. ",
    "web/folder./item", "web/x:stream", "web/?.txt",
  ]) {
    assert.throws(() => validateArchive(indexWith(filename)), /unsafe path/);
  }
  assert.throws(() => validateArchive(indexWith("web/package.json", [
    { name: "web/link", size: 1, compressedSize: 1, attributes: 0xa000 << 16 },
  ])), /symbolic link/);
});

test("case conflicts, different source revision and already-applied overlays are rejected", () => {
  assert.throws(() => validateArchive(indexWith("web/package.json", [
    { name: "web/PACKAGE.json", size: 0, compressedSize: 0, attributes: 0 },
  ])), /case-conflicting/);
  const wrong = indexWith();
  wrong.hashes[Object.keys(BASELINE_HASHES)[0]] = "incorrect";
  assert.throws(() => validateArchive(wrong), /different Layout or Overview revision/);
  assert.throws(() => validateArchive(indexWith("web/package.json", [
    { name: `web/${PATCH_FILES[2]}`, size: 1, compressedSize: 1, attributes: 0 },
  ])), /already contains/);
});

test("oversized archives are rejected before extraction", () => {
  assert.throws(() => validateArchive(indexWith("web/package.json", [
    { name: "web/huge", size: 513 * 1024 * 1024, compressedSize: 100, attributes: 0 },
  ])), /safe extraction limit/);
});

test("previous UI requires its complete matching pair and five regular presentation files", () => {
  const previous = indexWith("web/package.json", PATCH_FILES.slice(2).map((filename) => ({
    name: `web/${filename}`, size: 1, compressedSize: 1, attributes: 0x8000 << 16,
  })));
  previous.hashes = { ...PREVIOUS_UI_HASHES };
  assert.equal(validateArchive(previous), "previous-ui");
  const mixed = structuredClone(previous);
  mixed.hashes[Object.keys(BASELINE_HASHES)[1]] = Object.values(BASELINE_HASHES)[1];
  assert.throws(() => validateArchive(mixed), /different Layout or Overview revision/);
  const missing = structuredClone(previous);
  missing.entries.pop();
  assert.throws(() => validateArchive(missing), /missing a required presentation file/);
  const directory = structuredClone(previous);
  directory.entries[1].attributes = 0x10;
  assert.throws(() => validateArchive(directory), /directory in its place/);
});

test("desktop defaults prefer the previous local UI ZIP and keep its folder intact", async () => {
  await withTemp(async (desktop) => {
    const originalDefault = defaultPaths(desktop);
    assert.equal(originalDefault.input, path.join(desktop, "web.zip"));
    assert.equal(originalDefault.output, path.join(desktop, "TMV-Glass-UI"));
    const previous = path.join(desktop, "TMV-New-UI", "web-new-ui.zip");
    await fs.mkdir(path.dirname(previous));
    await fs.writeFile(previous, "local previous archive marker");
    const upgradeDefault = defaultPaths(desktop);
    assert.equal(upgradeDefault.input, previous);
    assert.equal(upgradeDefault.output, originalDefault.output);
    assert.equal(await fs.readFile(previous, "utf8"), "local previous archive marker");
  });
});

test("an existing output folder is never changed", async () => {
  await withTemp(async (directory) => {
    const output = path.join(directory, "existing");
    await fs.mkdir(output);
    const marker = path.join(output, "keep.txt");
    await fs.writeFile(marker, "original folder");
    await assert.rejects(applyUi({ input: "not-needed.zip", output, overlay: directory }), /already exists/);
    assert.equal(await fs.readFile(marker, "utf8"), "original folder");
    assert.deepEqual(await fs.readdir(output), ["keep.txt"]);
  });
});

test("unexpected application files in the overlay are rejected", { skip: !original }, async () => {
  await withTemp(async (directory) => {
    const overlay = await makeOverlay(directory);
    await fs.writeFile(path.join(overlay, "web", "package.json"), "{}");
    const output = path.join(directory, "new");
    await assert.rejects(applyUi({ input: original, output, overlay }), /exactly the seven approved/);
    await assert.rejects(fs.stat(output), { code: "ENOENT" });
  });
});

test("different Layout bytes fail without creating output or changing the source ZIP", { skip: !original }, async () => {
  await withTemp(async (directory) => {
    const overlay = await makeOverlay(directory);
    const input = path.join(directory, "different revision.zip");
    zipPython(String.raw`
import os, zipfile
with zipfile.ZipFile(os.environ['TEST_ORIGINAL']) as source, zipfile.ZipFile(os.environ['TEST_COPY'], 'w') as target:
    for entry in source.infolist():
        data = source.read(entry)
        if entry.filename == 'web/src/screens/admin/dashboard/Layout.tsx':
            data += b'\n// different source revision\n'
        target.writestr(entry, data)
`, { TEST_ORIGINAL: original, TEST_COPY: input });
    const before = digest(await fs.readFile(input));
    const output = path.join(directory, "not created");
    await assert.rejects(applyUi({ input, output, overlay }), /different Layout or Overview revision/);
    assert.equal(digest(await fs.readFile(input)), before);
    await assert.rejects(fs.stat(output), { code: "ENOENT" });
  });
});

test("a traversal ZIP is rejected and cannot create a file outside output", { skip: !original }, async () => {
  await withTemp(async (directory) => {
    const overlay = await makeOverlay(directory);
    const input = path.join(directory, "unsafe.zip");
    zipPython(String.raw`
import os, zipfile
with zipfile.ZipFile(os.environ['TEST_ORIGINAL']) as source, zipfile.ZipFile(os.environ['TEST_COPY'], 'w') as target:
    for entry in source.infolist():
        target.writestr(entry, source.read(entry))
    target.writestr('web/../../outside.txt', 'must not extract')
`, { TEST_ORIGINAL: original, TEST_COPY: input });
    const output = path.join(directory, "not created");
    await assert.rejects(applyUi({ input, output, overlay }), /unsafe path/);
    await assert.rejects(fs.stat(output), { code: "ENOENT" });
    await assert.rejects(fs.stat(path.join(directory, "outside.txt")), { code: "ENOENT" });
  });
});

test("local copy preserves every original source/config/PDF file and only patches approved UI", { skip: !original }, async () => {
  await withTemp(async (directory) => {
    const overlay = await makeOverlay(directory);
    const output = path.join(directory, "New UI with spaces");
    const before = digest(await fs.readFile(original));
    const result = await applyUi({ input: original, output, overlay });
    assert.equal(result.patchFiles, 7);
    assert.equal(digest(await fs.readFile(original)), before, "original ZIP remains byte-identical");
    const report = JSON.parse(zipPython(String.raw`
import hashlib, json, os, pathlib, zipfile
patches = set(json.loads(os.environ['TEST_PATCH_FILES']))
output = pathlib.Path(os.environ['TEST_OUTPUT'])
preserved = 0
with zipfile.ZipFile(os.environ['TEST_ORIGINAL']) as source, zipfile.ZipFile(output / 'web-new-ui.zip') as updated:
    assert updated.testzip() is None
    for entry in source.infolist():
        name = entry.filename
        if name.endswith('/') or name.startswith('web/dist/'):
            continue
        expected = source.read(entry)
        actual = updated.read(name)
        assert actual == (output / name).read_bytes(), 'archive and folder differ'
        if name not in patches:
            assert actual == expected, 'original non-UI file changed'
            preserved += 1
    new_files = {n for n in updated.namelist() if not n.endswith('/')}
    old_files = {n for n in source.namelist() if not n.endswith('/') and not n.startswith('web/dist/')}
    assert new_files - old_files == {n for n in patches if n not in old_files}
    assert not any(n.startswith('web/dist/') for n in updated.namelist())
    assert updated.read('web/.env.local') == source.read('web/.env.local')
print(json.dumps({'preservedOriginalFiles': preserved, 'privateConfigurationUnchanged': True, 'zipValid': True}))
`, {
      TEST_ORIGINAL: original, TEST_OUTPUT: output,
      TEST_PATCH_FILES: JSON.stringify(PATCH_FILES.map((name) => `web/${name}`)),
    }));
    assert.equal(report.privateConfigurationUnchanged, true);
    assert.equal(report.zipValid, true);
    assert.ok(report.preservedOriginalFiles >= 360, "all original non-UI source files were checked");
    const instructions = await fs.readFile(path.join(output, "UI-UPDATE-INFO.txt"), "utf8");
    assert.match(instructions, /npm ci/);
    assert.match(instructions, /original backend must be reachable/);
    assert.match(instructions, /Nothing was installed, started, sent or deployed automatically/);
  });
});

test("previous UI upgrade preserves original configuration/records and the previous ZIP", { skip: !original }, async () => {
  await withTemp(async (directory) => {
    const input = await previousUiArchive(directory);
    const overlay = await makeOverlay(directory);
    const output = path.join(directory, "Glass UI folder with spaces");
    const sourceBefore = digest(await fs.readFile(original));
    const previousBefore = digest(await fs.readFile(input));
    const result = await applyUi({ input, output, overlay });
    assert.equal(result.sourceRevision, "previous-ui");
    assert.equal(digest(await fs.readFile(original)), sourceBefore);
    assert.equal(digest(await fs.readFile(input)), previousBefore);
    const report = JSON.parse(zipPython(String.raw`
import json, os, pathlib, zipfile
patches = set(json.loads(os.environ['TEST_PATCH_FILES']))
output = pathlib.Path(os.environ['TEST_OUTPUT'])
preserved = 0
with zipfile.ZipFile(os.environ['TEST_ORIGINAL']) as original, zipfile.ZipFile(os.environ['TEST_PREVIOUS']) as previous, zipfile.ZipFile(output / 'web-new-ui.zip') as updated:
    assert updated.testzip() is None
    for entry in previous.infolist():
        name = entry.filename
        if name.endswith('/') or name.startswith('web/dist/') or name in patches:
            continue
        assert updated.read(name) == previous.read(entry) == original.read(name)
        assert updated.read(name) == (output / name).read_bytes()
        preserved += 1
    assert updated.read('web/.env.local') == original.read('web/.env.local')
    assert not any(n.startswith('web/dist/') for n in updated.namelist())
print(json.dumps({'preservedOriginalFiles': preserved, 'privateConfigurationUnchanged': True}))
`, {
      TEST_ORIGINAL: original, TEST_PREVIOUS: input, TEST_OUTPUT: output,
      TEST_PATCH_FILES: JSON.stringify(PATCH_FILES.map((name) => `web/${name}`)),
    }));
    assert.equal(report.privateConfigurationUnchanged, true);
    assert.ok(report.preservedOriginalFiles >= 360);
    const instructions = await fs.readFile(path.join(output, "UI-UPDATE-INFO.txt"), "utf8");
    assert.match(instructions, /Glass UI/);
    assert.match(instructions, /previous UI presentation files were refreshed/);
    await assert.rejects(applyUi({ input, output, overlay }), /already exists/);
    assert.equal(digest(await fs.readFile(input)), previousBefore);
  });
});

test("a mixed original/previous UI archive is rejected without changing either input", { skip: !original }, async () => {
  await withTemp(async (directory) => {
    const previous = await previousUiArchive(directory);
    const input = path.join(directory, "mixed source pair.zip");
    zipPython(String.raw`
import os, zipfile
name = 'web/src/screens/admin/dashboard/pages/OverviewPage.tsx'
with zipfile.ZipFile(os.environ['TEST_ORIGINAL']) as original, zipfile.ZipFile(os.environ['TEST_PREVIOUS']) as previous, zipfile.ZipFile(os.environ['TEST_COPY'], 'w') as target:
    for entry in previous.infolist():
        target.writestr(entry, original.read(name) if entry.filename == name else previous.read(entry))
`, { TEST_ORIGINAL: original, TEST_PREVIOUS: previous, TEST_COPY: input });
    const originalBefore = digest(await fs.readFile(original));
    const previousBefore = digest(await fs.readFile(previous));
    const mixedBefore = digest(await fs.readFile(input));
    const output = path.join(directory, "must not be created");
    const overlay = await makeOverlay(directory);
    await assert.rejects(applyUi({ input, output, overlay }), /different Layout or Overview revision/);
    assert.equal(digest(await fs.readFile(original)), originalBefore);
    assert.equal(digest(await fs.readFile(previous)), previousBefore);
    assert.equal(digest(await fs.readFile(input)), mixedBefore);
    await assert.rejects(fs.stat(output), { code: "ENOENT" });
  });
});
