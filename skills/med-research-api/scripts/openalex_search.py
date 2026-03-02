#!/usr/bin/env python3
"""
OpenAlex Search - 搜尋 OpenAlex 論文/作者/機構
用法: python openalex_search.py <關鍵詞> [--max N] [--output csv|json|markdown]
"""
import os, json, argparse
import requests

BASE_DIR = "tmp/med-research"
os.makedirs(BASE_DIR, exist_ok=True)

def search_openalex(query, max_results=10):
    """使用 OpenAlex API 搜尋"""
    url = "https://api.openalex.org/works"
    params = {
        "search": query,
        "per-page": max_results,
        "sort": "relevance_score:desc",
        "select": "id,doi,title,authorships,publication_year,primary_location,concepts,cited_by_count"
    }
    
    r = requests.get(url, params=params, timeout=30)
    r.raise_for_status()
    data = r.json()
    
    results = []
    for w in data.get("results", []):
        # 取作者
        authors = []
        for a in w.get("authorships", [])[:5]:
            author = a.get("author", {})
            name = author.get("display_name", "Unknown")
            authors.append(name)
        
        # 取概念/領域
        concepts = [c["display_name"] for c in w.get("concepts", [])[:3]]
        
        # 取得期刊
        journal = w.get("primary_location", {}).get("source", {}).get("display_name", "")
        
        results.append({
            "doi": w.get("doi", ""),
            "title": w.get("title", ""),
            "authors": "; ".join(authors) + (" et al." if len(w.get("authorships", [])) > 5 else ""),
            "journal": journal,
            "year": w.get("publication_year", ""),
            "cited_by": w.get("cited_by_count", 0),
            "concepts": "; ".join(concepts)
        })
    
    return results

def save_results(works, query, fmt="markdown"):
    """儲存結果"""
    import re
    query_slug = re.sub(r'[^a-zA-Z0-9]', '_', query)[:30]
    
    if fmt == "json":
        path = os.path.join(BASE_DIR, f"openalex_{query_slug}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(works, f, ensure_ascii=False, indent=2)
    
    elif fmt == "csv":
        import csv
        path = os.path.join(BASE_DIR, f"openalex_{query_slug}.csv")
        if not works:
            with open(path, "w", encoding="utf-8") as f:
                f.write("")
        else:
            with open(path, "w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=list(works[0].keys()))
                w.writeheader()
                w.writerows(works)
    
    else:
        path = os.path.join(BASE_DIR, f"openalex_{query_slug}.md")
        lines = ["| Title | Authors | Journal | Year | Citations | Concepts |",
                 "|-------|---------|---------|------|-----------|----------|"]
        for w in works:
            title = w["title"][:50] + "..." if len(w["title"]) > 50 else w["title"]
            lines.append(f"| {title} | {w['authors'][:30]} | {w['journal'][:20]} | {w['year']} | {w['cited_by']} | {w['concepts'][:25]} |")
        
        with open(path, "w", encoding="utf-8") as f:
            f.write("# OpenAlex 搜尋結果: " + query + "\n\n")
            f.write("\n".join(lines))
    
    print(f"結果已儲存: {path}")
    return path

def main():
    parser = argparse.ArgumentParser(description="OpenAlex 搜尋工具")
    parser.add_argument("query", help="搜尋關鍵詞")
    parser.add_argument("--max", type=int, default=10, help="最大結果數")
    parser.add_argument("--output", choices=["csv", "json", "markdown"], default="markdown", help="輸出格式")
    args = parser.parse_args()
    
    print(f"🔍 搜尋 OpenAlex: {args.query}")
    works = search_openalex(args.query, args.max)
    
    if works:
        save_results(works, args.query, args.output)
        print(f"✅ 完成！取得 {len(works)} 篇論文")
    else:
        print("⚠️ 沒有找到結果")

if __name__ == "__main__":
    main()
