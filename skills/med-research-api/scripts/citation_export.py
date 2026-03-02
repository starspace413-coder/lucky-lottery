#!/usr/bin/env python3
"""citation_export.py - 將 DOI/PMID 轉換為 BibTeX 格式

用法：
  python scripts/citation_export.py 10.1038/s41586-020-2012-7
  python scripts/citation_export.py --pmid 32025007
  python scripts/citation_export.py 32025007   # 自動當作 PMID

輸出：tmp/med-research/citations.bib（附加寫入）
"""

import os, re, argparse
import requests

BASE_DIR = "tmp/med-research"
os.makedirs(BASE_DIR, exist_ok=True)
OUT_BIB = os.path.join(BASE_DIR, "citations.bib")


def doi_to_bibtex(doi: str) -> str:
    url = f"https://doi.org/{doi}"
    headers = {"Accept": "application/x-bibtex"}
    r = requests.get(url, headers=headers, timeout=30)
    r.raise_for_status()
    bib = r.text.strip()
    if not bib.startswith("@"):
        raise RuntimeError("DOI 回傳不是 BibTeX，可能被擋或 DOI 無效")
    return bib + "\n"


def pmid_to_bibtex(pmid: str) -> str:
    base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
    params = {"db": "pubmed", "id": pmid, "retmode": "json"}
    r = requests.get(base_url, params=params, timeout=30)
    r.raise_for_status()
    data = r.json()
    item = data.get("result", {}).get(pmid)
    if not item:
        raise RuntimeError(f"找不到 PMID: {pmid}")

    title = (item.get("title") or "").rstrip(".")
    journal = item.get("fulljournalname") or ""
    pubdate = item.get("pubdate") or ""
    year_match = re.findall(r"\b(19\d{2}|20\d{2})\b", pubdate)
    year = year_match[0] if year_match else ""

    authors = item.get("authors") or []
    first_author = authors[0].get("name", "") if authors else "Unknown"
    first_name = first_author.split(",")[0].strip() if "," in first_author else first_author.split()[0]
    key = re.sub(r"[^A-Za-z0-9]+", "", first_name)
    key = f"{key}{year}{pmid}"

    # 取得 DOI
    doi = ""
    for aid in item.get("articleids", []) or []:
        if aid.get("idtype") == "doi":
            doi = aid.get("value", "")
            break

    # 作者格式：Last F and Last F
    author_str = " and ".join([a.get("name", "").replace(",", "") for a in authors[:10] if a.get("name")])

    def esc(s: str) -> str:
        return s.replace("{", "\\{").replace("}", "\\}")

    # 組裝 BibTeX
    lines = [f"@article{{{key},"]
    lines.append(f"  title = {{{esc(title)}}},")
    lines.append(f"  journal = {{{esc(journal)}}},")
    if year:
        lines.append(f"  year = {{{year}}},")
    if author_str:
        lines.append(f"  author = {{{esc(author_str)}}},")
    if doi:
        lines.append(f"  doi = {{{doi}}},")
    lines.append(f"  note = {{PMID:{pmid}}}")
    lines.append("}")
    return "\n".join(lines) + "\n"


def append_bibtex(bib: str) -> str:
    with open(OUT_BIB, "a", encoding="utf-8") as f:
        f.write(bib)
    return OUT_BIB


def guess_id(s: str):
    s = s.strip()
    if re.fullmatch(r"\d+", s):
        return ("pmid", s)
    if s.startswith("10.") or "/" in s:
        return ("doi", s)
    return ("doi", s)


def main():
    parser = argparse.ArgumentParser(description="Export DOI/PMID to BibTeX")
    parser.add_argument("id", nargs="?", help="DOI 或 PMID")
    parser.add_argument("--doi", help="指定 DOI")
    parser.add_argument("--pmid", help="指定 PMID")
    args = parser.parse_args()

    if args.doi:
        kind, val = "doi", args.doi
    elif args.pmid:
        kind, val = "pmid", args.pmid
    elif args.id:
        kind, val = guess_id(args.id)
    else:
        parser.error("請提供 DOI 或 PMID")

    print(f"正在轉換 {kind.upper()}: {val}")
    if kind == "doi":
        bib = doi_to_bibtex(val)
    else:
        bib = pmid_to_bibtex(val)

    out = append_bibtex(bib)
    print(f"已寫入: {out}")


if __name__ == "__main__":
    main()
