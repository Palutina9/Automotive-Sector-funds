# -*- coding: utf-8 -*-
"""
Created on Mon Sep  7 10:38:44 2026

@author: p.mahmoudi
"""

import requests
import json
from bs4 import BeautifulSoup

PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"
DIGIT_MAP = {d: str(i) for i, d in enumerate(PERSIAN_DIGITS)}
DIGIT_MAP.update({d: str(i) for i, d in enumerate(ARABIC_DIGITS)})

def fa_to_float(s):
    s = s.strip()
    s = s.replace("%", "").strip()  # remove % first
    negative = s.startswith("(") and s.endswith(")")
    if negative:
        s = s[1:-1]
    s = s.replace("%", "").strip()
    s = "".join(DIGIT_MAP.get(ch, ch) for ch in s)
    s = s.replace("٫", ".")
    s = s.replace(",", "")
    return -float(s) if negative else float(s)

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36"
}

api_periodic = "https://agahsectorfund.ir/api/v1/public/fundReturnPeriodic/2"
api_daily = "https://agahsectorfund.ir/api/v1/public/fundReturnDaily/2"

# fixed section
response = requests.get(api_periodic, timeout = 10)
response.raise_for_status()
data = response.json()
rows = data['rows'][:8]

roozaneh = requests.get(api_daily, timeout = 10)
roozaneh.raise_for_status()
data_daily = roozaneh.json()[0]



jadval = []

for row in rows:
    jadval.append({
        "key": row['key'],
        "fromDate": row['fromDate'],
        "toDate": row['toDate'],
        "marketSimpleReturn": row['marketSimpleReturn']
        })
jadval.append({
    "marketDailyReturn": data_daily['marketDailyReturn']
    })



def apietelaat(name, api_periodic, api_daily, navapi):
    response = requests.get(api_periodic, headers= headers, timeout = 10)
    response.raise_for_status()
    data = response.json()
    rows = data['rows'][:8]
    for row in rows:
        jadval.append({
            name + "_fundSimpleReturn": row['fundSimpleReturn']
            })

    roozaneh = requests.get(api_daily, timeout = 10)
    data_daily = roozaneh.json()[0]
    jadval.append({
        name + "_fundDailyReturn": data_daily['fundDailyReturn'],
        })
    navnum = requests.get(navapi, timeout = 10)
    navnum.raise_for_status()
    jadval.append({
        name + "_fundNAV": fa_to_float(navnum.json()['nav']),
        })
    

def ajaxetelaat(name, link, payload, navapi):
    resp = requests.post(link, data=payload, headers=headers, timeout = 10)
    resp.raise_for_status()
    
    soup = BeautifulSoup(resp.text, "html.parser")
    wanted_rows = [3, 4, 5, 6, 7, 8, 9, 12, 13, 14]

    for i, row in enumerate(soup.find_all("tr"), start=1):
        if i in wanted_rows:
            cells = [td.get_text(strip=True) for td in row.find_all("td")]
            if cells:
                value = fa_to_float(cells[-2])
                if i == wanted_rows[1]:
                    jadval.append({
                        name + "_fundDailyReturn": value
                    })
                else:
                    jadval.append({
                        name + "_fundSimpleReturn": value
                    })
    navnum = requests.get(navapi, timeout = 10)
    navnum.raise_for_status()
    nav = navnum.json()
    if isinstance(nav, str):
        nav = json.loads(nav)
    jadval.append({
        name + "_fundNAV": fa_to_float(nav['dailyTotalNetAssetValue'])
        })

#AutoAgah
name = "AutoAgah"
navapi = "https://agahsectorfund.ir/api/v1/public/fundNavInfo/2"
apietelaat(name, api_periodic, api_daily, navapi)

#AutoDariush
name = "AutoDariush"
api_periodic = "https://sector.dariush.fund/api/v1/public/fundReturnPeriodic/2"
api_daily = "https://sector.dariush.fund/api/v1/public/fundReturnDaily/2"
navapi = "https://sector.dariush.fund/api/v1/public/fundNavInfo/2"
apietelaat(name, api_periodic, api_daily, navapi)

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

#BehinRo
name = "BehinRo"
api_periodic = "https://vistasectorfund.ir/api/v1/public/fundReturnPeriodic/1"
api_daily = "https://vistasectorfund.ir/api/v1/public/fundReturnDaily/1"
navapi = "https://vistasectorfund.ir/api/v1/public/fundNavInfo/1"
apietelaat(name, api_periodic, api_daily, navapi)

#AutoCar
name = "AutoCar"
link = "https://karamadsectorfund.ir/Reports/FundEfficiencyForDifferentPeriods"
navapi = "https://karamadsectorfund.ir/Fund/GetETFNAV?basketId=2"
payload = {
    "basketId": 2
    }
ajaxetelaat(name, link, payload, navapi)


with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(jadval, f, ensure_ascii=False, indent=2)
    


