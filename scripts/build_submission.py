"""Export an explicit source allowlist, excluding local data and Git history."""
import argparse
import hashlib
import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "README.md", "LICENSE", "THIRD_PARTY_NOTICES.md", ".gitignore",
    "backend/__init__.py", "backend/app.py", "backend/explanations.py", "backend/attention.py", "backend/vision.py",
    "backend/requirements.txt", "backend/requirements-test.txt",
    "backend/requirements-watsonx.txt", "backend/.env.example",
    "backend/best_subset_model.h5",
    "frontend/.gitignore", "frontend/.env.example", "frontend/README.md",
    "frontend/package.json", "frontend/package-lock.json", "frontend/index.html",
    "frontend/vite.config.js", "frontend/eslint.config.js",
]
TREES = ["frontend/src", "frontend/public", "frontend/tests", "chrome-extension", "docs", "samples", "training", "tests", "scripts", ".github"]


def source_files():
    selected = [ROOT / name for name in FILES]
    for directory in TREES:
        for file in (ROOT / directory).rglob("*"):
            relative = file.relative_to(ROOT)
            if not file.is_file() or file.is_symlink():
                continue
            if any(part in {"__pycache__", "outputs", "data", ".DS_Store", ".git", "node_modules"} for part in relative.parts):
                continue
            if file.suffix in {".pyc", ".log"} or file.name == ".env":
                continue
            selected.append(file)
    return sorted(set(selected))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT.parent / "submission")
    args = parser.parse_args()
    destination = args.output_dir.resolve() / "RealReveal-HSC2027"
    archive = args.output_dir.resolve() / "RealReveal-HSC2027.zip"
    files = source_files()
    # Check real local secrets without ever printing their values.
    secrets = []
    env_file = ROOT / "backend" / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if "=" not in line or line.lstrip().startswith("#"):
                continue
            key, value = line.split("=", 1)
            value = value.strip().strip("\"'")
            if any(word in key.upper() for word in ["KEY", "TOKEN", "SECRET"]) and len(value) >= 12:
                secrets.append(value.encode())
    manifest = {}
    for file in files:
        content = file.read_bytes()
        if any(secret in content for secret in secrets):
            raise RuntimeError(f"Refusing to export a credential-bearing file: {file.relative_to(ROOT)}")
        relative = file.relative_to(ROOT)
        manifest[str(relative)] = hashlib.sha256(content).hexdigest()
    if destination.exists():
        existing = {str(p.relative_to(destination)) for p in destination.rglob("*") if p.is_file()}
        allowed = set(manifest) | {"SUBMISSION_MANIFEST.json"}
        if not existing <= allowed:
            raise RuntimeError("Output folder contains extra files; choose a new --output-dir.")
    for file in files:
        target = destination / file.relative_to(ROOT)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file, target)
    (destination / "SUBMISSION_MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n")
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as output:
        for file in sorted(destination.rglob("*")):
            if file.is_file():
                output.write(file, Path(destination.name) / file.relative_to(destination))
    print(f"Prepared {len(files)} source/assets files plus a SHA-256 manifest.")
    print("Folder:", destination)
    print("Archive:", archive)
    print("Credential exclusion check passed. No Git history is included.")


if __name__ == "__main__":
    main()
