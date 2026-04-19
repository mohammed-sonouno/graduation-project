"""
Load chat ML exports (NDJSON) for offline training.
No runtime dependency on the Node server.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterator, Optional


def iter_jsonl(path: str | Path) -> Iterator[dict[str, Any]]:
    p = Path(path)
    with p.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def load_all(path: str | Path, limit: Optional[int] = None) -> list[dict[str, Any]]:
    rows = []
    for i, row in enumerate(iter_jsonl(path)):
        if limit is not None and i >= limit:
            break
        rows.append(row)
    return rows


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python load_jsonl.py <file.jsonl> [limit]", file=sys.stderr)
        sys.exit(1)
    lim = int(sys.argv[2]) if len(sys.argv) > 2 else None
    for row in load_all(sys.argv[1], lim):
        print(row.get("id"), row.get("outcome"), row.get("intent") or row.get("detected_intent"))
