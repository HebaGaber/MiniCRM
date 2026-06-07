#!/usr/bin/env python3
"""
bmad_to_github.py — sync BMAD epics/stories to GitHub Issues + Projects.

Mapping:
  Epic   -> one issue (label `epic`)  + a milestone, added to the Project board
  Feature-> one issue (label `feature`), sub-issue of its Epic
  Story  -> one issue (label `story`),   sub-issue of its Feature

Hierarchy is built with the GitHub sub-issues API, which requires the child's
database `id` (NOT its issue number) — handled below. Idempotent: existing issues
(matched by exact title) are reused, so re-running won't create duplicates.

Run inside Claude Code (gh must be authenticated: `gh auth login`).
Usage:
  python3 bmad_to_github.py            # create/sync
  python3 bmad_to_github.py --dry-run  # print what it would do, change nothing
"""

import json
import subprocess
import sys
from pathlib import Path

# ----------------------------------------------------------------------------- config
REPO            = "hebagaber/MiniCRM"     # <owner>/<repo>  -- EDIT if different
OWNER           = "hebagaber"             # owner of the GitHub Project (user or org)
PROJECT_NUMBER  = "1"                     # your GitHub Project number  -- EDIT
EPICS_DIR       = Path("_bmad-output/planning-artifacts/epics")
INCLUDE_PRODUCTION = False                # False = skip `cut: production` (Epic 6); True = include
DRY_RUN         = "--dry-run" in sys.argv
# -----------------------------------------------------------------------------

def gh(args, parse=True, ok_fail=False):
    """Run a gh command; return parsed JSON (or text)."""
    if DRY_RUN and args[:1] == ["api"] and ("--method" in args or "-X" in args or "POST" in args):
        print("  [dry-run] gh", " ".join(args)); return {}
    try:
        out = subprocess.run(["gh", *args], capture_output=True, text=True, check=True).stdout
    except subprocess.CalledProcessError as e:
        if ok_fail:
            return None
        print("gh error:", e.stderr.strip()); raise
    if not parse or not out.strip():
        return out
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return out

# --- frontmatter parse (only the keys we need) -------------------------------
def parse_frontmatter(path):
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return {}
    fm = text.split("---", 2)[1]
    data = {}
    for line in fm.splitlines():
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        data[k] = v
    return data

# --- gh helpers --------------------------------------------------------------
def ensure_label(name, color, desc):
    gh(["label", "create", name, "--repo", REPO, "--color", color, "--description", desc],
       parse=False, ok_fail=True)

def ensure_milestone(title):
    ms = gh(["api", f"repos/{REPO}/milestones", "--paginate"]) or []
    for m in ms:
        if m.get("title") == title:
            return m["number"]
    if DRY_RUN:
        print(f"  [dry-run] create milestone: {title}"); return 0
    return gh(["api", f"repos/{REPO}/milestones", "-f", f"title={title}"])["number"]

def load_existing_issues():
    """title -> {'number':, 'id':} so re-runs reuse instead of duplicating."""
    issues = gh(["issue", "list", "--repo", REPO, "--state", "all", "--limit", "500",
                 "--json", "number,title,id"]) or []
    return {i["title"]: {"number": i["number"], "id": i["id"]} for i in issues}

def create_issue(title, body, label, milestone_number, existing):
    if title in existing:
        return existing[title]["number"], existing[title]["id"]
    if DRY_RUN:
        print(f"  [dry-run] create issue [{label}]: {title}")
        existing[title] = {"number": 0, "id": 0}; return 0, 0
    args = ["api", f"repos/{REPO}/issues", "-f", f"title={title}", "-f", f"body={body}",
            "-f", f"labels[]={label}"]
    if milestone_number:
        args += ["-F", f"milestone={milestone_number}"]
    res = gh(args, )
    num, iid = res["number"], res["id"]
    existing[title] = {"number": num, "id": iid}
    return num, iid

def link_sub_issue(parent_number, child_id):
    # child_id MUST be the issue database id, not its number
    gh(["api", "--method", "POST", f"repos/{REPO}/issues/{parent_number}/sub_issues",
        "-F", f"sub_issue_id={child_id}"], parse=False, ok_fail=True)

def add_to_board(issue_number):
    gh(["project", "item-add", PROJECT_NUMBER, "--owner", OWNER,
        "--url", f"https://github.com/{REPO}/issues/{issue_number}"],
       parse=False, ok_fail=True)

# --- build hierarchy from story frontmatter ----------------------------------
def build_tree():
    """{epic_title: {'cut':, 'features': {feature_title: [ (story_id, story_title, path, fm) ]}}}"""
    tree = {}
    for path in sorted(EPICS_DIR.rglob("E*-S*.md")):
        fm = parse_frontmatter(path)
        epic = fm.get("epic"); feature = fm.get("feature"); sid = fm.get("id")
        if not (epic and feature and sid):
            print(f"  ! skipping (missing frontmatter): {path}"); continue
        cut = fm.get("cut", "pilot")
        if cut == "production" and not INCLUDE_PRODUCTION:
            continue
        tree.setdefault(epic, {"cut": cut, "features": {}})
        tree[epic]["features"].setdefault(feature, []).append(
            (sid, fm.get("title", sid), path, fm))
    return tree

def main():
    if not EPICS_DIR.exists():
        sys.exit(f"epics dir not found: {EPICS_DIR} (run from the repo root)")

    for name, color, desc in [("epic", "5319E7", "Epic"),
                              ("feature", "1D76DB", "Feature"),
                              ("story", "0E8A16", "Story")]:
        ensure_label(name, color, desc)

    existing = load_existing_issues()
    tree = build_tree()
    n_e = n_f = n_s = 0

    for epic_title, ed in tree.items():
        ms = ensure_milestone(epic_title)
        e_body = (f"**Epic.** Features and stories are linked as sub-issues.\n\n"
                  f"Source: `{EPICS_DIR}/`")
        e_num, e_id = create_issue(epic_title, e_body, "epic", ms, existing)
        add_to_board(e_num); n_e += 1
        print(f"EPIC  #{e_num}  {epic_title}")

        for feat_title, stories in ed["features"].items():
            f_body = f"**Feature** under Epic _{epic_title}_.\n\nStories: " + \
                     ", ".join(s[0] for s in stories)
            f_num, f_id = create_issue(feat_title, f_body, "feature", ms, existing)
            link_sub_issue(e_num, f_id); add_to_board(f_num); n_f += 1
            print(f"  FEAT  #{f_num}  {feat_title}")

            for sid, stitle, path, fm in stories:
                issue_title = f"{sid} — {stitle}"
                deps = fm.get("depends_on", "")
                s_body = (f"**Story `{sid}`** — Feature _{feat_title}_ / Epic _{epic_title}_.\n\n"
                          f"Spec: `{path.as_posix()}`\n"
                          f"Depends on: {deps}\n"
                          f"Cut: {fm.get('cut','pilot')}\n\n"
                          f"_Open a PR with `Closes #{{this issue}}` to close on merge._")
                s_num, s_id = create_issue(issue_title, s_body, "story", ms, existing)
                link_sub_issue(f_num, s_id); add_to_board(s_num); n_s += 1
                print(f"    STORY #{s_num}  {issue_title}")

    print(f"\nDone{' (dry-run)' if DRY_RUN else ''}: {n_e} epics, {n_f} features, {n_s} stories.")

if __name__ == "__main__":
    main()
