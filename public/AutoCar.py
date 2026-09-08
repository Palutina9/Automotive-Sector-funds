# -*- coding: utf-8 -*-
"""
Created on Mon Sep  7 10:38:44 2026

@author: p.mahmoudi
"""

import requests
import json
from bs4 import BeautifulSoup

# ---------- Persian/Arabic digit + separator normalizer ----------
PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"
DIGIT_MAP = {d: str(i) for i, d in enumerate(PERSIAN_DIGITS)}
DIGIT_MAP.update({d: str(i) for i, d in enumerate(ARABIC_DIGITS)})

def fa_to_float(s):
    s = s.strip()
    s = s.replace("%", "").strip()
    negative = s.startswith("(") and s.endswith(")")
    if negative:
        s = s[1:-1]
    s = "".join(DIGIT_MAP.get(ch, ch) for ch in s)
    s = s.replace("٫", ".")
    s = s.replace(",", "")
    return -float(s) if negative else float(s)

# ---------- Safe request wrappers ----------
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
}

def safe_get(url, **kwargs):
    try:
        resp = requests.get(url, timeout=10, headers=headers, **kwargs)
        resp.raise_for_status()
        print(f"OK: {url}")
        return resp
    except requests.exceptions.RequestException as e:
        print(f"FAILED: {url} -> {e}")
        return None

def safe_post(url, **kwargs):
    try:
        resp = requests.post(url, timeout=10, headers=headers, **kwargs)
        resp.raise_for_status()
        print(f"OK (POST): {url}")
        return resp
    except requests.exceptions.RequestException as e:
        print(f"FAILED (POST): {url} -> {e}")
        return None

jadval = []

def ajaxetelaat(name, link, payload, navapi):
    resp = safe_post(link, data=payload)
    if resp is None:
        print(f"Skipping {name} — site unreachable")
        return

    soup = BeautifulSoup(resp.text, "html.parser")
    wanted_rows = [3, 4, 5, 6, 7, 8, 11, 12, 13]
    for i, row in enumerate(soup.find_all("tr"), start=1):
        if i in wanted_rows:
            cells = [td.get_text(strip=True) for td in row.find_all("td")]
            if cells:
                value = fa_to_float(cells[-2])
                if i == wanted_rows[1]:
                    jadval.append({name + "_fundDailyReturn": value})
                else:
                    jadval.append({name + "_fundSimpleReturn": value})

    navnum = safe_get(navapi)
    if navnum is not None:
        nav = navnum.json()
        if isinstance(nav, str):
            nav = json.loads(nav)
        jadval.append({name + "_fundNAV": fa_to_float(nav['dailyTotalNetAssetValue'])})
    else:
        print(f"Skipping {name} NAV — site unreachable")


#Khodran
name = "Khodran"
link = "https://mofidsectorfund.com/Reports/FundEfficiencyForDifferentPeriods"
navapi = "https://mofidsectorfund.com/Fund/GetETFNAV?basketId=3"
payload = {
    "basketId": 3
    }
ajaxetelaat(name, link, payload, navapi)

#TakhtGaz
name = "TakhtGaz"
link = "https://meyarsectorfund.ir/Reports/FundEfficiencyForDifferentPeriods"
navapi = "https://meyarsectorfund.ir/Fund/GetETFNAV?basketId=2"
payload = {
    "basketId": 2
    }
ajaxetelaat(name, link, payload, navapi)

#AutoCar
name = "AutoCar"
link = "https://karamadsectorfund.ir/Reports/FundEfficiencyForDifferentPeriods"
navapi = "https://karamadsectorfund.ir/Fund/GetETFNAV?basketId=2"
payload = {
    "basketId": 2
    }
ajaxetelaat(name, link, payload, navapi)

# ---------- Save results ----------
with open("auto_data.json", "w", encoding="utf-8") as f:
    json.dump(jadval, f, ensure_ascii=False, indent=2)

print(jadval)
    


