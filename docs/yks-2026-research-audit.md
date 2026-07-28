# 2026 YKS Medicine research audit

Audit date: **2026-07-28**
Candidate: **SAY ≈26,000; Turkish citizen; male; Medicine only**

## Source status and scope

The current inventory is based on ÖSYM's **21 July 2026 preliminary** guide. ÖSYM
explicitly says that this publication is for preliminary information and that
the final guide must be checked during the preference period. No later final or
correction guide was found by 28 July 2026. The explorer therefore carries a
visible recheck warning.

The guide inventory reconciles to **242 Medicine rows**:

- 225 programs eligible for this candidate: 100 state, 112 foundation and 13
  KKTC/international.
- 5 Ministry of Defence/Interior military-affiliated quotas excluded by scope.
- 12 quotas restricted to KKTC nationals, for which a Turkish citizen is not
  eligible.

YÖK Atlas returned 241 current rows. The ÖSYM guide additionally contains the
Kyrgyzstan joint program `405290121`; ÖSYM is authoritative for the inventory.

The machine-readable 2025, 2024 and 2023 ÖSYM Table 4 files and the 2025
placement-results table were normalized by
`scripts/yks/audit_official_sources.py`. The deterministic lineage output is
produced by `scripts/yks/generate-lineage.mjs`.

## Lineage method and result

The current code is never treated as the sole identity. Matching considers
university, faculty, language, scholarship category, quota pool, code activity,
fill status and category transfers. Exact-code history is retained even when a
different row is selected as the better predecessor.

| Status | Programs |
|---|---:|
| `exact_code_match` | 211 |
| `comparable_predecessor` | 9 |
| `analogous_program_only` | 3 |
| `genuinely_new` | 2 |
| `older_reopened_history` | 0 |
| `no_reliable_history` | 0 |

Only Bitlis Eren `102100115` and Burdur Mehmet Akif Ersoy `107300269` are
classified as genuinely new. A blank same-code 2025 cell is not used as a
new-program test.

### 2026 rows without an exact 2025 continuation

| 2026 code | 2026 program/change | Selected 2025 predecessor | Classification |
|---|---|---|---|
| `102100115` | Bitlis Eren, new 30-seat Medicine | none | genuinely new |
| `107300269` | Burdur MAKÜ, new 30-seat Medicine | none | genuinely new |
| `103100444` | Dokuz Eylül English, separate 50-seat track | Turkish `103110557` | analogous only |
| `200900346` | Bezmialem English full scholarship | Turkish `200910027` | analogous only |
| `200900353` | Bezmialem English 50% | Turkish `200910036` | analogous only |
| `201990545` | Haliç Turkish: 75 paid + 23 at 25% → 99 at 50% | paid `201911085` plus pool audit | comparable |
| `202900206` | Altınbaş: English → Turkish, full scholarship | `202910763`, same 7-seat tier | comparable |
| `202900213` | Altınbaş: English → Turkish, 50% | `202990302`, same 46-seat tier, unfilled | comparable |
| `203111166` | İstanbul Medipol Turkish: 50% → paid, 170 seats | `203110292`, rank 47,837 | comparable |
| `203101284` | İstanbul Medipol English: 50% → paid, 68 seats | `203190974`, rank 49,259 | comparable |
| `203101291` | Medipol International: 10 full → 3 full + 7 paid | `203110477`, rank 38 | comparable |
| `209210052` | Ankara Medipol Turkish: 50% → paid, 76 seats | `209210054`, rank 33,458 | comparable |
| `209210049` | Ankara Medipol English: 50% → paid, 76 seats | `209210051`, 59/76 placed | comparable |
| `210403237` | Nişantaşı: 85 paid → 1 paid + 84 at 50% | paid `210402551` | comparable |

The detailed, source-linked audit row for every item above is stored in
`src/data/yks/migration-audit.json`. The four secondary rank lookups used where
ÖSYM's downloadable rows expose score/fill but not an accessible historical
success-rank field are flagged `partial`; their codes, quotas, placed counts and
scores are still cross-checked against ÖSYM.

## Exhaustive foundation category-migration scan

The year-pair scan detected these **26** changes. A row is emitted only when the
set of scholarship categories/codes or the material quota distribution changed.

1. 2023→2024 Ankara Medipol Turkish: paid 5 + full 12 + 50% 71 → paid 4 + full 12 + 25% 72.
2. 2023→2024 Ankara Medipol English: paid 5 + full 12 + 50% 71 → paid 5 + full 12 + 25% 71.
3. 2023→2024 İstanbul Arel Turkish: paid 12 + full 7 + 25% 30 → paid 2 + full 7 + 50% 40.
4. 2023→2024 İstanbul Aydın English: full 10 + 25% 59 → full 10 + 50% 59.
5. 2023→2024 İstanbul Aydın Turkish: paid 93 + full 15 → full 15 + 50% 93.
6. 2023→2024 İstanbul Medipol Turkish: paid 3 + full 23 + 50% 141 → full 23 + 25% 144.
7. 2023→2024 Maltepe English: paid 10 + full 3 + 25% 10 → paid 13 + full 3 + 50% 7.
8. 2023→2024 Maltepe Turkish: paid 15 + full 5 + 25% 20 → paid 18 + full 4 + 50% 10.
9. 2024→2025 Ankara Medipol English: paid 5 + full 12 + 25% 71 → full 12 + 50% 76.
10. 2024→2025 Ankara Medipol Turkish: paid 4 + full 12 + 25% 72 → full 12 + 50% 76.
11. 2024→2025 Bezmialem Turkish: paid 30 + full 16 + 50% 80 → full 17 + 50% 110.
12. 2024→2025 Biruni English: full 8 + 25% 51 → full 13 + 50% 85.
13. 2024→2025 Biruni Turkish: full 13 + 25% 85 → full 13 + 50% 85.
14. 2024→2025 İstanbul Medipol English: one full-scholarship track → faculty full 10 + 50% 68 plus International full 10.
15. 2024→2025 İstanbul Medipol Turkish: full 23 + 25% 144 → full 26 + 50% 170.
16. 2024→2025 Lokman Hekim English: paid 3 + full 8 + 50% 48 → full 8 + 50% 51.
17. 2024→2025 Üsküdar English: paid 5 + full 8 + 50% 46 → full 8 + 50% 50.
18. 2025→2026 Ankara Medipol English: full 12 + 50% 76 → full 12 + paid 76.
19. 2025→2026 Ankara Medipol Turkish: full 12 + 50% 76 → full 12 + paid 76.
20. 2025→2026 Haliç English: paid 23 + full 5 + 50% 11 → full 5 + 50% 34.
21. 2025→2026 Haliç Turkish: paid 75 + full 16 + 25% 23 → full 15 + 50% 99.
22. 2025→2026 İstanbul Medipol English/International: faculty full 10 + 50% 68 and International full 10 → faculty full 10 + paid 68 and International full 3 + paid 7.
23. 2025→2026 İstanbul Medipol Turkish: full 26 + 50% 170 → full 26 + paid 170.
24. 2025→2026 Nişantaşı Turkish: paid 85 + full 13 → paid 1 + full 13 + 50% 84.
25. 2025→2026 Okan English: paid 5 + full 9 + 50% 53 → full 8 + 50% 49.
26. 2025→2026 Üsküdar Turkish: paid 12 + full 8 + 50% 38 → full 8 + 50% 50.

This is a detection/audit list, not a claim that each year-pair row is perfectly
interchangeable. Each current program has a separate confidence and explanation.

## Chance assessment

The assessment has five text bands: strong, realistic, borderline, reach and
highly speculative. There are no percentage probabilities. The base explanation
uses the selected predecessor's rank/fill status, candidate margin, 2026 quota,
category transformation and comparability. Optimistic and pessimistic text
describe demand/quota/tuition effects rather than arbitrary numeric shifts.

Medipol's large paid pools materially change from “historyless” to:

- Ankara Turkish paid: **strong**, based on the equivalent 76-seat 2025 50%
  pool (rank 33,458).
- Ankara English paid: **strong but fill-sensitive**, because only 59 of 76
  seats filled in the equivalent 2025 50% pool; there is no official fully
  filled closing rank.
- İstanbul Turkish and English paid: **strong but tuition-sensitive**, based on
  equivalent 170- and 68-seat 2025 50% pools (47,837 and 49,259).
- International paid: predecessor exists, but the 10 full-scholarship seats were
  split 3+7 and the price category changed; confidence is lower.

## Tuition and benefits limitations

All paid/25%/50% rows contain a fee research object distinguishing listed fee,
ÖSYM category, preference discount, admission-rank support, later academic
support, combination status, effective annual scenarios, payment/continuation
notes and preparation coverage. `0`, full scholarship, not applicable and not
published are different states.

The 2026 guide's university fee table is the common primary baseline and states
that listed amounts include KDV. University-specific pages are retained as
separate sources. Some official pages do not publish every requested attribute:
cash discount, instalment count, combination order, preparation coverage and
loss conditions remain explicitly “not confirmed” rather than inferred. No
six-year total is calculated because annual fees are recalculated.

Benefits in the interface are split into clinical network, accommodation/daily
support, exchange/research/secondary-program opportunities, transport/campus,
and uncertainty. Where the source bundle does not support a claim, the display
says it was not separately verified.

## Preference-list assumptions

Four 24-choice lists are generated: balanced, budget-conscious, reach-oriented
and state-first. They are decision scaffolds, not an instruction to sort by
admission probability. Desirable reach choices remain above realistic and
financial-safety choices. Every omitted eligible program remains in the complete
225-row explorer.
