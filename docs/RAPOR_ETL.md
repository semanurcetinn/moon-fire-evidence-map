# YAMA v3.1 (2026-11-14) – çok küçük yama

- **Yedek:** `ETL/backup/v3_oncesi_v31/` (salt okunur)
- **Kurallar:**
  - Değer düzeltme yok; raw_json birebir aynı (W3).
  - Satır sayısı 1805, değişmedi (W4).
  - İndirme yapılmadı; Planned_Test Matrix açılmadı; Git işlemi yapılmadı.

## Ne değişti
| # | Değişiklik | Etki |
|---|---|---|
| 1 | PSI-10 inverse yakıt: yaml'daki `fuel_derived` satırı açıldı. Koşul **satır bazında**: "XC2H4 initial" dolu olmalı (120/120 dolu; ham veride doğrulandı). Bayrak `fuel_derived_from_column`. | Boş yakıt **122 → 2**. Kalan: PSI-99 2-6 ve 2-9 (kaynak hücre boş). PSI-10 Normal Flame dosyasına dokunulmadı (C2H4 187 + C3H8 20). |
| 2 | PSI-26 elle onay (`outcome_overrides`; kurallardan SONRA uygulanıyor; `outcome_source = manual_review`, `outcome_confidence = low`, bayrak `outcome_manual_review`) | source_row 47 (test 45) → sustained; source_row 41 (test 39) → extinguished; source_row 71 (test 68) → extinguished. Her override için yaml'da neden ve metin parçası var. `psi26_outcome_review.csv`'de bu 3 satır `manual_review` olarak görünüyor (`override_nedeni` kolonu). |
| 3 | `outcome_confidence = low` tanımı: parsed_text **ve** manual_review. DATA_CARD, data_dictionary (`outcome_source` değerlerine manual_review eklendi) ve "Bilinen sınırlar" ("extinguished" operatör kaynaklı sönmeyi de kapsar) güncellendi. | Confidence dağılımı: high 606 · low 62 (parsed_text 59 + manual_review 3) · boş 1137 |

**PSI-26 outcome:**
- **Önce:** extinguished 22, sustained 6, no_ignition 5, blowoff 1, unknown 88
- **Sonra:** extinguished **24**, sustained **7**, no_ignition 5, blowoff 1, unknown **85**

Beklentiyle birebir aynı; kayma yok. Override'lı satırlarda önceki kural sonucunu kayıt altında tutmak için `outcome_ambiguous` ve `outcome_parsed_text` bayrakları korundu.

**quality_log:** 1584 → 1707 kayıt (+120 `fuel_derived_from_column`, +3 `outcome_manual_review`); tekrar 0.

## Kabul testleri (W1–W8): hepsi GEÇTİ
| Test | Sonuç | Ayrıntı |
|---|---|---|
| W1 | GEÇTİ | Boş yakıt 122 → 2 (PSI-99 2-6, 2-9) |
| W2 | GEÇTİ | PSI-26: sustained 6 → 7, extinguished 22 → 24, unknown 88 → 85 |
| W3 | GEÇTİ | raw_json farkı 0 / 1780 kaynak satırı |
| W4 | GEÇTİ | 1805 → 1805 |
| W5 | GEÇTİ | Moon box 87 (A 20 / B 46 / C 21) |
| W6 | GEÇTİ | quality_log tekrarı 0 (1707 kayıt) |
| W7 | GEÇTİ | Dashboard 1805 satır = experiments 1805 |
| W8 | GEÇTİ | Outcome'u değişen tam 3 satır, hepsi PSI-26 (41, 47, 71); hepsi unknown'dan değişti |

Ayrıca `tests/test_etl.py`: kritik hata **0**.

---

# YAMA v3 (2026-11-14) – küçük yama + freeze

- **Yedek:** `ETL/backup/v3_oncesi/` (salt okunur).
- **Config:** `column_map.final.yaml` yerinde güncellendi; her satırda `# v3:` yorumu var.
- **Değer düzeltme yok:** raw_json önce/sonra birebir aynı (V3).
- **Satır sayısı değişmedi:** 1805 (V4).
- **Kurallar:** Ekstra indirme yapılmadı. Planned_Test Matrix açılmadı. Git işlemi yapılmadı.

## Ne değişti
| # | Değişiklik | Etki |
|---|---|---|
| 1 | Yakıt kolonu: PSI-20 `Fuel Bottle`, PSI-99 / PSI-100 `Material` eşlendi | Boş yakıt **174 → 122**. PSI-20: 43/43 doldu ("100% C2H4" 21, "50% C2H4" 11, "100%C2H4" 6, "100% CH4" 5). PSI-100: 2/2 doldu. PSI-99: 7/9 doldu; 2 satırda kaynak hücre boş (2-6, 2-9). |
| 1b | PSI-10 inverse yakıt türetmesi (C2H4, XC2H4 kolonundan) **UYGULANMADI** | Ön kontrol: Normal Flame dosyasında 'Fuel' = **C2H4 187 + C3H8 20**, yani tek değer değil. Talimat "farklıysa uygulama" dediği için 120 satır boş kaldı. Destekleyen kanıt: PSI-10 Final Report inverse testler için "chamber filled with a mixture of nitrogen and ethylene (C2H4)". Uygulanacaksa yaml'daki yorum satırı hazır (`fuel_derived`). |
| 2 | `outcome_confidence` (high / low / boş) + `outcome_parsed_text` bayrağı; PSI-26 kuralları sertleştirildi; `out/psi26_outcome_review.csv` | high 606 · low 59 · boş 1140. `outcome_parsed_text` 70 satır (PSI-25 + PSI-26). İnceleme dosyası 44 satır: 34 etiketli + 10 ambiguous; tam metin ve eşleşen regex'ler dahil. |
| 3 | `o2_pct_min_effective` / `o2_pct_max_effective` (tüm satırlar); PSI-20 tablo notu ve "Flames Ignited (gün toplamı)" geometry_note'a eklendi; bayrak `ignited_level_per_notes` | Effective ≠ ham yalnızca 2 satırda (PSI-20 r6-1: 3400 → 34; r9-1: 2100 → 21). Moon box ham 87 / effective 87, fark yok. `ignited_level_per_notes` 43 satır; outcome değişmedi. |
| 4 | quality_log detayı bayrak bazında; ortak detay artık kopyalanmıyor | 1466 → 1584 kayıt (+43 ignited_level, +70 outcome_parsed_text, +5 outcome_ambiguous). Detayı boş kayıt %91 (mesajı olmayan bayraklar). |
| 5 | Doğrulama raporu: tekrar bölümü ikiye ayrıldı; tekillik assert'i eklendi; boş kaynak izi kolonları açıkça yazılıyor | 4a birebir kopya 42 (PSI-107 34, PSI-39 8). 4b aynı test_id + farklı içerik: PSI-26'da 5 çift (24, 85, 89, 90, 91), PSI-39'da yok. 4c (psi_id, test_id, source_file, source_row) **tekil ✔**. `license` boş 327 = yalnızca PSI-10. Kritik hata **0**. |
| 6 | Dışa aktarım: `experiments_dashboard.csv`, `data_dictionary.csv` (29 kolon), `moon_box_final.csv` (in_box 87 + edge 17 + near_miss 765, effective O2 ile) | — |

## PSI-26 outcome (önce → sonra)
| outcome | v2 | v3 |
|---|---|---|
| extinguished | 22 | 22 |
| sustained | 7 | 6 |
| no_ignition | 6 | 5 |
| blowoff | 4 | 1 |
| unknown | 83 | 88 (ambiguous 5 → 10) |

Değişen 5 satır:
- **60, 61, 63 (blowoff → unknown):** kısmi blowoff ya da "did not blow out".
- **68 (no_ignition → unknown):** "did not ignite first 2 attempts" ve ardından "ignited … flame".
- **45 (sustained → unknown):** Pozitif/negatif çakışma. Metin: "didn't complete change before burned out whole sample". Burada "didn't" aslında "complete change"i olumsuzluyor. Kural muhafazakâr davrandığı için doğru bir etiket kaybedildi; satır insan incelemesine bırakıldı.

Yeni kurallar (yaml `outcome.ambiguity_rules`, `pos_neg_conflict`):
- `no_ignition`: `did not ignite (on )?(the )?(first|initial|1st|2nd|\d+(st|nd|rd|th)?)( \d+)? (attempts?|tries|try)` tek başına sayılmaz. Olumsuzlanmamış `\bignited\b | \blit on\b | \bflame\b` geçiyorsa sonuç ambiguous.
- `blowoff`: `bottom half | top half | partial | but not | did not blow out` geçiyorsa ambiguous.
- Aynı kategori için hem olumlu hem olumsuz eşleşme varsa ambiguous.

## PSI-20 notunun kaynakta doğrulanması
BRE Final Report (`PSI-20_Reports_Final_20220201.pdf`), Tablo 1 dipnot 3, **PDF sayfa 24 (basılı sayfa 23)** — notu **destekliyor**: "where approximate concentrations for tests that ignited are listed". Aynı dipnotta "chamber pressures were also varied but are not identified in this summary table" ifadesi de var. Bu, PSI-20 basınç eşlemesinin rapordaki nominal atmosferlere dayanan bir varsayım olduğunu teyit ediyor.

## Kabul testleri (V1–V7)
| Test | Sonuç | Ayrıntı |
|---|---|---|
| V1 | **KALDI** | Boş yakıt 174 → **122**. Kalan: PSI-10 inverse 120 (ön kontrol koşulu sağlanmadı, bilinçli olarak uygulanmadı) + PSI-99 2 (kaynak hücre boş). Tahmin yapılmadı. |
| V2 | GEÇTİ | PSI-26 önce/sonra yukarıda; 5 değişikliğin her biri kurala bağlandı |
| V3 | GEÇTİ | 1780 kaynak satırının raw_json'u birebir aynı (fark 0) |
| V4 | GEÇTİ | 1805 → 1805 |
| V5 | GEÇTİ | Moon box ham 87 = effective 87 (fark 0) |
| V6 | GEÇTİ | quality_log'da (psi, test, row, flag) tekrarı 0 |
| V7 | GEÇTİ | experiments_dashboard 1805 satır = experiments 1805; raw_json yok; effective, confidence ve grade kolonları var |

**V1'i kapatmak için iki karar gerekiyor:**
- **(a) PSI-10 inverse:** Final Report kanıtıyla `fuel_derived` satırının açılması. Sonuç: 120 satır `C2H4 (turetilmis: XC2H4 kolonu)` + bayrak `fuel_derived_from_column`.
- **(b) PSI-99 2-6 ve 2-9:** Kaynakta Material boş. ReadMe Tablo 1'deki örnek listesinden elle teyit edilebilir; tahmin edilmedi.

## Dashboard notu (v3)
- **O2 filtresi ve grafikleri:** `o2_pct_min_effective` / `o2_pct_max_effective` kullanın. Ham `o2_pct_*` kolonları denetim içindir.
- **Sonuç güveni:** `outcome_confidence` (high / low). Low = serbest metin; inceleme dosyası `psi26_outcome_review.csv`.
- **Tekil anahtar:** `(psi_id, test_id, source_file, source_row)`. `test_id` tek başına tekil değil.
- **Yeni bayraklar:** `outcome_parsed_text`, `ignited_level_per_notes`. `fuel_derived_from_column` tanımlı ama şu an kullanılmıyor.

---

# YAMA v2 (2026-11-14)

- **Config:** `ETL/config/column_map.final.yaml` (= verified + v2 değişiklikleri). `column_map.verified.yaml` değişmedi; sha256 `dc8760f8…fbffe0` aynı kaldı.
- **Kod:** `etl.py` v2 ve `common.py` güncellendi.
- **Yedekler** (salt okunur):
  - `ETL/backup/etl.py.20261114`
  - `ETL/backup/common.py.20261114`
  - `ETL/backup/test_etl.py.20261114`
  - `ETL/backup/RAPOR_ETL.md.20261114`
  - `ETL/backup/out_pre_v2/` (eski `ETL/out`'un tam kopyası)
- **Ölçümler:** `ETL/audit_v2/before.json` ve `after.json`. Kabul testleri: `ETL/audit_v2/acceptance.md`.
- **Değer düzeltme yok:** Ham hücreler değişmedi; yalnızca bayrak, not ve türetilmiş kolon eklendi (T11). Planned Test Matrix dosyası açılmadı, kopyalanmadı, loglanmadı.

## Ne değişti (etkilenen satır sayılarıyla)
| # | Değişiklik | Etkilenen satır |
|---|---|---|
| 1.1 | `parse_cell`: birimler (cm/s, mm/s, atm, mmHg, torr, psia, psi, bar, kPa, %, vol%) token'lara bölünmeden **önce** ayıklanıyor. Ayrıca "3-4" gibi aralıklar artık negatif sayı sayılmıyor. | Akış: PSI-99 0→**9** (20 cm/s), PSI-100 0→**2** (30 cm/s), PSI-25 105→106 ("10, 3-4" türü aralık). Hiçbir investigation'da azalma yok. |
| 1.2 | Kolon takma adı listesi + tire/boşluk normalizasyonu (`Self -ext` = `Self-ext`) | `column_mismatch` 179 → **0** (PSI-159 Normal Flames; readiness artık HAZIR) |
| 1.3 | Tabloda O2 kolonu olmayanlarda `unverified_unit:o2` yerine `o2_not_in_table` | PSI-100: 2, PSI-107: 469 |
| 1.4 | `is_duplicate` + `exact_duplicate_source` (aynı dosya, aynı raw_json, farklı satır; satırlar **silinmedi**) | PSI-39: **8** (8 id × 2). Ek bulgu: PSI-107'de 34 birebir kopya (kaynakta). |
| 2.1 | PSI-159 outcome kuralları: `cool_flame` / `no_hot_ignition` / `outcome_conflict`; ek bayrak `cool_flame_observed` | Eski 62 `no_ignition` satırı: 21106 F2 ve F5 → `cool_flame`; 21106 F4 → `unknown` + `outcome_conflict`; 59 satır → `no_hot_ignition`. `cool_flame_observed`: 7 satır. |
| 2.2 | PSI-69: Disruption → `droplet_disruption` (Completion → sustained eşlemesi değişmedi) | **61** satır; kenar bölgesindeki 17 satırın 15'i |
| 2.3 | PSI-26: koşul sayfasından akış ("Air display", PSI-25 kuralı) ve gözlem metninden outcome (katı regex + olumsuzluk koruması) | Akış 0 → **104**; outcome ≠ unknown 0 → **39** (extinguished 22, sustained 7, no_ignition 6, blowoff 4); `outcome_ambiguous` 5 |
| 3.1 | PSI-26: O2 `fraction` (VERIFY kaldırıldı); bileşik join anahtarı + tarih normalizasyonu; "ilk eşleşmeyi al" kaldırıldı | `unverified_unit:o2` 122 → **0**; `join_multiple` 10 → **0** (ayrıntı aşağıda); `join_unmatched` 1 (satır 67, kaynakta As Run Test # boş – önceden de vardı) |
| 3.2 | PSI-20: O2 açılımı (seviye başına satır) + rapor basınç eşlemesi + `o2_pct_report` | 18 → **43** satır (+25). `pressure_assumed_from_report` 27; eşlemesiz seviye (%25/%40) 16; `o2_value_from_report` 2 (r6 "3400%" → 34, r9 "2100%" → 21) |
| 3.3 | PSI-100 `flow_conflict_publication` | 2 |
| 3.4 | PSI-10 "RAMP" → `flow_ramp` (değer null) | 9 |
| 3.5 | PSI-25 B14 known_issue metni güncellendi | 1 |
| 3.6 | PSI-99 µ-g notu (`geometry_note`) | 9 |
| 3.7 | Yaml'daki her değişiklikte `# v2: <neden>, <kanıt>` yorumu | — |
| 4 | `evidence_grade` kolonu (A / B / C / D) | 1805 (boş yok) |
| 5 | Moon box raporu yeniden üretildi (7 bölüm) | kutu 74 → **87** (+13 PSI-20, C sınıfı) |
| 6 | Tek indirme: PSI-102 "Detection of Smoke from Microgravity Fires_paper.2005.doc" | HTTP 200, 1 608 192 bayt, sha256 `67ede025…dbc2347`. MANIFEST'e eklendi. antiword ile metne çevrildi → `ETL/audit_v2/…doc.txt`. SAE telifli makale; yeniden dağıtılmamalı. |
| 7 | `ETL/DATA_CARD.md` | — |

**Talimattan iki bilinçli sapma (ikisi de veri korumak için):**
- **(a) PSI-26 bileşik anahtarına üçüncü bileşen olarak `Test #` ↔ `Test no.` eklendi.** Talimattaki ["As Run Test #", "Date"] anahtarıyla 4 satır hâlâ çoklu eşleşiyordu: As-run 24 ve 85, kaynakta **aynı tarihte** ikişer kez geçiyor ve yalnızca Test # (12-R / 12-R2, 117 / 117a) ile ayrışıyor. Bu, 8.3 kapsamındaki 1. düzeltme turuydu; sonuçta çoklu eşleşme 0 oldu ve eşleşmeyen satır sayısı artmadı.
- **(b) `is_duplicate` kontrolü tüm investigation'lara uygulandı,** yalnızca PSI-39'a değil. PSI-107'de de 34 kaynak kopyası bulundu; hiçbiri silinmedi.

**PSI-26 outcome anahtar kelimeleri (regex, küçük harf):**
- **Olumsuzluk koruması:** Eşleşmeden önceki 30 karakterde "not / no / n't / never / without" geçiyorsa (cümle sonuna kadar), eşleşme sayılmıyor.
- **Birden fazla kategori** eşleşirse sonuç `unknown` + `outcome_ambiguous`.

Kategoriler ve kalıpları:
- **extinguished:** `\bself[- ]?extinguish\w*`, `\bextinguish(ed|es)?\b`, `\bwent out on its own\b`
- **blowoff:** `\bblow ?off\b`, `\bblew (off|out)\b`, `\bblow(n)? out\b`
- **sustained:** `\bburned to completion\b`, `\bburned completely\b`, `\bburned out (the )?(whole |entire )?(sample|fuel)\b`, `\bkept (going|burning)\b`, `\bsteady spread\b`, `\bsustain\w*`, `\bpropagat\w*`
- **no_ignition:** `\bno ignition\b`, `\bdid not ignite\b`, `\bdidn't ignite\b`, `\bfailed to ignite\b`

Örnekler (her kategoriden 5; metin kısaltıldı):
- **extinguished (22):**
  - [1] "…Steady spreading… Decreasing flow shrinks flame…"
  - [9] "…To extinguish, turned flo…"
  - [10] "Turned blue and extinguished when fan off…"
  - [17] "Adjusted igniter closer. LOS after fan change…"
  - [18] "…turned flow down to 40.5ish flame extinguished."
- **blowoff (4):**
  - [60] "…flame was strong when flow…"
  - [61] "blew out bottom half, but not top half…"
  - [62] "flame did blow out with GN2 at about a pot 6."
  - [63] "Stag blew out at 3.5, … did not blow out at 10."
- **sustained (7):**
  - [38] "Flame propagated to ~1 cm of end."
  - [45] "steady spread at 9 cm/s! … burned out whole sample."
  - [48] "Burned to completion."
  - [66] "flame kept going… to end of sample."
  - [83] "dim flame propagates upstream…"
- **no_ignition (6):**
  - [24] "did not ignite but smoked."
  - [43] "just smoked slightly, no ignition."
  - [56] "Did not ignite. Not even any smoke."
  - [68] "…new igniter…"
  - [101] "no ignition, despite prolonged attempted ignition."
- **unknown / ambiguous (5):**
  - [3] "Blew off stagnation region but N2 did not extinguish wake…"
  - [25] "flame died when turned down…"
  - [39] "…very sooty…"
  - [53] "…long sooty tail…"
  - [91] "…No joy even at max GN2. Extinguished when flow off."

**Sınırlar:** blowoff örneklerinin bir kısmı kısmi (örneğin "bottom half"); extinguished örneklerinin bir kısmı operatörün akışı kesmesiyle oluşmuş. Bu ayrım yapılmadı (`outcome_source = parsed_text`).

## Önce / sonra
| Ölçüt | Önce | Sonra |
|---|---|---|
| experiments satırı | 1780 | **1805** (1780 + 25 PSI-20 açılımı) |
| quality_log kaydı | 1572 | 1466 |
| outcome ≠ unknown | 571 | **670** |
| Moon box (O2 ≥ 30 ve p ≤ 0.694) | 74 | 87 |
| A sınıfı satır kutuda | — | 20 (= PSI-159 Normal Flames temiz 20) |

**Outcome dağılımı:**
| outcome | önce | sonra |
|---|---|---|
| unknown | 1209 | 1135 |
| extinguished | 386 | 408 |
| sustained | 115 | 122 |
| no_ignition | 64 | 8 |
| blowoff | 6 | 10 |
| droplet_disruption | — | 61 |
| no_hot_ignition | — | 59 |
| cool_flame | — | 2 |

**Unknown sayısı (investigation bazında, önce → sonra):**
- **Değişenler:**
  - PSI-69: 61 → 0
  - PSI-26: 122 → 83
  - PSI-159: 0 → 1 (outcome_conflict)
  - PSI-20: 18 → 43 (açılım; tablo gün özeti olduğu için sonuç yok)
- **Değişmeyenler:**
  - PSI-10: 327
  - PSI-107: 469
  - PSI-25: 104
  - PSI-39: 87
  - PSI-68: 8
  - PSI-98: 2
  - PSI-99: 9
  - PSI-100: 2

**evidence_grade dağılımı (sonra):**
| PSI | A | B | C | D |
|---|---|---|---|---|
| PSI-10 | 207 | 109 | 0 | 11 (RAMP / LOW O2 → O2 yok) |
| PSI-20 | 0 | 0 | 27 | 16 (eşlemesiz %25/%40 → basınç yok) |
| PSI-25 | 0 | 0 | 129 (basınç varsayımı) | 0 |
| PSI-26 | 121 | 0 | 0 | 1 |
| PSI-39 | 79 | 0 | 8 (birebir kopya) | 0 |
| PSI-68 | 0 | 0 | 8 (özet) | 0 |
| PSI-69 | 273 | 0 | 1 (0 mmHg) | 0 |
| PSI-98 / 99 / 100 | 0 | 0 | 0 | 2 / 9 / 2 (basınç yok) |
| PSI-107 | 0 | 0 | 0 | 469 (O2 / basınç yok) |
| PSI-159 | 179 | 154 | 0 | 0 |
| **Toplam** | **859** | **263** | **173** | **510** |

**Bayrak dağılımı (değişenler, önce → sonra):**
- **Kalkanlar:**
  - column_mismatch 179 → 0
  - unverified_unit:o2 593 → 0
  - join_multiple 10 → 0
- **Azalan:** non_numeric:o2 11 → 2 (RAMP satırları artık `flow_ramp`)
- **Yeni bayraklar:**
  - o2_not_in_table 0 → 471
  - exact_duplicate_source 0 → 42
  - exploded_from_multivalue 0 → 41
  - pressure_assumed_from_report 0 → 27
  - pressure_unmapped_level 0 → 16
  - flow_ramp 0 → 9
  - cool_flame_observed 0 → 7
  - flow_conflict_publication 0 → 2
  - o2_value_from_report 0 → 2
  - outcome_conflict 0 → 1
- **Artanlar:**
  - summary_row 26 → 51 (PSI-20 açılımı)
  - multivalue:flow 70 → 124 (PSI-26 akışı)
  - censored_lt:flow 4 → 10
  - outcome_ambiguous 1 → 6
- **Değişmeyenler:**
  - o2_oxidizer_stream 274
  - pressure_assumed 129
  - known_issue 9
  - o2_derived 9
  - out_of_range:flow 8
  - out_of_range:o2 2
  - zero_value:pressure 1

## Kabul testleri (T1–T13): hepsi GEÇTİ (ayrıntı `ETL/audit_v2/acceptance.md`)
| Test | Sonuç | Gerçek sayılar |
|---|---|---|
| T1 | GEÇTİ | PSI-99 akış dolu 9 (hepsi 20 cm/s); PSI-100 2 (30 cm/s) |
| T2 | GEÇTİ | Hiçbir investigation'da dolu akış azalmadı (PSI-25 105 → 106, PSI-26 0 → 104) |
| T3 | GEÇTİ | Kutudaki 20 Normal Flames satırında column_mismatch 0; tüm Normal Flames'te 0 (önce 179) |
| T4 | GEÇTİ | "direct cool" satırları F2 ve F5 → cool_flame; F4 → unknown + outcome_conflict; PSI-159'da no_ignition kalmadı |
| T5 | GEÇTİ | PSI-69 droplet_disruption = 61 |
| T6 | GEÇTİ | PSI-26: unverified_unit:o2 122 → 0; join_multiple 10 → 0; akış 0 → 104; outcome ≠ unknown 0 → 39; O2 dolu 121 → 121 |
| T7 | GEÇTİ | PSI-20: 43 satır; pressure_assumed_from_report 27. 0.558 atm (13): r3-2, r4-3, r6-1, r7-2, r8-2, r10-3, r11-2, r12-2, r13-2, r16-1, r17-2, r18-3, r19-2. 0.694 atm (9): r2-2, r3-1, r4-2, r5-1, r7-1, r8-1, r10-2, r12-1, r18-2 |
| T8 | GEÇTİ | PSI-100: o2_not_in_table 2/2; PSI-107: 469/469; unverified_unit:o2 0 |
| T9 | GEÇTİ | PSI-39 is_duplicate = True 8 satır (8 id), satır sayısı 87 (silinmedi) |
| T10 | GEÇTİ | evidence_grade boş 0; A 859, B 263, C 173, D 510 |
| T11 | GEÇTİ | Toplam 1805 = 1780 + 25. Kaynak satır anahtarı bazında raw_json farkı 5 satır (yalnız PSI-26 "conditions" eki; bileşik join yeni koşul satırı eşledi ya da boş bıraktı). Ham tablo hücresi farkı: **0** |
| T12 | GEÇTİ | Kutu 74 → 87; eklenen 13 satırın hepsi PSI-20 (açılım + rapor basınç eşlemesi; C sınıfı); çıkan 0 |
| T13 | GEÇTİ | 30 rastgele satır (seed 20261114) kaynaktan yeniden okundu: 30/30 aynı → `ETL/out/spotcheck_v2.csv` |

Ayrıca `tests/test_etl.py` (açılımı tanıyacak şekilde güncellendi): **kritik hata 0**.

## Moon box bulgusu (v2)
- **A sınıfı (temiz) 20 satır:** PSI-159 Normal Flames (bütan ve etan karışımları, O2 %31–39, 0.50 atm). Sonuçlar: 13 extinguished, 4 sustained, 2 cool_flame (F2, F5), 1 unknown + outcome_conflict (F4).
- **B sınıfı 46 satır:** PSI-159 inverse 28 + PSI-10 inverse 18. O2 oksitleyici akışının oranı, ortam değil.
- **C sınıfı 21 satır:** PSI-20 13 (rapor basıncıyla; %34 / 0.558 atm) + PSI-68 8 (özet satırlar).
- **Kenar bölgesi** (O2 ≥ 30 ve 0.694 < p ≤ 0.75): PSI-69 FLEX 17 satır (%30–34 O2, 0.703–0.714 atm = 10.33–10.50 psi); bunların 15'i droplet_disruption, 2'si sustained.
- **Katı yakıt:** Moon box'ta katı yakıt **YOK**. Katı yakıt için en yüksek O2 %22.7 (PSI-26).

## Yapılamayanlar / açık sorular (değişmedi)
- **PSI-107:** 8 satırda negatif hava hızı (−0.28, −5.92), açıklama yok.
- **FLEX-114:** basınç 0 mmHg (NASA TP'de de 0).
- **PSI-25:** B14 satırında CO2/CO yer değişimi şüphesi (doğrulanamadı); basınç için 1 atm varsayımı.
- **PSI-10:** lisans yok (PSI ve DataCite); "LOW O2" tanımı yok.
- **PSI-100:** yayın O2'si (B2) uygulanmadı.
- **Bilerek satır bayrağı yapılmayanlar:** B4 (SE sonrası soğuk alev) ve B5 (flash ignition); ikisi yalnızca DATA_CARD'da.
- **Yakıt kolonu eşlenmemiş:** PSI-20, PSI-99 ve PSI-100'de `fuel_or_material` boş (yaml'da kolon yok: "Fuel Bottle" / "Material"). Bir sonraki turda eklenebilir.

## Dashboard geliştiricileri için değişiklik notu
- **Yeni outcome değerleri:** `cool_flame`, `no_hot_ignition`, `droplet_disruption`. `no_ignition` artık yalnızca PSI-25/26 metin sonuçlarında geçiyor.
- **Yeni kolonlar:**
  - `evidence_grade` (A / B / C / D): filtrelerde "temiz" = A.
  - `is_duplicate` (bool): istatistiklerde kopyaları dışlamak için.
  - `o2_pct_report` (PSI-20'de 2 satır).
  - `pressure_is_assumed` (bool).
- **Anlamı genişleyen kolon:** `pressure_atm_assumed` artık PSI-20 rapor eşlemesini de taşıyor.
- **Yeni satır kimlikleri:** PSI-20 satırları `PSI-20-r<kaynak satır>-<n>` biçiminde (eski `PSI-20-r<satır>` kimlikleri kalktı). Tekil anahtar olarak `psi_id` + `test_id` ya da `source_file` + `source_row` + `test_id` kullanın.
- **Yeni bayraklar:**
  - o2_not_in_table
  - exact_duplicate_source
  - exploded_from_multivalue
  - pressure_assumed_from_report
  - pressure_unmapped_level
  - flow_ramp
  - flow_conflict_publication
  - cool_flame_observed
  - outcome_conflict
  - o2_value_from_report
- **Kalkan bayraklar:** `column_mismatch` (artık üretilmiyor) ve `unverified_unit:o2` (PSI-26 doğrulandı; diğerleri `o2_not_in_table` oldu).

---

# (Önceki rapor – değiştirilmeden korunmuştur)

# RAPOR_ETL – Flame in Freefall veri hazırlığı ve ETL

- **Tarih:** 2026-11-14
- **Proje kökü:** `<project root>`
- **Config:** `ETL/config/column_map.verified.yaml` (orijinal `column_map.yaml` değiştirilmedi)
- **Korunan klasörler:** `PSI_INVESTIGATIONS`, `DESTEK_KAYNAKLAR`, `PROJE_VERI` ve `PROFILLER` içindeki mevcut dosyalar değiştirilmedi, silinmedi. Yeni dosyalar yalnızca eklendi.
- **Veri değerleri düzeltilmedi.** Şüpheli değerler olduğu gibi alındı ve `quality_flag` ile işaretlendi.
- **Python:** `python` komutu yalnızca Microsoft Store kısayolu olduğu için `py` (3.11.9) kullanıldı. Scriptler `-P` ile çalıştı (betik ve çalışma dizini sys.path'e eklenmez).

## 1. Yapılanlar (fazlar)
| Faz | Sonuç | Çıktı |
|---|---|---|
| 0 Hazırlık | `column_map.yaml` mevcut; `ETL/src, out, logs, verify, tests` oluşturuldu; MANIFEST, TABLO_KATALOGU ve PROJE_VERI mevcut. Kurulanlar: pyyaml 6.0.3, openpyxl 3.1.5, xlrd 2.0.2. Zaten kurulu olanlar: pandas 3.0.5, pyarrow 26.0.1. | `logs/00_preflight.md` |
| 1 Eksik veri | 25 dosya indirildi (57.9 MB), 3 zip güvenli biçimde açıldı (11 dosya), 3 dosya indirilemedi (HTTP 404). Kopyalar `PROJE_VERI/<inv>/02_docs/` altında (36 dosya). MANIFEST'e 36 satır eklendi (25 `indirildi`, 11 `zipten_acildi`); bu dosyaların önceki turdan kalan `atlandi` satırları değiştirilmedi. SAFFIRE MergeResult dosyaları tanımlandı. | `logs/01_downloads*.csv`, `logs/01_saffire_mergeresult.md` |
| 2 Hazırlık denetimi | 12 Tier-1 investigation: 11 HAZIR, 1 KISMEN (PSI-159). | `out/readiness.csv`, `out/readiness_report.md`, `out/readiness_status.csv` |
| 3 Kapı | **GEÇTİ.** Kritik investigation'ların (PSI-25, 26, 69, 159, 10) hiçbiri EKSIK değil. | readiness_report.md |
| 4 VERIFY | 7 madde + 1 ek madde. 9 alt bulgu yüksek güvenle doğrulandı, 2'si orta, 3'ü belirsiz. | `verify/verify_log.md`, `config/column_map.verified.yaml` |
| 5 ETL | 1780 deney satırı, 1572 quality_log kaydı, 25 investigation. | `out/experiments.*`, `out/quality_log.csv`, `out/investigations.csv`, `out/experiments.sqlite` |
| 6 Doğrulama | **Kritik hata 0.** Satır sayıları kaynakla birebir uyuşuyor; spotcheck 101 satırda raw_json ile kaynak birebir aynı. | `out/validation_report.md`, `out/spotcheck.csv` |

## 2. Yeni indirilen dosyalar (Faz 1)
| PSI | Dosya | MB |
|---|---|---|
| PSI-20 | Presentations (10 PDF: ACME CSSCI 2014/2022, ASGSR 2012/2013, AIAA 2012, CIR IAC 2008, poster, pictorial overview…) | 25.1 |
| PSI-20 | Science Documents: *ACME BRE Data interpretation.zip* → 2 PDF (ACME non-imaging data file description, ACME-DOC-010_D) | 1.89 |
| PSI-22 | Science Documents: *ACME Data interpretation.zip* → 2 PDF | 1.89 |
| PSI-22 | Science Documents: *ACME Gas flow.zip* → 7 dosya (flow conversion PDF, Hastings manual, ACMEFlowCalculator.xlsx, GasDataTables.xls, …) | 2.31 |
| PSI-26 | Presentations: 5 PDF + 1 PPTX (BASS overview, crew training 2010/2011, fabric flammability) | 14.28 |
| PSI-39 | Presentations: 2 PDF (Cool Flames in Space; Cool-Flame Supported Droplet Combustion) | 5.67 |
| PSI-69 | Presentations: 4 PDF | 6.74 |
| **Toplam** | **25 dosya** (+ zip'lerden açılan 11) | **57.9** |

- **Presentations klasörü olmayanlar:** PSI-25, 68, 98, 99. Bu yüzden onlardan indirilecek bir şey yoktu.
- **Kural gereği atlananlar:** PSI-20'nin 3 videosu (.mp4).
- **İndirilemeyenler:** PSI-100'ün 3 sunumu (SAFFIRE 45./46./47. ICES). Presign başarılı oldu ama S3 **HTTP 404 Not Found** döndürdü. 2 kez daha denendi, sonuç aynı. Dosya sunucuda yok.
- **MANIFEST notu:** Yeni satırlardaki `download_time`, MANIFEST'in eklendiği 3. çalıştırmanın zamanı. Gerçek indirme kaydı `logs/01_downloads_ilk_indirme.csv` dosyasında.
- **İlk denemede tüm indirmeler başarısız oldu (HTTP 400):** Sebep, kendi scriptimin GET isteklerine `Content-Type: application/json` başlığı eklemesiydi. Başlık yalnızca POST'a özel yapıldı ve yeniden çalıştırıldı.

## 3. Hazırlık sonucu (Faz 2 / 3)
| PSI | Durum | Not |
|---|---|---|
| PSI-25 | HAZIR | Basınç kolonu yok, yalnızca `pressure_assumed`. better_source `BASS-II_Test_Matrix_by_PI_Final.xlsx` bu adla yok; benzeri `…BASS-II_Test.Matrices.xlsx` (kullanılmadı). |
| PSI-26 | HAZIR | Koşullar As-Run matrisinde; 121/122 satır birleşti. |
| PSI-69 | HAZIR | — |
| PSI-68 | HAZIR | Özet tablo (8 satır) |
| PSI-98 | HAZIR | 4 ham satırın 2'si test-dışı |
| PSI-99 | HAZIR | 15 ham satırın 6'sı test-dışı |
| PSI-100 | HAZIR | O2 kolonu yok |
| **PSI-159** | **KISMEN** | Normal Flames dosyasında `Self -ext or flow term` kolonu yalnızca bulanık eşleşmeyle bulundu (`Self-ext or flow term`). Bu dosyanın 179 satırı `column_mismatch` aldı. Inverse dosyasının 1015 satırının 861'i tamamen boş. |
| PSI-10 | HAZIR | — |
| PSI-39 | HAZIR | — |
| PSI-20 | HAZIR | Gün düzeyi özet |
| PSI-107 | HAZIR | O2 ve basınç kolonu yok |

- Yaml'da hiç geçmeyen experimental table yok: TABLO_KATALOGU'ndaki diğer tablolar catalog_only listesinde.
- Yaml'daki beklenen satır sayıları ham dosya satırlarıyla tutuyor. Gerçek test satırı farkları: PSI-159 −861 (boş satır), PSI-99 −6, PSI-98 −2 (test-dışı satırlar).

## 4. VERIFY sonuçları – kanıt tablosu (ayrıntı: `verify/verify_log.md`)
| # | Madde | Sonuç | Güven | Yaml'da |
|---|---|---|---|---|
| 1a | PSI-69 "CO" kolonu | **CO2** (Test Plan: "Suppressant: CO2", XN2 = 1 − XO2 − XCO2; satır toplamı 1) | yüksek | VERIFY kaldırıldı, `diluent_names` eklendi |
| 1b | PSI-69 "Test end" | Extinction 186 / Completion 27 / Disruption 61. Disruption'ın anlamı belirsiz. | yüksek / belirsiz | `map`: Extinction→extinguished, Completion→sustained, Disruption→unknown |
| 2a | PSI-99 "Note 1" | O2, ölçülen CO2 üretiminden **türetilmiş**; ISS başlangıç O2'sine referanslı | yüksek | `derived: true` → bayrak `o2_derived` |
| 2b | PSI-99 "?-g" | Muhtemelen µ-g; doğrudan tanım yok | orta | VERIFY korundu |
| 3a | PSI-100 akış | cm/s (hücrede "30 cm/s" yazıyor; doküman da 30 cm/s diyor) | yüksek | `unit: cm_s_in_cell` |
| 3b | PSI-100 O2 | ReadMe I & III'te test bazında O2 yok | belirsiz | VERIFY korundu, O2 = null |
| 4 | PSI-39 basınç | atm (hücrede "1 atm" yazıyor) | yüksek | `unit: atm_in_cell` |
| 5a | XO2 anlamı (PSI-10, 159) | Inverse = **oksitleyici akışı** (ortam değil); Normal = ortam | yüksek | `meaning` alanı → bayrak `o2_oxidizer_stream` |
| 5b | "approx p (bar)" | bar doğru (değerler = yuvarlak atm × 1.01325) | yüksek | yorum eklendi |
| 6 | PSI-25 basınç | Summary Report "Ambient pressure was 1 atm"; SRD ve ReadMe'de yok | orta | VERIFY korundu; `pressure_atm_assumed = 1.0` (min/max boş) |
| 7a/b | PSI-26 sayfa ve anahtar | "as run matrix" sayfası; `As Run Test #` ↔ `As run test no.` | yüksek | `conditions_sheet`, `conditions_join_key`, `test_id` |
| 7c | PSI-26 O2 birimi | Hücre biçimi `0.000`, **yüzde biçimi değil** (yaml varsayımı doğrulanamadı) | belirsiz | VERIFY korundu → `unverified_unit:o2` |
| 8 | PSI-159 SE / FT | SE = doğal sönme, FT = komutla akış kesilmesi (ACME SORD) | yüksek | `outcome.rules` |

## 5. Satır sayıları (investigation bazında)
| PSI | faz | experiments | O2 % (min–max) | basınç atm (min–max) | akış cm/s | outcome dağılımı |
|---|---|---|---|---|---|---|
| PSI-25 BASS-II | solid | 129 | 13.6–22.2 (initial) | — (varsayım 1.0) | 0–62 (Air display) | blowoff 6 · extinguished 17 · no_ignition 2 · unknown 104 |
| PSI-26 BASS | solid | 122 | 16.05–22.72 (×100, unverified) | 0.97–1.009 | — | unknown 122 |
| PSI-98 SAFFIRE-I | solid | 2 | 21.5–21.7 | — | 20 | unknown 2 |
| PSI-99 SAFFIRE-II | solid | 9 | 21.5–22.1 (türetilmiş) | — | — | unknown 9 |
| PSI-100 SAFFIRE-III | solid | 2 | — | — | — (birim cm/s; değer "30 cm/s") | unknown 2 |
| PSI-69 FLEX | liquid | 274 | 12–34 | 0–3.05 | — | extinguished 186 · sustained 27 · unknown 61 |
| PSI-68 FLEX-2 | liquid | 8 (özet) | 17–30 | 0.5–3 | 0.1–5 | unknown 8 |
| PSI-39 CFI | liquid | 87 | 17–21 | 0.5–5 | — | unknown 87 |
| PSI-159 CFI-G | gas | 333 (154 inv + 179 nor) | 12–85 | 0.489–3.27 | — | extinguished 183 · sustained 88 · no_ignition 62 |
| PSI-10 Flame Design | gas | 327 | 19.7–85 | 0.42–3.03 | — | unknown 327 |
| PSI-20 BRE | gas | 18 (gün özeti) | 21–3400 (anomali dahil) | — | — | unknown 18 |
| PSI-107 SPICE | gas | 469 | — | — | −5.92–85.28 | unknown 469 |
| **Toplam** | | **1780** | | | | |

- **Kaynak izi:** Her satırda `psi_id`, `source_file`, `source_row` (dosyadaki satır no; başlık = 1), `raw_json` (orijinal satırın tüm kolonları; PSI-26'da tablo ve koşul satırı birlikte), `investigation_doi` ve `license` var.
- **PSI-10 lisansı:** PSI metadata'sında lisans alanı **boş** olduğu için `license` boş bırakıldı (CC0 varsayılmadı). Diğerleri CC0-1.0.
- **catalog_only:** 13 investigation `investigations.csv` tablosuna girdi, experiments tablosuna girmedi.

## 6. quality_flag dağılımı (experiments satırları)
| bayrak | satır | anlamı |
|---|---|---|
| unverified_unit:o2 | 593 | PSI-26 (birim kanıtsız ×100), PSI-100 ve PSI-107 (O2 yok; ortam varsayımı doğrulanmadı) |
| o2_oxidizer_stream | 274 | PSI-10 ve PSI-159 inverse: XO2 brülör oksitleyicisinin oranı |
| column_mismatch | 179 | PSI-159 Normal Flames (KISMEN) |
| pressure_assumed / unverified_unit:pressure | 129 / 129 | PSI-25 (1 atm varsayımı, orta güven) |
| multivalue:flow / :o2 / :pressure | 70 / 27 / 8 | aralık ya da liste hücresi → min/max |
| non_numeric:flow / :o2 | 31 / 11 | sayısal olmayan → null |
| parsed_from_text:flow | 29 | PSI-25 "5 down to ext" gibi taramalardan sayı alındı |
| summary_row | 26 | PSI-68, PSI-20: test düzeyi değil |
| join_multiple / join_unmatched | 10 / 1 | PSI-26 As-Run anahtarı kaynakta tekrarlı ya da eşleşmiyor |
| known_issue | 9 | PSI-25: B2, P22a, P22b, T28a, T28b, T9, T18, O10, B14 |
| o2_derived | 9 | PSI-99 |
| approx | 8 + 1 | "~ 21.5" gibi değerler |
| out_of_range:flow / :o2 | 8 / 2 | PSI-107 negatif akış; PSI-20 "2100%", "3400%" |
| censored_lt / pot_setting_ignored (flow) | 4 / 4 | "<1" değerleri; fan pot ayarı akış sayılmadı |
| outcome_ambiguous | 1 | PSI-25 O22: hem ext hem blowoff geçiyor → unknown |
| zero_value:pressure | 1 | PSI-69 test 114: 0 mmHg |
| non_test_row (yalnızca quality_log) | 8 | PSI-98/99 F#C# ve Note satırları |

## 7. Moon box bulgusu (`out/moon_box_coverage.md/.csv`)
**Kutu:** o2_pct_max ≥ 30 **ve** pressure_atm_min ≤ 0.694 atm. Varsayılan basınç (PSI-25) kutuya dahil edilmedi.

| fuel_phase | PSI | kutuda | temiz* | not |
|---|---|---|---|---|
| gas | PSI-159 | 48 | **20** | 28'i inverse (O2 oksitleyici akışı) |
| gas | PSI-10 | 18 | 0 | hepsi inverse (oksitleyici akışı) |
| liquid | PSI-68 | 8 | 0 | özet satırı: O2 max ve p min aynı testte olmayabilir |

\* **temiz** = test düzeyi, ortam O2'si, anomalisiz.

- **20 temiz satırın hepsi PSI-159 normal alev:** 50% bütan, 30% etan ve 30% bütan; XO2 %31–39; basınç 0.50 atm. Bu satırlar `column_mismatch` taşıyor (yalnızca sonuç kolonundaki kolon adı farkı yüzünden; O2 ve basınç kolonları birebir eşleşti).
- **Yakın kaçanlar:**
  - PSI-69 FLEX: 30 satır O2 ≥ 25 (en fazla 34), 152 satır p ≤ 1 atm.
  - PSI-26 BASS: 111 satır p ≤ 1 atm (O2 ≤ 22.7).
  - PSI-39: 54 satır p ≤ 1 atm.
  - PSI-10 / 159: geniş O2 aralığı.
  - PSI-20: O2 40'a kadar, ama basınç yok.
- **Katı yakıt için ≥ %30 O2 verisi var mı? → HAYIR.**
  - BASS, BASS-II ve SAFFIRE'da ölçülen O2 en fazla ~%22.7.
  - PSI-25'teki 39.1 ve 40.4 değerleri "final O2" kolonunda ve bilinen hata. ETL yalnızca initial O2'yi kullandı; KAPSAM.csv'deki "O2 ≥ 30 evet" sonucu kullanılmadı.

## 8. Çözülemeyen sorunlar
1. **PSI-100'ün 3 sunumu** sunucuda yok (404).
2. **PSI-26 O2 birimi:** Başlık "%" diyor, hücre değerleri kesir (0.1605–0.221) ve biçim `0.000`. ×100 uygulandı ama kanıt yok (`unverified_unit`).
3. **PSI-69 "Disruption"** anlamı bulunamadı → outcome unknown (61 satır).
4. **PSI-99 "?-g"** anlamı yalnızca orta güvenle µ-g.
5. **PSI-25 basıncı:** 1 atm yalnızca varsayım (orta güven).
6. **Kaynakta tekrarlı test kimlikleri:**
   - PSI-39: 8 test numarası birebir kopya satır olarak 2'şer kez.
   - PSI-26: "As Run Test #" 5 değer tekrarlı.
   - Tekil anahtar olarak `source_file` + `source_row` kullanılmalı.
7. **PSI-107 SPICE:** 8 satırda negatif hava akışı (−0.28, −5.92). Değiştirilmedi, `out_of_range` ile işaretli.
8. **PSI-10:** Metadata'da lisans alanı boş.

## 9. Ekibin elle bakması gerekenler
- **PSI-20 O2 "2100%" / "3400%":** Kaynakta yazım hatası olabilir (21.00% / 34.00%). Kaynak sahibiyle teyit edin; ETL düzeltmedi.
- **PSI-69 test 114:** "Ambient pressure; mmHg" = 0.
- **PSI-25:**
  - `Air display` taramalarından alınan akış min/max'ı (`parsed_from_text`) gözle kontrol edin.
  - BASS-II ReadMe'ye göre O2 değerleri sabit ofsetle düzeltilmiş (sensör kalibre dışıydı).
  - Fan kalibrasyonu (U = 1.0066 × AirDisplay) **uygulanmadı**.
- **PSI-26 ↔ As-Run matrisi:** 1 eşleşmeyen ve 10 çoklu eşleşen satır (quality_log'da `join_*`).
- **PSI-159 / PSI-10 inverse satırları:** Moon box ya da "ortam O2" analizlerinde ayrı tutulmalı.
- **SAFFIRE MergeResult xlsx:** Test koşulu içermiyor; görüntü dosyası (jpeg/raw) envanteri (`logs/01_saffire_mergeresult.md`). 99_belirsiz'de kalabilir.

## 10. Yeniden çalıştırma
```
cd <project root>\ETL
py -P src\preflight.py
py -P src\faz1_download.py        (idempotent; var olan dosyayı tekrar indirmez)
py -P src\make_verified_yaml.py   (column_map.yaml → column_map.verified.yaml)
py -P src\readiness.py            (çıkış kodu 3 = kapı kapalı)
py -P src\etl.py
py -P tests\test_etl.py
```
Yeni investigation eklemek için yaml'a bir blok eklemek yeterli (`primary_file`, `o2`, `pressure`, `flow`, `outcome` …). Ardından `make_verified_yaml.py` (gerekirse kuralları güncelleyerek) ve `etl.py` çalıştırılır.

## 11. ETL/out içindeki dosyalar
| dosya | boyut |
|---|---|
| `out/_etl_run.json` | 1.2 KB |
| `out/experiments.csv` | 1,221.3 KB |
| `out/experiments.parquet` | 210.0 KB |
| `out/experiments.sqlite` | 1,420.0 KB |
| `out/investigations.csv` | 6.1 KB |
| `out/moon_box_coverage.csv` | 134.0 KB |
| `out/moon_box_coverage.md` | 1.8 KB |
| `out/quality_log.csv` | 135.0 KB |
| `out/readiness.csv` | 9.0 KB |
| `out/readiness_report.md` | 20.7 KB |
| `out/readiness_status.csv` | 0.3 KB |
| `out/spotcheck.csv` | 21.2 KB |
| `out/validation_report.md` | 3.0 KB |
