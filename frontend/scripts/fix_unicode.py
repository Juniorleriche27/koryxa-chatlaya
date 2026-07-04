import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET_DIRS = [ROOT / "app", ROOT / "components", ROOT / "hooks", ROOT / "lib", ROOT / "styles"]

pattern = re.compile(r"\\u([0-9A-Fa-f]{4})")

def decode_escapes(text: str) -> str:
    def repl(m):
        code = int(m.group(1), 16)
        return chr(code)
    return pattern.sub(repl, text)

changed = []
def iter_files():
    for base in TARGET_DIRS:
        if base.exists():
            yield from base.rglob("*")

for path in iter_files():
    if not path.is_file():
        continue
    if path.suffix.lower() not in {".ts", ".tsx", ".js", ".jsx", ".css", ".json"}:
        continue
    try:
        src = path.read_text(encoding="utf-8")
    except Exception:
        continue
    dst = decode_escapes(src)
    if dst != src:
        path.write_text(dst, encoding="utf-8")
        changed.append(path.relative_to(ROOT).as_posix())

if changed:
    print("Updated:")
    for f in changed:
        print(" -", f)
else:
    print("No changes")
