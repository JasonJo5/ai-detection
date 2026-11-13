#!/usr/bin/env python3
"""Refresh assets/js/publications.js from Prof. Kumar's Google Scholar profile.

Runs weekly through GitHub Actions (.github/workflows/update-publications.yml).
Uses SerpApi when a SERPAPI_KEY secret is set (most reliable); otherwise reads
the public Scholar profile page directly. If Scholar cannot be reached, the
existing file is left unchanged.
"""
import datetime
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request

SCHOLAR_ID = "eoWbI1oAAAAJ"
FROM_YEAR = 2026  # every publication from this year onward is shown

# Older papers to keep on the site (matched by title, case-insensitive)
PINNED = [
    "Transfer learning for induction motor health monitoring: A brief review",
    "Investigation of transfer learning method for motor fault detection",
]

# Entries on the Scholar profile that are not Prof. Kumar's work
EXCLUDE = [
    "To study the immunotherapeutic potential of MIP",
    "Ontology-based effective information retrieval",
    "Solution of linear electrical circuit problem using neural networks",
    "Partial Discharge in Solid Insulating Materials",
]

# Lab students as their names appear on Scholar; papers with them get a "Student-led" badge
STUDENTS = ["MH Shawon", "C Purkaystha", "YN Gandhi", "K Ebrahim"]

# Full names for venues that Scholar shortens with "…"
VENUE_FIX = {
    "International Journal of Precision Engineering and Manufacturing-Green":
        "International Journal of Precision Engineering and Manufacturing-Green Technology",
    "2026 IEEE 4th International Conference on Power Electronics & IoT":
        "2026 IEEE 4th International Conference on Power Electronics & IoT Applications in Renewable Energy and its Control",
}

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "js", "publications.js")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def clean(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def from_serpapi(key):
    rows, start, stats = [], 0, None
    while True:
        q = urllib.parse.urlencode({"engine": "google_scholar_author", "author_id": SCHOLAR_ID, "hl": "en",
                                    "sort": "pubdate", "num": 100, "start": start, "api_key": key})
        data = json.loads(fetch("https://serpapi.com/search.json?" + q))
        if stats is None:
            table = (data.get("cited_by") or {}).get("table") or []
            pick = lambda k: next((t[k]["all"] for t in table if k in t), None)
            stats = {"citations": pick("citations"), "hIndex": pick("h_index"), "i10": pick("i10_index")}
        arts = data.get("articles") or []
        for a in arts:
            rows.append({"title": a.get("title", ""), "authors": a.get("authors", ""), "venue": a.get("publication", ""),
                         "year": str(a.get("year", "")), "cites": int(((a.get("cited_by") or {}).get("value")) or 0)})
        if len(arts) < 100:
            break
        start += 100
    return rows, stats


def from_scholar():
    rows, start, stats = [], 0, None
    while True:
        url = ("https://scholar.google.com/citations?hl=en&user=%s&view_op=list_works&sortby=pubdate&cstart=%d&pagesize=100"
               % (SCHOLAR_ID, start))
        page = fetch(url)
        if stats is None:
            nums = re.findall(r'<td class="gsc_rsb_std">(\d+)</td>', page)
            if len(nums) >= 6:
                stats = {"citations": int(nums[0]), "hIndex": int(nums[2]), "i10": int(nums[4])}
        found = re.findall(r'<tr class="gsc_a_tr">(.*?)</tr>', page, re.S)
        for tr in found:
            title = re.search(r'class="gsc_a_at"[^>]*>(.*?)</a>', tr, re.S)
            grays = re.findall(r'<div class="gs_gray">(.*?)</div>', tr, re.S)
            cites = re.search(r'class="gsc_a_ac[^"]*"[^>]*>(.*?)</a>', tr, re.S)
            year = re.search(r'class="gsc_a_h gsc_a_hc gs_ibl">(.*?)</span>', tr, re.S)
            venue = re.sub(r'<span class="gs_oph">.*?</span>', "", grays[1]) if len(grays) > 1 else ""
            c = clean(cites.group(1)) if cites else ""
            rows.append({"title": clean(title.group(1)) if title else "", "authors": clean(grays[0]) if grays else "",
                         "venue": clean(venue), "year": clean(year.group(1)) if year else "",
                         "cites": int(c) if c.isdigit() else 0})
        if len(found) < 100:
            break
        start += 100
    return rows, stats


def fmt_authors(raw):
    names = [n.strip() for n in raw.split(",") if n.strip()]
    truncated = bool(names) and names[-1] in ("...", "…")
    if truncated:
        names = names[:-1]
    out = []
    for n in names:
        parts = n.split()
        if len(parts) >= 2 and parts[0].isupper() and len(parts[0]) <= 4:
            out.append("%s, %s" % (" ".join(parts[1:]), " ".join(c + "." for c in parts[0])))
        else:
            out.append(n)
    if truncated:
        return ", ".join(out) + ", et al."
    if len(out) <= 1:
        return "".join(out)
    if len(out) == 2:
        return "%s, & %s" % (out[0], out[1])
    return ", ".join(out[:-1]) + ", & " + out[-1]


def fmt_venue(v):
    v = v.strip()
    if v.endswith("…") or v.endswith("..."):
        base = v.rstrip(".… ").strip()
        v = VENUE_FIX.get(base, base)
    v = re.sub(r"^(.*?)\s+(\d+)\s*\((\d+)\),\s*(.+)$", r"\1, \2(\3), \4", v)
    v = re.sub(r"^(.*?[A-Za-z)])\s+(\d+),\s*(.+)$", r"\1, \2, \3", v)
    return v


def journal(v):
    if re.search(r"\b(conference|proceedings|symposium|workshop)\b", v, re.I):
        return "Conference paper"
    m = re.match(r"^(.*?)(,|\s+\d)", v)
    return (m.group(1) if m else v).strip()


def build(rows, stats):
    excl = [norm(x) for x in EXCLUDE]
    pinned = [norm(x) for x in PINNED]
    keep = [r for r in rows if r["title"] and not any(norm(r["title"]).startswith(e) for e in excl)]

    def item(r):
        venue = fmt_venue(r["venue"])
        return {"year": r["year"], "title": r["title"], "authors": fmt_authors(r["authors"]), "venue": venue,
                "journal": journal(venue), "cites": r["cites"],
                "student": any(s.lower() in r["authors"].lower() for s in STUDENTS)}

    pubs = [item(r) for r in keep
            if (r["year"].isdigit() and int(r["year"]) >= FROM_YEAR) or norm(r["title"]) in pinned]
    cited = [item(r) for r in sorted(keep, key=lambda r: -r["cites"])[:4]]
    return {"updated": datetime.date.today().isoformat(), "profile": "https://scholar.google.com/citations?user=" + SCHOLAR_ID,
            "stats": stats, "publications": pubs, "mostCited": cited}


def write(data):
    body = ("/* Generated from Google Scholar by scripts/update_publications.py. Do not edit by hand:\n"
            "   change FROM_YEAR, PINNED, EXCLUDE or STUDENTS in the script instead. */\n"
            "window.SCHOLAR = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
    old = open(OUT, encoding="utf-8").read() if os.path.exists(OUT) else ""
    strip = lambda s: re.sub(r'"updated": "[^"]*"', "", s)
    if strip(old) == strip(body):
        print("No changes.")
        return
    open(OUT, "w", encoding="utf-8").write(body)
    print("Updated %s: %d publications, stats %s" % (OUT, len(data["publications"]), data["stats"]))


def main():
    key = os.environ.get("SERPAPI_KEY", "").strip()
    try:
        rows, stats = from_serpapi(key) if key else from_scholar()
    except Exception as e:  # network error, block, CAPTCHA
        print("::warning::Could not read Google Scholar (%s). Site left unchanged." % e)
        return 0
    if not rows or not stats or stats.get("citations") is None:
        print("::warning::Google Scholar returned no data (probably blocked). Site left unchanged.")
        return 0
    write(build(rows, stats))
    return 0


if __name__ == "__main__":
    sys.exit(main())
