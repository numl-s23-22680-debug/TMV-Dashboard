"""Create a portable source ZIP without credentials, dependencies or build output."""

from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import argparse


def package_preview(destination: Path) -> None:
    root = Path(__file__).resolve().parent.parent
    excluded = {"node_modules", "dist", ".git", ".vite", "coverage", "test-results", "playwright-report", "__pycache__"}
    files = set()
    for folder in ("web", "scripts/browser"):
        for file in (root / folder).rglob("*"):
            relative = file.relative_to(root)
            if (file.is_file() and not file.is_symlink()
                    and not any(part in excluded for part in relative.parts)
                    and not file.name.startswith(".env")):
                files.add(file)
    files.update(root / name for name in ("README.md", "WINDOWS-PREVIEW.md", "start-dashboard.cmd", ".gitignore", "scripts/package-preview.py"))
    files.update((root / "docs").glob("*.md"))
    files.update((root / "docs/screenshots/aurora-before").glob("*-1366.png"))
    files.update((root / "docs/screenshots/aurora-before").glob("*-390.png"))
    files.update((root / "docs/screenshots/aurora").glob("*results.json"))
    # Include current desktop/mobile examples, keeping the portable download small.
    for name in ("overview", "overview-week", "jobs", "summary", "payments"):
        for theme in ("light", "dark"):
            for width in (390, 1366):
                file = root / "docs/screenshots/aurora" / f"{name}-{theme}-{width}.png"
                if file.is_file():
                    files.add(file)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(".building.zip")
    with ZipFile(temporary, "w", ZIP_DEFLATED) as archive:
        for file in sorted(files):
            archive.write(file, "TMV-Dashboard/" + file.relative_to(root).as_posix())
    with ZipFile(temporary) as archive:
        assert archive.testzip() is None, "Archive failed integrity verification"
        assert "TMV-Dashboard/start-dashboard.cmd" in archive.namelist()
        assert all(not Path(name).name.startswith(".env") and "node_modules" not in Path(name).parts and ".git" not in Path(name).parts and not name.endswith("/web.zip") for name in archive.namelist())
    temporary.replace(destination)
    destination.chmod(0o644)
    print(f"Verified ZIP: {destination} ({len(files)} files, {destination.stat().st_size:,} bytes)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    package_preview(parser.parse_args().output)
