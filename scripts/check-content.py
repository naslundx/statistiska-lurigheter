#!/usr/bin/env python3
"""Validate content.json for Statistiska lurigheter.

Checks that the file is valid JSON and that its structure matches what the
app expects. Run manually any time you edit the content:

    python3 scripts/check-content.py
    # or, if executable:
    ./scripts/check-content.py

Exits 0 when everything is OK, 1 when problems are found.
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content.json")

VALID_SERIES = {"points", "line", "bars"}

errors = []
warnings = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def check_graph(graph, where):
    if not isinstance(graph, dict):
        err(f"{where}: graph must be an object")
        return

    legend = graph.get("legend")
    if legend is not None:
        if not isinstance(legend, list):
            err(f"{where}: legend must be a list")
        else:
            for i, item in enumerate(legend):
                if not isinstance(item, dict) or "color" not in item or "label" not in item:
                    err(f"{where}.legend[{i}]: needs 'color' and 'label'")

    for axis in ("xEnds", "yEnds"):
        ends = graph.get(axis)
        if ends is not None and not (isinstance(ends, list) and len(ends) == 2):
            err(f"{where}: {axis} must be [minLabel, maxLabel]")

    # Icon-grid graphs have their own shape (no axes/series).
    if "iconGrid" in graph:
        grid = graph["iconGrid"]
        if not isinstance(grid, dict):
            err(f"{where}: iconGrid must be an object")
            return
        groups = grid.get("groups")
        if not isinstance(groups, list) or not groups:
            err(f"{where}: iconGrid.groups must be a non-empty list")
            return
        for gi, g in enumerate(groups):
            if not isinstance(g, dict) or "color" not in g or not isinstance(g.get("count"), int):
                err(f"{where}.iconGrid.groups[{gi}]: needs 'color' and integer 'count'")
        return

    for axis in ("xRange", "yRange"):
        r = graph.get(axis)
        if not (isinstance(r, list) and len(r) == 2 and all(isinstance(n, (int, float)) for n in r)):
            err(f"{where}: graph.{axis} must be [min, max] numbers")
    for si, series in enumerate(graph.get("series", [])):
        w = f"{where}.series[{si}]"
        if series.get("type") not in VALID_SERIES:
            err(f"{w}: type must be one of {sorted(VALID_SERIES)}")
        data = series.get("data")
        if not isinstance(data, list) or not data:
            err(f"{w}: data must be a non-empty list")
            continue
        for point in data:
            if not (isinstance(point, list) and 2 <= len(point) <= 3 and all(isinstance(n, (int, float)) for n in point)):
                err(f"{w}: each datum must be [x, y] or [x, y, error] numbers")
                break


def check_options(opts, where, question_ids):
    if not isinstance(opts, dict):
        err(f"{where}: options must be an object")
        return
    qid = opts.get("id")
    if not qid:
        err(f"{where}: options needs an 'id'")
    else:
        question_ids.add(qid)
    choices = opts.get("choices")
    if not (isinstance(choices, list) and len(choices) >= 2):
        err(f"{where}: options needs at least 2 choices")
    values = set()
    for c in choices or []:
        values.add(c["value"] if isinstance(c, dict) else c)
    if "correct" in opts and opts["correct"] not in values:
        warn(f"{where}: 'correct' ({opts['correct']!r}) is not one of the choices")
    for key in (opts.get("reveal") or {}):
        if key != "*" and key not in values:
            warn(f"{where}: reveal key {key!r} matches no choice")


def check_line(line, where, question_ids):
    if isinstance(line, str):
        return
    if isinstance(line, dict):
        if "graph" in line:
            check_graph(line["graph"], where)
        elif "options" in line:
            check_options(line["options"], where, question_ids)
        else:
            warn(f"{where}: object line has neither 'graph' nor 'options'")
    else:
        err(f"{where}: line must be a string or object")


def check_topic(topic, ti):
    where = f"topics[{ti}]"
    if not topic.get("title"):
        err(f"{where}: missing 'title'")
    parts = topic.get("parts")
    if not isinstance(parts, list) or not parts:
        err(f"{where}: 'parts' must be a non-empty list")
        return

    question_ids = set()
    # First pass: collect question ids so showIf can reference later parts too.
    for part in parts:
        for line in part.get("lines", []):
            if isinstance(line, dict) and "options" in line:
                oid = line["options"].get("id")
                if oid:
                    question_ids.add(oid)

    for pi, part in enumerate(parts):
        pw = f"{where}.parts[{pi}]"
        if not isinstance(part.get("lines"), list):
            err(f"{pw}: 'lines' must be a list")
            continue
        show_if = part.get("showIf")
        if show_if is not None:
            if not isinstance(show_if, dict) or "question" not in show_if or "equals" not in show_if:
                err(f"{pw}: showIf must be {{question, equals}}")
            elif show_if["question"] not in question_ids:
                warn(f"{pw}: showIf references unknown question {show_if['question']!r}")
        for li, line in enumerate(part["lines"]):
            check_line(line, f"{pw}.lines[{li}]", question_ids)


def main():
    try:
        with open(CONTENT, encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"✗ content.json not found at {CONTENT}")
        return 1
    except json.JSONDecodeError as e:
        print(f"✗ Invalid JSON: {e}")
        return 1

    for key in ("site", "intro", "outro", "topics"):
        if key not in data:
            err(f"missing top-level key: {key}")

    topics = data.get("topics", [])
    if not isinstance(topics, list) or not topics:
        err("'topics' must be a non-empty list")
    else:
        for ti, topic in enumerate(topics):
            check_topic(topic, ti)

    for w in warnings:
        print(f"⚠ {w}")
    for e in errors:
        print(f"✗ {e}")

    if errors:
        print(f"\n✗ content.json has {len(errors)} error(s), {len(warnings)} warning(s).")
        return 1

    titles = ", ".join(t.get("title", "?") for t in topics)
    print(f"✓ content.json OK — {len(topics)} topics: {titles}")
    if warnings:
        print(f"  ({len(warnings)} warning(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
