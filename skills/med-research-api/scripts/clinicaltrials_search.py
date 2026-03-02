#!/usr/bin/env python3
"""
ClinicalTrials Search - 搜尋 ClinicalTrials.gov 臨床試驗
用法: python clinicaltrials_search.py <關鍵詞> [--max N] [--status STATUS] [--output csv|json|markdown]
"""
import os, json, argparse
import requests

BASE_DIR = "tmp/med-research"
os.makedirs(BASE_DIR, exist_ok=True)

def search_clinicaltrials(query, max_results=10, status=None):
    """使用 ClinicalTrials.gov API v2 搜尋"""
    url = "https://clinicaltrials.gov/api/v2/studies"
    params = {
        "query.term": query,
        "pageSize": max_results,
        "format": "json"
    }
    
    if status:
        params["filter.overallStatus"] = status.upper()
    
    r = requests.get(url, params=params, timeout=30)
    r.raise_for_status()
    data = r.json()
    
    studies = []
    for study in data.get("studies", []):
        ident = study.get("protocolSection", {})
        id_mod = ident.get("identificationModule", {})
        
        # 基本資訊
        nct_id = id_mod.get("nctId", "")
        title = id_mod.get("briefTitle", "")
        org = id_mod.get("organization", {}).get("fullName", "")
        
        # 狀態
        status_mod = ident.get("statusModule", {})
        overall_status = status_mod.get("overallStatus", "")
        
        # 招募狀態
        recruit = status_mod.get("eligibilityModule", {})
        
        # 條件/藥物
        cond_mod = ident.get("conditionsModule", {})
        conditions = cond_mod.get("conditions", [])
        
        # 介入措施
        int_mod = ident.get("interventionsModule", {})
        interventions = int_mod.get("interventions", [])
        
        studies.append({
            "nct_id": nct_id,
            "title": title,
            "organization": org,
            "status": overall_status,
            "conditions": "; ".join(conditions[:3]),
            "interventions": "; ".join([i.get("name", "") for i in interventions[:3]])
        })
    
    return studies

def save_results(studies, query, fmt="markdown"):
    """儲存結果"""
    import re
    query_slug = re.sub(r'[^a-zA-Z0-9]', '_', query)[:30]
    
    if fmt == "json":
        path = os.path.join(BASE_DIR, f"clinicaltrials_{query_slug}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(studies, f, ensure_ascii=False, indent=2)
    
    elif fmt == "csv":
        import csv
        path = os.path.join(BASE_DIR, f"clinicaltrials_{query_slug}.csv")
        if not studies:
            with open(path, "w", encoding="utf-8") as f:
                f.write("")
        else:
            with open(path, "w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=list(studies[0].keys()))
                w.writeheader()
                w.writerows(studies)
    
    else:
        path = os.path.join(BASE_DIR, f"clinicaltrials_{query_slug}.md")
        lines = ["| NCT ID | Title | Org | Status | Conditions |",
                 "|--------|-------|------|--------|------------|"]
        for s in studies:
            title = s["title"][:50] + "..." if len(s["title"]) > 50 else s["title"]
            lines.append(f"| {s['nct_id']} | {title} | {s['organization'][:15]} | {s['status']} | {s['conditions'][:25]} |")
        
        with open(path, "w", encoding="utf-8") as f:
            f.write("# ClinicalTrials 搜尋結果: " + query + "\n\n")
            f.write("\n".join(lines))
    
    print(f"結果已儲存: {path}")
    return path

def main():
    parser = argparse.ArgumentParser(description="ClinicalTrials.gov 搜尋工具")
    parser.add_argument("query", help="搜尋關鍵詞")
    parser.add_argument("--max", type=int, default=10, help="最大結果數")
    parser.add_argument("--status", help="篩選狀態 (RECRUITING, COMPLETED, ACTIVE_NOT_RECRUITING 等)")
    parser.add_argument("--output", choices=["csv", "json", "markdown"], default="markdown", help="輸出格式")
    args = parser.parse_args()
    
    print(f"🔍 搜尋 ClinicalTrials.gov: {args.query}")
    studies = search_clinicaltrials(args.query, args.max, args.status)
    
    if studies:
        save_results(studies, args.query, args.output)
        print(f"✅ 完成！取得 {len(studies)} 個臨床試驗")
    else:
        print("⚠️ 沒有找到結果")

if __name__ == "__main__":
    main()
