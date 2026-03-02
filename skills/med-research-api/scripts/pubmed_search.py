#!/usr/bin/env python3
"""
PubMed Search - 搜尋 PubMed 論文並取得摘要/元數據
用法: python pubmed_search.py <關鍵詞> [--max N] [--output csv|json|markdown]
"""
import sys, os, json, argparse, re
import requests

BASE_DIR = "tmp/med-research"
os.makedirs(BASE_DIR, exist_ok=True)

def search_pubmed(query, max_results=20):
    """使用 NCBI E-utilities 搜尋 PubMed"""
    base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    
    # Step 1: esearch 取得 PMIDs
    search_url = f"{base_url}/esearch.fcgi"
    params = {
        "db": "pubmed",
        "term": query,
        "retmax": max_results,
        "retmode": "json",
        "sort": "relevance"
    }
    
    r = requests.get(search_url, params=params, timeout=30)
    r.raise_for_status()
    data = r.json()
    
    idlist = data.get("esearchresult", {}).get("idlist", [])
    if not idlist:
        print(f"找不到結果: {query}")
        return []
    
    print(f"找到 {len(idlist)} 篇論文，取 {len(idlist)} 篇...")
    
    # Step 2: efetch 取得詳細資訊
    fetch_url = f"{base_url}/efetch.fcgi"
    params = {
        "db": "pubmed",
        "id": ",".join(idlist),
        "retmode": "xml",
        "rettype": "abstract"
    }
    
    r = requests.get(fetch_url, params=params, timeout=60)
    r.raise_for_status()
    
    # 解析 XML
    articles = []
    # 簡單解析（用正則抓 PubmedArticle）
    import xml.etree.ElementTree as ET
    try:
        root = ET.fromstring(r.text)
        for art in root.findall(".//PubmedArticle"):
            pmid = art.findtext(".//PMID", "")
            title = art.findtext(".//ArticleTitle", "")
            abstract = art.findtext(".//AbstractText", "")
            authors = [a.findtext("LastName", "") + " " + a.findtext("ForeName", "") 
                       for a in art.findall(".//Author") if a.find("LastName") is not None]
            journal = art.findtext(".//Journal/Title", "")
            pubdate = art.findtext(".//Journal/JournalIssue/PubDate/Year", "")
            doi = art.findtext(".//ELocationID[@EIdType='doi']", "")
            
            articles.append({
                "pmid": pmid,
                "title": title,
                "abstract": abstract[:500] + "..." if abstract and len(abstract) > 500 else abstract,
                "authors": "; ".join(authors[:5]) + (" et al." if len(authors) > 5 else ""),
                "journal": journal,
                "year": pubdate,
                "doi": doi
            })
    except Exception as e:
        print(f"XML 解析錯誤: {e}")
    
    return articles

def save_results(articles, query, fmt="markdown"):
    """儲存結果"""
    query_slug = re.sub(r'[^a-zA-Z0-9]', '_', query)[:30]
    
    if fmt == "json":
        path = os.path.join(BASE_DIR, f"pubmed_{query_slug}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(articles, f, ensure_ascii=False, indent=2)
    
    elif fmt == "csv":
        import csv
        path = os.path.join(BASE_DIR, f"pubmed_{query_slug}.csv")
        if not articles:
            with open(path, "w", encoding="utf-8") as f:
                f.write("")
        else:
            with open(path, "w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=list(articles[0].keys()))
                w.writeheader()
                w.writerows(articles)
    
    else:  # markdown
        path = os.path.join(BASE_DIR, f"pubmed_{query_slug}.md")
        lines = ["| PMID | Title | Authors | Journal | Year | DOI |",
                 "|------|-------|---------|---------|------|-----|"]
        for a in articles:
            title = a["title"][:60] + "..." if len(a["title"]) > 60 else a["title"]
            lines.append(f"| {a['pmid']} | {title} | {a['authors'][:40]} | {a['journal'][:20]} | {a['year']} | {a['doi']} |")
        
        with open(path, "w", encoding="utf-8") as f:
            f.write("# PubMed 搜尋結果: " + query + "\n\n")
            f.write("\n".join(lines))
    
    print(f"結果已儲存: {path}")
    return path

def main():
    parser = argparse.ArgumentParser(description="PubMed 搜尋工具")
    parser.add_argument("query", help="搜尋關鍵詞")
    parser.add_argument("--max", type=int, default=20, help="最大結果數")
    parser.add_argument("--output", choices=["csv", "json", "markdown"], default="markdown", help="輸出格式")
    args = parser.parse_args()
    
    print(f"🔍 搜尋 PubMed: {args.query}")
    articles = search_pubmed(args.query, args.max)
    
    if articles:
        save_results(articles, args.query, args.output)
        print(f"✅ 完成！取得 {len(articles)} 篇論文")
    else:
        print("⚠️ 沒有找到結果")

if __name__ == "__main__":
    main()
