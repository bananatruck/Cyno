#!/usr/bin/env python3
"""Build src/data/catalog.json from published catalogs.

Sources (downloaded by this script, never typed by hand):
- IAU Catalog of Star Names (IAU-CSN), WGSN, https://www.pas.rochester.edu/~emamajek/WGSN/IAU-CSN.txt
  Used for named stars with V <= STAR_MAG_LIMIT: name, J2000 RA/Dec (degrees), V magnitude.
- OpenNGC by Mattia Verga, https://github.com/mattiaverga/OpenNGC (CC-BY-SA-4.0)
  Used for the Messier objects: J2000 RA/Dec, V magnitude (B when V is missing), type, size, common name.
- Harris, Catalog of Parameters for Milky Way Globular Clusters (2010 edition), https://physics.mcmaster.ca/~harris/mwgc.dat
  Used only to fill the integrated V magnitude (Part II, column 7) of globular clusters that OpenNGC leaves blank.
- NGC 2000.0 (Dreyer, ed. R. W. Sinnott, 1988), as served by NASA HEASARC's Xamin service (table ngc2000):
  used only for the visual magnitude of objects still without one after the sources above (M35 = NGC 2168).

Run: python3 -I scripts/build-catalog.py   (from packages/engine)
The output file is generated; edit this script, not the JSON.
"""
import csv
import hashlib
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

OPENNGC_COMMIT = "be3cd6c5498806a2fbb2f7e0452ef802dbb02be0"
IAU_URL = "https://www.pas.rochester.edu/~emamajek/WGSN/IAU-CSN.txt"
NGC_URL = f"https://raw.githubusercontent.com/mattiaverga/OpenNGC/{OPENNGC_COMMIT}/database_files/NGC.csv"
ADD_URL = f"https://raw.githubusercontent.com/mattiaverga/OpenNGC/{OPENNGC_COMMIT}/database_files/addendum.csv"
HARRIS_URL = "https://physics.mcmaster.ca/~harris/mwgc.dat"
HEASARC_URL = "https://heasarc.gsfc.nasa.gov/xamin/query?table=ngc2000&position={ra},{dec}&radius=5&format=text"
# The HEASARC text response includes run-time messages, so it is pinned by value instead of by hash
# (value read on 2026-11-18): designation -> visual magnitude.
EXPECTED_NGC2000_VMAG = {"NGC2168": 5.1}
STAR_MAG_LIMIT = 2.5
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "catalog.json"

# SHA-256 of upstream files without versioned URLs (computed 2026-11-17).
PINNED_SHA256 = {
    "IAU-CSN": "84fac0c90f1b19abc491c2793469e0caa7b003ad1bc93a790ca41147010d0eb0",
    "Harris 2010": "b457a690adc422fb2e8e05a23e1de50b62d1d5ac10dce99963c956c1b17ca658",
}

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


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "cyno-catalog-build"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch_pinned(name: str, url: str) -> str:
    data = fetch(url)
    digest = sha256(data)
    expected = PINNED_SHA256.get(name)
    if expected and digest != expected:
        print(
            f"Refusing to build: {name} SHA-256 mismatch.\n"
            f"  expected (in script): {expected}\n"
            f"  downloaded:           {digest}\n"
            f"Update PINNED_SHA256 deliberately if the upstream file changed.",
            file=sys.stderr,
        )
        sys.exit(1)
    return data.decode("utf-8")


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


def ngc2000_vmag(designation: str, ra_deg: float, dec_deg: float) -> float | None:
    """Visual magnitude of one NGC object from NGC 2000.0 via HEASARC, or None if it has none.

    Rows with an app_mag_flag (photographic magnitude) are not used. The result must match
    EXPECTED_NGC2000_VMAG, so a rerun cannot silently change the catalog.
    """
    text = fetch(HEASARC_URL.format(ra=f"{ra_deg:.4f}", dec=f"{dec_deg:.4f}")).decode("utf-8")
    lines = [line for line in text.splitlines() if "|" in line]
    if not lines:
        return None
    header = [h.strip() for h in lines[0].split("|")]
    want = re.sub(r"^NGC0*", "NGC ", designation)
    value = None
    for line in lines[1:]:
        row = dict(zip(header, (c.strip() for c in line.split("|"))))
        if row.get("name") == want and row.get("app_mag_flag") in ("", "null"):
            value = float(row["app_mag"])
    expected = EXPECTED_NGC2000_VMAG.get(designation)
    if value != expected:
        print(
            f"Refusing to build: NGC 2000.0 magnitude for {designation} is {value}, expected {expected}.\n"
            "Update EXPECTED_NGC2000_VMAG deliberately if HEASARC's table changed.",
            file=sys.stderr,
        )
        sys.exit(1)
    return value


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
        if not mag_s and r["Name"] in EXPECTED_NGC2000_VMAG:
            v = ngc2000_vmag(r["Name"], hms_to_deg(r["RA"]), dms_to_deg(r["Dec"]))
            if v is not None:
                mag_s, band, mag_src = str(v), "V", "NGC 2000.0 (HEASARC)"
        if not mag_s:
            skipped.append(f"M{k} ({r['Name']}): no magnitude in OpenNGC, Harris 2010 or NGC 2000.0")
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
    s = stars(fetch_pinned("IAU-CSN", IAU_URL))
    ngc = fetch(NGC_URL).decode("utf-8")
    add = fetch(ADD_URL).decode("utf-8")
    m, skipped = messier(ngc, add, harris_vt(fetch_pinned("Harris 2010", HARRIS_URL)))
    doc = {
        "_generated": "by scripts/build-catalog.py; do not edit by hand",
        "sources": {
            "IAU-CSN": IAU_URL,
            "OpenNGC": f"https://github.com/mattiaverga/OpenNGC @ {OPENNGC_COMMIT} (CC-BY-SA-4.0), {NGC_URL}",
            "Harris 2010": HARRIS_URL,
            "NGC 2000.0 (HEASARC)": "https://heasarc.gsfc.nasa.gov/W3Browse/all/ngc2000.html",
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