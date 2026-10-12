import pdfplumber
import re
import json
import os
import datetime

pdf_path = r'c:\Users\User\Desktop\LD Database 2\Database(2024 Admission) - Form responses 1-1.pdf'
official_donors_path = r'c:\Users\User\Desktop\Lifedrop\Backend\data\official_donors.json'
local_db_path = r'c:\Users\User\Desktop\Lifedrop\Backend\data\local_db.json'

def clean_str(val):
    if not val:
        return ''
    val = str(val).replace('\n', ' ').strip()
    return re.sub(r'\s+', ' ', val)

def title_case(val):
    val = clean_str(val)
    if not val:
        return ''
    # Handle words like "B-Tech", "M.C.A", etc. nicely if present
    words = val.split()
    res = []
    for w in words:
        if len(w) <= 2 and w.isupper():
            res.append(w)
        else:
            res.append(w.capitalize())
    return ' '.join(res)

def normalize_blood_group(bg):
    bg = clean_str(bg).upper().replace(' ', '')
    m = re.search(r'(A|B|AB|O)[\+\-]', bg)
    if m:
        return m.group(0)
    return bg

def clean_phone(phone):
    digits = re.sub(r'\D', '', clean_str(phone))
    if len(digits) >= 10:
        return digits[-10:]
    return digits

district_mapping = {
    'TRIVANDRUM': 'Thiruvananthapuram',
    'THIRUVANANTHAPURAM': 'Thiruvananthapuram',
    'ALAPPUZHA': 'Alappuzha',
    'KOLLAM': 'Kollam',
    'THRISSUR': 'Thrissur',
    'PATHANAMTHITTA': 'Pathanamthitta',
    'ERNAKULAM': 'Ernakulam',
    'KANNUR': 'Kannur',
    'KOTTAYAM': 'Kottayam',
    'KOZHIKODE': 'Kozhikode',
    'MALAPPURAM': 'Malappuram',
    'PALAKKAD': 'Palakkad',
    'KASARAGOD': 'Kasaragod',
    'IDUKKI': 'Idukki'
}

def normalize_district(dist):
    cleaned = clean_str(dist).upper()
    return district_mapping.get(cleaned, title_case(dist))

def parse_last_donation_date(date_str):
    if not date_str:
        return None
    s = clean_str(date_str).lower()
    if not s or s in ['no', 'nil', 'never donate blood', 'never donated blood', 'never']:
        return None
    
    # Check for DD/MM/YYYY
    m = re.search(r'(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})', s)
    if m:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return datetime.date(year, month, day).isoformat()
        except Exception:
            pass
            
    # Check for Month YYYY or YYYY Month e.g. March, 2023 or 2023 Nov or August 7
    months = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }
    year_match = re.search(r'20\d{2}', s)
    year = int(year_match.group(0)) if year_match else 2024
    
    found_month = None
    for m_name, m_num in months.items():
        if m_name in s:
            found_month = m_num
            break
            
    if found_month:
        return datetime.date(year, found_month, 1).isoformat()
    elif year_match:
        return datetime.date(year, 1, 1).isoformat()
        
    return None

def is_eligible_90_days(last_date_iso):
    if not last_date_iso:
        return True
    try:
        last_date = datetime.date.fromisoformat(last_date_iso)
        ref_date = datetime.date(2024, 10, 15) # Form response submission date approx Oct 2024
        days_diff = (ref_date - last_date).days
        return days_diff >= 90
    except Exception:
        return True

donors = []
seen_phones = set()
blood_group_counts = {}
district_counts = {}

with pdfplumber.open(pdf_path) as pdf:
    for page_idx, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        if not tables:
            continue
        table = tables[0]
        for row_idx, row in enumerate(table[1:], start=1):
            if len(row) < 20:
                continue
                
            name = title_case(row[2])
            phone = clean_phone(row[3])
            bg = normalize_blood_group(row[4])
            district = normalize_district(row[7])
            taluk = title_case(row[8])
            willing = clean_str(row[18]).lower()
            village = title_case(row[19])
            last_donated_raw = row[17]
            
            city = village if (village and village != '-') else taluk
            if not city:
                city = district
                
            last_donation_date = parse_last_donation_date(last_donated_raw)
            
            # Availability logic
            available = True
            if willing.startswith('no'):
                available = False
            elif not is_eligible_90_days(last_donation_date):
                available = False
                
            if not name or len(phone) != 10 or not bg:
                continue
                
            if phone in seen_phones:
                continue
            seen_phones.add(phone)
            
            donor = {
                "name": name,
                "bloodGroup": bg,
                "phone": phone,
                "state": "Kerala",
                "district": district,
                "city": city,
                "available": available,
                "isVerified": True,
                "consent": True,
                "isOfficial": True,
                "source": "2024_Admission_Database"
            }
            if last_donation_date:
                donor["lastDonationDate"] = last_donation_date
                
            donors.append(donor)
            blood_group_counts[bg] = blood_group_counts.get(bg, 0) + 1
            district_counts[district] = district_counts.get(district, 0) + 1

# Write to official_donors.json
with open(official_donors_path, 'w', encoding='utf-8') as f:
    json.dump(donors, f, indent=2)

print(f"Successfully saved {len(donors)} donors to official_donors.json!")

# Merge into local_db.json
local_db = {"users": [], "donors": [], "requests": []}
if os.path.exists(local_db_path):
    try:
        with open(local_db_path, 'r', encoding='utf-8') as f:
            local_db = json.load(f)
    except Exception as e:
        print("Could not read local_db.json, starting fresh:", e)

existing_db_donors = local_db.get("donors", [])
db_phones = {clean_phone(d.get("phone", "")) for d in existing_db_donors}

added_to_db = 0
for d in donors:
    if d["phone"] not in db_phones:
        # Create unique _id for hybrid model
        db_donor = dict(d)
        db_donor["_id"] = "pdf_" + d["phone"]
        db_donor["createdAt"] = "2024-10-07T00:00:00.000Z"
        db_donor["updatedAt"] = "2024-10-07T00:00:00.000Z"
        existing_db_donors.append(db_donor)
        db_phones.add(d["phone"])
        added_to_db += 1

local_db["donors"] = existing_db_donors

with open(local_db_path, 'w', encoding='utf-8') as f:
    json.dump(local_db, f, indent=2)

print(f"Successfully seeded {added_to_db} donors into local_db.json! Total donors in DB: {len(existing_db_donors)}")

print("\n--- DATA SUMMARY BY BLOOD GROUP ---")
for bg in sorted(blood_group_counts.keys()):
    print(f"  {bg}: {blood_group_counts[bg]}")

print("\n--- DATA SUMMARY BY DISTRICT ---")
for dist in sorted(district_counts.keys()):
    print(f"  {dist}: {district_counts[dist]}")
