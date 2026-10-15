# Uploaded First Aid crosswalk validation

Checked 2026-10-15. These spreadsheets are useful navigation metadata, but neither supports a complete automatic conversion of curriculum reading assignments or exact Anki card tags.

## Inventory and consistency

The preliminary workbook contains exactly **1,413 hierarchy entries: 1,316 topics and 97 containers**, with unique deck paths. Its direct-card counts sum to **13,840**. Exactly **16 topics** claim index corroboration; **1,300 topic rows** are provisional, plus 97 provisional containers. The workbook explicitly repeats older page numbers or subtracts two for many candidates. These candidates must not become verified reading pages.

The second workbook contains exactly **1,316 unique topic rows**, **85** labeled verified and **1,231** without new-edition topic pages. Its topic-card counts also sum to **13,840**. All topic paths, 2023 page cells, and direct-card counts agree with the preliminary workbook; there are no missing or duplicate topic paths. This establishes internal consistency, not authenticity of the claimed deck release. The claimed **13,708 notes** cannot be independently checked from the supplied spreadsheets.

The 85-row verified sheet cites third-party dokumen.pub transcriptions: **48 image-acknowledgment entries, 27 Rapid Review internal references, and 10 Rapid Review equation references**. These have different evidential meaning from exact official-index headings and complete reading spans. Its 21 chapter rows are chapter locators; they cannot supply exact topic pages.

## Independent official-source spot checks

The official [2023 index](https://firstaidteam.com/wp-content/uploads/2022/11/2023_FAS1_Index.pdf), [2024 index](https://firstaidteam.com/wp-content/uploads/2024/02/2024_FAS1_Index.pdf), [2025 index](https://firstaidteam.com/wp-content/uploads/2025/02/2025_FAS1_Index.pdf), and [2026 index](https://firstaidteam.com/wp-content/uploads/2026/04/2026_FAS1_Index.pdf) were successfully opened through the web connector. They contain 53, 55, 71, and 63 PDF pages respectively. Shell network policy excludes the host; the connector supplied the source text. Opening an index is not validating every entry.

Exactly **13 selected topic/edition claims** were independently checked: **7 corroborated and 6 conflicts**. This is a targeted spot check, not a statistical sample or an exhaustive review of 85 topics.

| Topic | Edition | Second workbook | Official index | Index PDF page (1-based) |
| --- | --- | --- | --- | --- |
| Aortic aneurysm | 2026 | 306 | 304, principal disease entry | 5 |
| Aortic dissection | 2026 | 307 | 305, also 302 | 5 |
| Cardiomyopathies | 2026 | 315 | 314 | 11 |
| Coarctation of the aorta | 2026 | 304 | 302 | 14 |
| Evolution of myocardial infarction | 2026 | 309 | 308; 309 is diagnosis | 40 |
| Myocardial infarction complications | 2026 | 314 | 313; 308 also evolution/complications | 40 |

Corroborated claims were 2026 acute pericarditis (319), heart failure findings/treatment (316), Hodgkin lymphoma subtypes/comparison (434), and 2025 aortic aneurysm (306), aortic dissection (307, also 304), cardiomyopathies (315), and Hodgkin lymphoma (434). Incidental cross-references are not exhaustive reading selections.

The preliminary workbook already gives 2026 aortic aneurysm as 304, contradicting the second workbook's 306. It is the only page disagreement among their overlapping index-claimed topic rows. The six official-source conflicts show that the second workbook's verified label cannot be accepted wholesale, even though many citations may be useful.

## Import decision

Do not replace existing source-bound mappings in `src/data/first-aid-verified.json` with workbook claims. No new automatic task-reading mapping is approved by this audit: matching a deck title to a source video or mixed task reading requires a separate semantic review. Official index evidence supports topic-to-page associations only, not complete old-edition reading ranges.

Neither workbook contains 2024 topic mappings. The available 2024 index permits future review but does not justify copying 2023, 2025, or 2026 pages into 2024. Mnemosyne full deck paths establish claimed subdeck hierarchy, not exact Anki card tags. No actual deck package or note/card tag payload was supplied, so exact-tag evidence remains unavailable.

Machine-readable findings are `/workspace/scratch/crosswalk-validation.json`; a lossless value-only workbook extraction is `/workspace/scratch/crosswalk-workbook-extract.json`, and the reproducible structural audit is `/workspace/scratch/audit_crosswalks.py`. The JSON has workbook counts and SHA-256 hashes, cross-workbook reconciliation, 13 source-linked spot checks, limitations, and an empty `importPolicy.automaticTaskReadingMappings` list. It deliberately keeps unresolved claims outside runtime application data.
