"""Package only the seven visual files; original/private application data stays local."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import argparse
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
UI_FILES = [
    "src/screens/admin/dashboard/Layout.tsx",
    "src/screens/admin/dashboard/pages/OverviewPage.tsx",
    "src/screens/admin/dashboard/aurora.css",
    "src/screens/admin/dashboard/hooks/useDashboardTheme.ts",
    "src/screens/admin/dashboard/styles/ui-only-overview.css",
    "src/screens/admin/dashboard/styles/ui-only-reports.css",
    "src/screens/admin/dashboard/styles/ui-only-common.css",
]


def package(destination):
    files = {"web/" + name: ROOT / "web" / name for name in UI_FILES}
    files.update({name: ROOT / "scripts/ui-only" / name for name in
                  ("apply-new-ui.mjs", "ui-update.cmd", "README.md")})
    files.update({"verification/" + name: ROOT / "docs" / name for name in
                  ("ui-only-preservation.json", "ui-only-handoff.md")})
    screenshots = ROOT / "docs/screenshots/ui-only"
    for name in ("review-results-workflows.json", "review-results-after.json", "pdf-preservation-results.json"):
        files["verification/" + name] = screenshots / name
    for name in ("overview", "report-performance", "pdf-preview"):
        files[f"preview/before-{name}.png"] = screenshots / "before" / f"{name}-1366.png"
        for theme in ("light", "dark"):
            files[f"preview/{name}-{theme}.png"] = screenshots / "after" / f"{name}-{theme}-1366-viewport.png"
    files["preview/overview-mobile.png"] = screenshots / "after/overview-dark-390-viewport.png"
    files["preview/pdf-mobile.png"] = screenshots / "after/pdf-preview-dark-390-viewport.png"
    for name, file in files.items():
        if not file.is_file() or file.is_symlink():
            raise RuntimeError(f"Missing or invalid package file: {name}")
        if file.name.startswith(".env") or any(part in ("node_modules", "dist", ".git") for part in file.parts):
            raise RuntimeError("Private or generated content rejected")
    manifest = {name: hashlib.sha256(file.read_bytes()).hexdigest() for name, file in sorted(files.items())}
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(".building.zip")
    with ZipFile(temporary, "w", ZIP_DEFLATED) as archive:
        for name, file in sorted(files.items()):
            archive.write(file, "TMV-UI-Only-Update/" + name)
        archive.writestr("TMV-UI-Only-Update/verification/package-sha256.json", json.dumps(manifest, indent=2) + "\n")
    with ZipFile(temporary) as archive:
        assert archive.testzip() is None
        assert sum(name.startswith("TMV-UI-Only-Update/web/") for name in archive.namelist()) == 7
        assert all(not Path(name).name.startswith(".env") for name in archive.namelist())
    temporary.replace(destination)
    destination.chmod(0o644)
    print(f"Verified UI-only ZIP: {destination} ({destination.stat().st_size:,} bytes; 7 application files)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    package(parser.parse_args().output)
