#!/usr/bin/env python3
"""Assert every element id the scripts reach for actually exists in index.html.

Written after a redesign deleted `runBtn` and `runNote` from the page but left
`renderConnection()` dereferencing them. That threw on EVERY load and nobody
noticed, because `loadEnv()` is async and unawaited: the failure surfaced as an
unhandled promise rejection after every visible element had already rendered.
The page looked perfect and was broken.

A static check catches exactly that class and needs no browser and no deps —
the same bargain the contrast check makes. It cannot catch an id created at
runtime, so ids built by string concatenation are reported and skipped rather
than silently passed.
"""
import re, sys, pathlib

root = pathlib.Path(__file__).resolve().parents[2]
html = (root / "index.html").read_text(encoding="utf-8")
present = set(re.findall(r'\bid="([^"]+)"', html))

LITERAL = re.compile(r"""getElementById\(\s*(['"])([^'"]+)\1\s*\)""")
DYNAMIC = re.compile(r"""getElementById\(\s*(?!['"])""")

missing, dynamic, checked = [], [], 0
for name in ("helpers.js", "solution.js"):
    path = root / name
    if not path.exists():
        continue
    src = path.read_text(encoding="utf-8")
    for lineno, line in enumerate(src.splitlines(), 1):
        for _, ident in LITERAL.findall(line):
            checked += 1
            if ident not in present:
                missing.append((name, lineno, ident))
        if DYNAMIC.search(line):
            dynamic.append((name, lineno))

print(f"########## index.html — {checked} element lookup(s) checked "
      f"against {len(present)} id(s) in the page")

for name, lineno, ident in dynamic:
    print(f"  NOT CHECKED  {name}:{lineno}  getElementById(<expression>) — cannot be resolved statically")

if missing:
    for name, lineno, ident in missing:
        print(f"  MISSING      {name}:{lineno}  getElementById('{ident}') — no such id in index.html")
    print(f"\n{len(missing)} lookup(s) target an element the page does not contain.")
    sys.exit(1)

print("  every lookup resolves")
