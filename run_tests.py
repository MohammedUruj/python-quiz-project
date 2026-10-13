#!/usr/bin/env python3
"""Run all automated tests:  python run_tests.py

- Python server tests (always).
- JavaScript game-logic tests (only if Node.js 18+ is installed; optional).
"""

import glob
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main():
    print("== Server tests (Python) ==")
    suite = unittest.defaultTestLoader.discover(str(ROOT / "tests"), top_level_dir=str(ROOT))
    ok = unittest.TextTestRunner(verbosity=1).run(suite).wasSuccessful()

    node = shutil.which("node")
    if node:
        print("\n== Game logic tests (Node.js) ==")
        files = sorted(glob.glob(str(ROOT / "tests" / "js" / "*.test.mjs")))
        ok = subprocess.run([node, "--test", *files], cwd=ROOT).returncode == 0 and ok
    else:
        print("\n(Node.js not found: skipping the optional JavaScript logic tests.)")

    print("\nALL TESTS PASSED" if ok else "\nSOME TESTS FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
