---
name: med-research-api
description: Medical research API toolkit for literature search, clinical trials, and citation management. Use when: (1) searching PubMed/OpenAlex/ClinicalTrials for papers/trials, (2) fetching paper metadata, abstracts, or citations, (3) managing references and generating BibTeX, (4) extracting data from PDF/DOCX files for research. Supports EHR/medical research workflows without exposing PHI.
metadata: {"openclaw": {"emoji": "🧬"}}
---

# Med Research API

## Quick Start

This skill provides scripts for querying medical/scientific databases and managing citations.

### Available Scripts

| Script | 功能 | Example |
|--------|------|---------|
| `pubmed_search.py` | 搜尋 PubMed 論文、撈摘要/PMID | `python scripts/pubmed_search.py "diabetes EHR"` |
| `openalex_search.py` | 搜尋 OpenAlex 論文/作者/機構 | `python scripts/openalex_search.py "machine learning"` |
| `clinicaltrials_search.py` | 搜尋 ClinicalTrials.gov 臨床試驗 | `python scripts/clinicaltrials_search.py "COVID treatment"` |
| `citation_export.py` | 將 DOI/PMID 轉 BibTeX | `python scripts/citation_export.py 10.1056/NEJMoa2007764` |

### Output Location
所有結果預設輸出到 `skills/med-research-api/tmp/med-research/`（Markdown 表格 + CSV + BibTeX）。

---

## 工作流範例

### 1. 文獻搜尋（PubMed + OpenAlex）

```bash
# PubMed 搜尋 EHR 相關論文
python scripts/pubmed_search.py "electronic health records machine learning" --max 20

# OpenAlex 搜尋並取得引用網絡
python scripts/openalex_search.py "EHR phenotyping" --max 10
```

### 2. 臨床試驗盤點

```bash
# 搜尋特定疾病的臨床試驗
python scripts/clinicaltrials_search.py "type 2 diabetes" --max 10 --status RECRUITING
```

### 3. 引用管理

```bash
# 從 DOI 取得 BibTeX
python scripts/citation_export.py 10.1038/s41586-020-2012-7

# 從 PubMed ID 取得
python scripts/citation_export.py --pmid 32025007
```

---

## 資料隱私守則

⚠️ **嚴禁將 PHI（病人識別資訊）透過這些 API 傳送**
- 搜尋關鍵詞請用公開術語（如 disease names, drug names）
- 不要輸入病人 ID、姓名、日期等
- 輸出結果請妥善保存，不要與未授權人員分享

---

## 進階用法

### 在 OpenClaw 中直接呼叫

你可以在對話中直接說：
- 「幫我搜 PubMed 上關於 XXX 的最新論文」
- 「查一下 ClinicalTrials 上有沒有 XXX 的臨床試驗」
- 「把這個 DOI 轉成 BibTeX」

我會自動使用對應的腳本來執行。

---

## 安裝依賴（可選）

如果需要離線或更多功能，可安裝：
```bash
pip install requests
```
