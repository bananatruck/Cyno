#!/usr/bin/env python3
"""Build src/data/catalog.json from two published catalogs.

Sources (downloaded by this script, never typed by hand):
- IAU Catalog of Star Names (IAU-CSN), WGSN, https://www.pas.rochester.edu/~emamajek/WGSN/IAU-CSN.txt
  Used for named stars with V <= STAR_MAG_LIMIT: name, J2000 RA/Dec (degrees), V magnitude.
- OpenNGC by Mattia Verga, https://github.com/mattiaverga/OpenNGC (CC-BY-SA-4.0)
  Used for the Messier objects: J2000 RA/Dec, V magnitude (B when V is missing), type, size, common name.
- Harris, Catalog of Parameters for Milky Way Globular Clusters (2010 edition), https://physics.mcmaster.ca/~harris/mwgc.dat
  Used only to fill the integrated V magnitude (Part II, column 7) of globular clusters that OpenNGC leaves blank.

Run: python3 -I scripts/build-catalog.py   (from packages/engine)
The output file is generated; edit this script, not the JSON.
"""
import csv
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

IAU_URL = "https://www.pas.rochester.edu/~emamajek/WGSN/IAU-CSN.txt"
NGC_URL = "https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv"
ADD_URL = "https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/addendum.csv"
HARRIS_URL = "https://physics.mcmaster.ca/~harris/mwgc.dat"
STAR_MAG_LIMIT = 2.5
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "catalog.json"

# OpenNGC type codes -> engine object kinds.
TYPE_KIND = {
    "OCl": "open-cluster",
    "GCl": "globular-cluster",
    "Cl+N": "nebula",
    "Neb": "nebula",
    "HII": "nebula",
    "EmN": "nebula",
    "RfN": "nebula",
    "SNR": "nebula",
    "PN": "planetary-nebula",
    "G": "galaxy",
    "GPair": "galaxy",
    "*Ass": "open-cluster",
    "**": "double-star",
    "Other": "other",
}

STAR_RE = re.compile(
    r"^(?P<name>.{17}) .{17} .{12} \S+\s+\S+\s+(?P<con>\S+)\s+\S+\s+\S+\s+"
    r"(?P<mag>-?\d+\.\d+)\s+(?P<band>\S+)\s+\S+\s+\S+\s+"
    r"(?P<ra>\d+\.\d+)\s+(?P<dec>-?\d+\.\d+)\s+\d{4}-\d\d-\d\d"
)


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "cyno-catalog-build"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")


def hms_to_deg(s: str) -> float:
    h, m, sec = (float(x) for x in s.split(":"))
    return 15.0 * (h + m / 60 + sec / 3600)


def dms_to_deg(s: str) -> float:
    sign = -1.0 if s.startswith("-") else 1.0
    d, m, sec = (float(x) for x in s.lstrip("+-").split(":"))
    return sign * (d + m / 60 + sec / 3600)


def stars(text: str) -> list[dict]:
    out = []
    for line in text.splitlines():
        if line.startswith("#") or not line.strip():
            continue
        m = STAR_RE.match(line)
        if not m or m["band"] != "V":
            continue
        mag = float(m["mag"])
        if mag > STAR_MAG_LIMIT:
            continue
        name = m["name"].strip()
        out.append({
            "id": "star-" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"),
            "name": name,
            "kind": "star",
            "raDeg": float(m["ra"]),
            "decDeg": float(m["dec"]),
            "mag": mag,
            "magBand": "V",
            "constellation": m["con"],
            "source": "IAU-CSN",
        })
    return sorted(out, key=lambda s: s["mag"])


def harris_vt(text: str) -> dict[str, float]:
    """Integrated V magnitude by NGC designation (e.g. "NGC6656"), from Part II of the Harris catalog."""
    part2 = text.split("Part II:")[1].split("Part III:")[0]
    out = {}
    for line in part2.splitlines():
        m = re.match(r"\s*NGC\s+(\d+)\s+(.*)$", line)
        if not m:
            continue
        cols = m[2].split()
        # cols[0]=[Fe/H] cols[1]=weight cols[2]=E(B-V) cols[3]=V_HB cols[4]=(m-M)V cols[5]=V_t
        if len(cols) > 5:
            try:
                out["NGC" + m[1].zfill(4)] = float(cols[5])
            except ValueError:
                pass
    return out


def messier(ngc_text: str, add_text: str, vt: dict[str, float]) -> tuple[list[dict], list[str]]:
    rows = []
    for text in (ngc_text, add_text):
        rows.extend(r for r in csv.DictReader(io.StringIO(text), delimiter=";") if r["M"])
    by_m: dict[int, dict] = {}
    for r in rows:
        k = int(r["M"])
        # M102 has no agreed identification; OpenNGC files it under M101's galaxy. Keep the first row only.
        by_m.setdefault(k, r)
    out, skipped = [], []
    for k in sorted(by_m):
        r = by_m[k]
        mag_s, band, mag_src = (r["V-Mag"], "V", "OpenNGC") if r["V-Mag"] else (r["B-Mag"], "B", "OpenNGC")
        if not mag_s and r["Type"] == "GCl" and r["Name"] in vt:
            mag_s, band, mag_src = str(vt[r["Name"]]), "V", "Harris 2010"
        if not mag_s:
            skipped.append(f"M{k} ({r['Name']}): no V or B magnitude in OpenNGC")
            continue
        common = r["Common names"].split(",")[0].strip() if r["Common names"] else ""
        out.append({
            "id": f"m{k}",
            "name": f"M{k}" + (f" {common}" if common else ""),
            "messier": k,
            "designation": r["Name"],
            "kind": TYPE_KIND.get(r["Type"], "other"),
            "raDeg": round(hms_to_deg(r["RA"]), 6),
            "decDeg": round(dms_to_deg(r["Dec"]), 6),
            "mag": float(mag_s),
            "magBand": band,
            "magSource": mag_src,
            "sizeArcmin": float(r["MajAx"]) if r["MajAx"] else None,
            "constellation": r["Const"],
            "source": "OpenNGC",
        })
    return out, skipped


def main() -> int:
    s = stars(fetch(IAU_URL))
    m, skipped = messier(fetch(NGC_URL), fetch(ADD_URL), harris_vt(fetch(HARRIS_URL)))
    doc = {
        "_generated": "by scripts/build-catalog.py; do not edit by hand",
        "sources": {
            "IAU-CSN": IAU_URL,
            "OpenNGC": "https://github.com/mattiaverga/OpenNGC (CC-BY-SA-4.0), " + NGC_URL,
            "Harris 2010": HARRIS_URL,
        },
        "starMagLimit": STAR_MAG_LIMIT,
        "skipped": skipped,
        "stars": s,
        "deepSky": m,
    }
    OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT}: {len(s)} stars, {len(m)} Messier objects, {len(skipped)} skipped", file=sys.stderr)
    for line in skipped:
        print("  skipped " + line, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
