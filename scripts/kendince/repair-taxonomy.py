"""Repair clothing falsely identified as footwear from words such as Oxford/Boot.

Uses existing source titles only; leaves prices, IDs and observation times intact.
"""
import json
import pathlib
import re
ROOT=pathlib.Path(__file__).resolve().parents[2]
path=ROOT/'public/kendince/catalog.json'
catalog=json.loads(path.read_text())
repairs=[]
for p in catalog['products']:
    if p['kind']=='coat' and 'jacket' in p['name'].lower() and not re.search(r'\bcoat\b',p['name'],re.I):
        p['kind']='jacket'
    if p['category']!='shoe':
        continue
    title=p['name'].lower()
    kind=None
    if 'paraboot' in title and 'michael' in title:
        category,kind='shoe','derby'
    elif re.search(r'\bjacket\b',title):
        category,kind='outer','jacket'
    elif re.search(r't[\s-]?shirt|\btee\b',title):
        category,kind='top','longtee' if 'long sleeve' in title else 'tee'
    elif re.search(r'\bshirt\b|\bbrushed oxford\b|gömlek',title):
        category,kind='top','shirt'
    elif re.search(r'\bpants?\b|trouser|jean',title):
        category,kind='bottom','jean' if 'jean' in title else 'chino'
    if not kind:
        continue
    repairs.append({'id':p['id'],'name':p['name'],'previous':[p['category'],p['kind']],'corrected':[category,kind]})
    p.update(category=category,kind=kind,formality=0 if kind=='tee' else 1)
    p.setdefault('sourceFacts',{})['Katalog sınıflandırması']='Kaynak ürün adından düzeltildi; Oxford kumaş/kalıp adı ayakkabı türü sayılmadı.'
path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
report=ROOT/'kendince-audit/taxonomy-v7.json'
report.parent.mkdir(exist_ok=True)
report.write_text(json.dumps({'repairs':repairs},ensure_ascii=False,indent=2)+'\n')
print(f'{len(repairs)} source-title classification repairs; IDs and price/stock timestamps preserved')
