"""Build the config.json entry for a NEW Statistik PLN year automatically.

    python3 pln/auto_config.py input/pln/Statistik2026.pdf 2026 pln/config.json [--write] [--report report.md]

How it works
  1. Pages: each table is found by its title ("Tabel 21 ...") on a page that lists units (contains "Aceh").
     A following page without a title that also lists units is a continuation (two-page table).
  2. Layout: the column layouts used in earlier years (keys/split/number of pages) are tried, the most recent
     year first. For two-page tables the split (number of columns on the left page) is also read from the PDF.
  3. Check: every candidate is extracted with pln/extract.py (one table at a time) and scored:
     national row present, number of rows, duplicate units, row sums and Jawa/Luar Jawa column sums.
     The best candidate is kept. Year-specific source fixes (relabel_rows, token_fix, cell_moves, null_cols)
     are NOT carried over: if they are needed, the checks will show it and a person adds them.
Exit code 0 = every table passed all checks; 1 = written, but some tables need review; 2 = could not build.
"""
import json, os, re, subprocess, sys, tempfile, statistics
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
TABLES = {"t01": 1, "t02": 2, "t08": 8, "t16": 16, "t19": 19, "t21": 21, "t23": 23, "t28": 28, "t29": 29, "t30": 30}
TITLE_RE = re.compile(r"(?:Tabel|Table)\s*(?:/\s*Table\s*)?(\d{1,2})\b")
NUM_RE = re.compile(r"^\(?-?[\d.,]+\)?(\*+\))?$|^-$")


def page_texts(pdf):
    n = int(re.search(r"Pages:\s+(\d+)", subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout).group(1))
    out = {}
    for p in range(1, n + 1):
        out[p] = subprocess.run(["pdftotext", "-layout", "-f", str(p), "-l", str(p), pdf, "-"], capture_output=True, text=True).stdout
    return out


def find_pages(texts):
    """table id -> (title page, has continuation page)"""
    found = {}
    for p, t in texts.items():
        if "Aceh" not in t:
            continue
        m = TITLE_RE.search(t)
        if not m:
            continue
        num = int(m.group(1))
        for tid, n in TABLES.items():
            if n == num and tid not in found:
                nxt = texts.get(p + 1, "")
                cont = "Aceh" in nxt and not TITLE_RE.search(nxt)
                found[tid] = (p, cont)
    return found


def left_count(text):
    """Number of values on the national/first-unit rows of a page (= split for two-page tables)."""
    best = 0
    for line in text.splitlines():
        toks = line.split()
        n = 0
        while toks and NUM_RE.match(toks[-1]):
            toks.pop(); n += 1
        name = " ".join(toks)
        if re.match(r"^(UID Aceh|Uid Aceh|Region of Aceh|UIW Aceh|Indonesia|Luar Jawa|Jawa)\b", name):
            best = max(best, n)
    return best


def candidates(cfg, year, tid, pages_found, texts):
    """Ordered list of candidate settings for one table."""
    past = sorted((int(y) for y in cfg if y.isdigit() and int(y) < year), reverse=True)
    layouts, seen = [], set()
    for y in past:
        c = cfg[str(y)].get(tid)
        if not c:
            continue
        key = (tuple(c.get("keys") or ()), c.get("split"), len(c["pages"]))
        if key not in seen:
            seen.add(key); layouts.append((y, key))
    if not past:
        return []
    base = cfg[str(past[0])][tid]
    out = []
    if tid in pages_found:
        p, cont = pages_found[tid]
        page_opts = [[p, p + 1], [p]] if cont else [[p], [p, p + 1]]
    else:   # title not found: shift last year's pages by the typical offset of the tables that were found
        offs = [pages_found[t][0] - cfg[str(past[0])][t]["pages"][0] for t in pages_found if t in cfg[str(past[0])]]
        off = int(statistics.median(offs)) if offs else 0
        page_opts = [[x + off for x in base["pages"]]]
    std = ("standard columns", (), None)   # the toolkit's full standard column set (pln/extract.py), not used by any earlier year
    for pages in page_opts:
        tried_std = False
        for y, (keys, split, npg) in layouts:
            if not keys:
                tried_std = True
            if npg != len(pages):
                continue
            c = {"pages": pages}
            if keys: c["keys"] = list(keys)
            if split: c["split"] = split
            out.append((f"layout {y}", c))
            if len(pages) == 2:   # also try the split read from the PDF itself
                s = left_count(texts.get(pages[0], ""))
                if s and s != split:
                    c2 = dict(c, split=s)
                    out.append((f"layout {y}, split {s} from PDF", c2))
        if not tried_std:
            c = {"pages": pages}
            if len(pages) == 2:
                s = left_count(texts.get(pages[0], ""))
                if not s:
                    continue
                c["split"] = s
            out.append((std[0] + (f", split {c['split']} from PDF" if len(pages) == 2 else ""), c))
    return out


def run_table(pdf, year, tid, c, workdir):
    cfg = {str(year): {tid: c}}
    cfile = os.path.join(workdir, "cfg.json"); json.dump(cfg, open(cfile, "w"))
    out = os.path.join(workdir, "out")
    env = dict(os.environ, PLN_ONLY_TABLES=tid)
    r = subprocess.run([sys.executable, os.path.join(HERE, "extract.py"), pdf, out, str(year), cfile], capture_output=True, text=True, env=env, timeout=300)
    if r.returncode != 0:
        return None, (r.stderr.strip().splitlines() or ["error"])[-1]
    return pd.read_pickle(os.path.join(out, ".wide.pkl")).get(tid), ""


def checks(tid, df):
    """Problems found in one extracted table (same rules as validate.py)."""
    probs = []
    if df is None or not len(df) or "unit_id" not in df:
        return ["no rows"], 0
    if "indonesia" not in set(df.unit_id):
        probs.append("national row (Indonesia) not found")
    dup = df[df.unit_id.duplicated(keep=False)]
    if len(dup):
        probs.append("duplicate unit_id: " + ", ".join(sorted(set(dup.unit_id))[:5]))

    def rowsum(cols, total):
        cols = [c for c in cols if c in df and df[c].notna().any()]
        if total not in df or df[total].isna().all():
            return
        d = df[df[total].notna()].fillna(0)
        bad = [r.unit_name for _, r in d.iterrows() if abs(sum(r[c] for c in cols) - r[total]) > 0.6]
        if bad:
            probs.append(f"row sum {total}: " + ", ".join(bad[:4]) + (" …" if len(bad) > 4 else ""))

    def colsum(cols):
        d = df.fillna(0)
        if not (d.unit_name == "Luar Jawa").any() or not (d.unit_name == "Jawa").any():
            probs.append("Jawa / Luar Jawa rows not found"); return
        for c in cols:
            if c not in d: continue
            for reg in ("Luar Jawa", "Jawa"):
                s = d[(d.region == reg) & ~d.row_type.isin(["province", "regional_total"])][c].sum()
                t = d[d.unit_name == reg][c].iloc[0]
                if abs(s - t) > 1:
                    probs.append(f"column sum {c} ({reg}): units {s:,.2f} vs total {t:,.2f}")

    if tid == "t21":
        own = [c for c in df.columns if c.endswith("_mw") and not c.startswith(("pln_owned", "leased", "ipp", "total"))]
        rowsum(own, "pln_owned_subtotal_mw"); rowsum(["pln_owned_subtotal_mw", "leased_mw", "ipp_mw"], "total_mw")
    if tid == "t23":
        og = [c for c in df.columns if c.startswith(("own_", "leased_")) and not c.startswith("own_and")]
        rowsum(og, "own_and_leased_subtotal_gwh"); rowsum(["own_and_leased_subtotal_gwh", "purchased_and_project_gwh"], "total_gwh")
    if tid == "t28":
        rowsum(["kv_25_30_kms", "kv_70_kms", "kv_150_kms", "kv_275_kms", "kv_500_kms"], "total_kms")
    if tid == "t30":
        rowsum([f"kv_{k}_mva" for k in ["500", "275", "150", "70", "lt30"]], "kv_total_mva")
        rowsum([f"kv_{k}_units" for k in ["500", "275", "150", "70", "lt30"]], "kv_total_units")
    cs = {"t01": ["installed_capacity_mw", "peak_load_mw"], "t21": ["total_mw", "solar_mw"], "t23": ["total_gwh"], "t28": ["total_kms"],
          "t29": ["lv_kms", "mv_15_20kv_kms"], "t30": ["kv_total_mva"], "t02": ["energy_consumption_gwh"],   # net_production: transfers between units, not a simple sum (as run_pln.sh)
          "t19": ["households_thousand", "household_customers"]}
    if tid in cs:
        colsum(cs[tid])
    return probs, len(df)


def prev_rows(cfg_path, prev_year, tid):
    """Rows of this table last year (for the "enough rows" test): from the dashboard file, or a local extraction."""
    here = os.path.dirname(os.path.abspath(cfg_path))
    dash = os.environ.get("PLN_DASHBOARD_DIR", os.path.join(here, "..", "..", "..", "data", "listrik"))
    try:
        import openpyxl
        wb = openpyxl.load_workbook(os.path.join(dash, f"statistik-pln-{prev_year}.xlsx"), read_only=True)
        return sum(1 for r in wb[tid].iter_rows(min_row=2, values_only=True) if any(v is not None for v in r))
    except Exception:
        pass
    try:
        d = os.path.join(here, "..", "work", "pln", str(prev_year), "csv")
        return len(pd.read_csv(os.path.join(d, next(f for f in os.listdir(d) if f.startswith(tid)))))
    except Exception:
        return None


def header_text(text, maxlines=10):
    """Column header lines of a table page (the lines above the first data row), for the review report."""
    out = []
    for line in text.splitlines():
        s = line.strip()
        if re.match(r"^(UID Aceh|Uid Aceh|Region of Aceh|UIW Aceh|Aceh)\b", s):
            break
        toks = s.split()
        if toks and sum(bool(NUM_RE.match(t)) for t in toks) >= max(3, len(toks) - 1):
            break      # first row of numbers on a continuation page
        if s and not re.search(r"Annual Data|Data Tahunan|Statistik PLN|PLN Statistics", s):
            out.append(line.rstrip())
    return out[-maxlines:]


def build(pdf, year, cfg_path, log=print):
    cfg = json.load(open(cfg_path))
    texts = page_texts(pdf)
    found = find_pages(texts)
    past = sorted((int(y) for y in cfg if y.isdigit() and int(y) < year), reverse=True)
    if not past:
        raise SystemExit("config.json has no earlier year to learn from")
    base = cfg[str(past[0])]
    entry, results = {}, {}
    with tempfile.TemporaryDirectory() as wd:
        for tid in TABLES:
            base_rows = prev_rows(cfg_path, past[0], tid)
            best = None
            for label, c in candidates(cfg, year, tid, found, texts):
                df, err = run_table(pdf, year, tid, c, wd)
                if df is None:
                    score, probs, n = (-1, 0, 0), [f"extraction failed: {err}"], 0
                else:
                    probs, n = checks(tid, df)
                    enough = n >= 0.7 * base_rows if base_rows else n >= 20
                    if not enough and "no rows" not in probs:
                        probs = probs + [f"only {n} rows" + (f" (last year {base_rows})" if base_rows else "")]
                    has_nat = "unit_id" in df and "indonesia" in set(df.unit_id)
                    score = (1 if enough else 0, 1 if has_nat else 0, -len(probs), n)
                if best is None or score > best[0]:
                    best = (score, label, c, probs, n)
                if df is not None and not probs:
                    break     # first candidate (most recent layout) that passes everything
            if best is None:
                results[tid] = dict(status="fail", label="-", problems=["table not found in the PDF"], rows=0)
                continue
            score, label, c, probs, n = best
            entry[tid] = c
            results[tid] = dict(status="ok" if not probs else "review", label=label, problems=probs, rows=n,
                                pages=c["pages"], title_found=tid in found, base_rows=base_rows,
                                last_year=dict(year=past[0], **{k: v for k, v in base.get(tid, {}).items() if k in ("pages", "split", "keys")}),
                                headers={p: header_text(texts.get(p, "")) for p in sorted(set(c["pages"]) | {c["pages"][0] + 1}) if p in texts} if probs else {})
            log(f"{tid}: {results[tid]['status']:6} pages {c['pages']} {label}, {n} rows" + (f" | {'; '.join(probs)}" if probs else ""))
    return entry, results


def report_md(year, entry, results):
    lines = [f"### Pengaturan otomatis {year}", "",
             "Halaman tabel ditemukan dari judulnya; tata letak kolom diambil dari tahun sebelumnya lalu diuji.", "",
             "| Tabel | Halaman PDF | Tata letak | Baris | Hasil cek |", "|---|---|---|---|---|"]
    for tid, r in results.items():
        mark = "✅ lolos" if r["status"] == "ok" else ("⚠️ perlu ditinjau" if r["status"] == "review" else "❌ gagal")
        detail = "" if r["status"] == "ok" else "<br>" + "<br>".join(x.replace("|", "/") for x in r["problems"])
        lines.append(f"| {tid.upper()} | {', '.join(map(str, r.get('pages', [])))} | {r['label']} | {r['rows']} | {mark}{detail} |")
    review = {t: r for t, r in results.items() if r["status"] != "ok"}
    if review:
        lines += ["", "<details><summary><b>Untuk bantuan teknis:</b> judul kolom di PDF vs pengaturan tahun lalu</summary>", ""]
        for tid, r in review.items():
            ly = r.get("last_year", {})
            lines += [f"**{tid.upper()}**, pengaturan {ly.get('year')}: halaman {ly.get('pages')}"
                      + (f", split {ly['split']}" if ly.get("split") else "")
                      + (f", keys `{', '.join(ly['keys'])}`" if ly.get("keys") else ", keys: susunan standar"), ""]
            for p, hdr in r.get("headers", {}).items():
                lines += [f"Halaman {p}:", "```", *hdr, "```", ""]
        lines += ["</details>"]
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    pdf, year, cfg_path = args[0], int(args[1]), args[2]
    entry, results = build(pdf, year, cfg_path)
    if "--report" in sys.argv:
        open(sys.argv[sys.argv.index("--report") + 1], "w").write(report_md(year, entry, results))
    if "--write" in sys.argv:
        cfg = json.load(open(cfg_path)); cfg[str(year)] = entry
        json.dump(cfg, open(cfg_path, "w"), indent=1, ensure_ascii=False)
        print(f"wrote {year} to {cfg_path}")
    print(json.dumps(entry))
    if len(entry) < len(TABLES):
        sys.exit(2)
    sys.exit(0 if all(r["status"] == "ok" for r in results.values()) else 1)
