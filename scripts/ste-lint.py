#!/usr/bin/env python3
"""Root entry point for the ASD-STE100 linter.

The implementation lives in docs/skills/asd-ste100/scripts/ste-lint.py.
This thin wrapper keeps `pnpm lint:ste` working from the repository root.
"""
import os
import runpy
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, "..", "docs", "skills", "asd-ste100", "scripts", "ste-lint.py")

if __name__ == "__main__":
    sys.argv[0] = TARGET
    runpy.run_path(TARGET, run_name="__main__")
