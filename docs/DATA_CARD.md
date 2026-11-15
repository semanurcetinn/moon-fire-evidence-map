> **English note:** this detailed data card is in Turkish; an English summary is in the root `README.md`.
> For the columns in English see `docs/COLUMNS.md`; the ranking method is in `docs/METHOD_RANKING.md`.

# DATA_CARD – NASA PSI yangın / yanma deney tablosu (ETL v3.1)

- **Sürüm:** v3.1 (freeze) · 2026-11-14 · satır **1805** · investigation **12** (Tier-1)
- **experiments.csv sha256:** `a1c837f40ad266cc533d9f92ba50032bf324c64051d4710887c0815abcee1838`
- **column_map.final.yaml sha256:** `6c82378ed7f22b43affbe43550fd37ac9bc810f216ef217721696b65aee80fd5`
- **etl.py sha256:** `41c7c285d62ffa62b57af942288de52bac8ac5642c58418c041267c683f3e32d`
- **experiments_dashboard.csv sha256:** `7967c53de47884511b104923b964f261c178bc2df34095bdda6188288b13ae70`
- **Dashboard notu:** Filtre ve grafiklerde O2 için **`o2_pct_min_effective` / `o2_pct_max_effective`** kullanın (PSI-20'de rapordan doğrulanmış %34 / %21 değerlerini taşır; ham `o2_pct_*` değişmez). Sonuç güveni için `outcome_confidence` (high = kaynak kolon; low = serbest metin `parsed_text` VEYA elle onay `manual_review`). Sözlük: `out/data_dictionary.csv`.
- **Lisans / atıf:** 24 investigation CC0-1.0 (PSI metadata). **PSI-10 için lisans belirtilmemiş** (PSI API ve DataCite `rightsList` boş) → CC0 VARSAYMAYIN; DOI ile atıf yapın. Her satırda `investigation_doi` var.

## Kapsam
- NASA PSI'daki **133** investigation'ın **24'ü Combustion Science**; bu 24'ün hepsi + **PSI-179 ASE** (kabin aerosolü) yerelde (25).
- Deney tablosuna (experiments) giren Tier-1: 12 investigation (PSI-10, 20, 25, 26, 39, 68, 69, 98, 99, 100, 107, 159). Diğer 13'ü `investigations.csv`'de catalog_only.
- Kapsam dışı: PSI-181 (lehim), PSI-108 (STDCE-1, yüzey gerilimi); ayrıca PSI-77, 95, 5, 81, 31 (anahtar kelime eşleşmesi; yanma değil).

## Alan doluluk (dolu satır %)

| psi_id | satır | o2 % | basınç % (ölçülen/tablo) | basınç % (varsayım dahil) | akış % | outcome % (≠unknown) | yakıt/malzeme % |
|---|---|---|---|---|---|---|---|
| PSI-10 | 327 | 97 | 100 | 100 | 0 | 0 | 100 |
| PSI-20 | 43 | 100 | 63 | 63 | 0 | 0 | 100 |
| PSI-25 | 129 | 100 | 0 | 100 | 82 | 19 | 100 |
| PSI-26 | 122 | 99 | 99 | 99 | 85 | 30 | 100 |
| PSI-39 | 87 | 100 | 100 | 100 | 0 | 0 | 100 |
| PSI-68 | 8 | 100 | 100 | 100 | 100 | 0 | 100 |
| PSI-69 | 274 | 100 | 100 | 100 | 0 | 100 | 100 |
| PSI-98 | 2 | 100 | 0 | 0 | 100 | 0 | 100 |
| PSI-99 | 9 | 100 | 0 | 0 | 100 | 0 | 78 |
| PSI-100 | 2 | 0 | 0 | 0 | 100 | 0 | 100 |
| PSI-107 | 469 | 0 | 0 | 0 | 95 | 0 | 100 |
| PSI-159 | 333 | 100 | 100 | 100 | 0 | 100 | 100 |

## evidence_grade dağılımı

| psi_id | A | B | C | D |
|---|---|---|---|---|
| PSI-10 | 207 | 109 | 0 | 11 |
| PSI-20 | 0 | 0 | 27 | 16 |
| PSI-25 | 0 | 0 | 129 | 0 |
| PSI-26 | 121 | 0 | 0 | 1 |
| PSI-39 | 79 | 0 | 8 | 0 |
| PSI-68 | 0 | 0 | 8 | 0 |
| PSI-69 | 273 | 0 | 1 | 0 |
| PSI-98 | 0 | 0 | 0 | 2 |
| PSI-99 | 0 | 0 | 0 | 9 |
| PSI-100 | 0 | 0 | 0 | 2 |
| PSI-107 | 0 | 0 | 0 | 469 |
| PSI-159 | 179 | 154 | 0 | 0 |

## Bilinen sınırlar
- **SE sonrası soğuk alev (B4):** PSI-159 'SE' (self-extinguished) sıcak alevin sönmesini gösterir; CFI-G Final Report'a göre soğuk alevler sıcak alev söndükten sonra sürmüş ve testler bunu bilmeden sonlandırılmış. Satır bayrağı DEĞİL; 'extinguished' = sıcak alev söndü. (PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf)
- **Flash ignition (B5):** PSI-159 Inverse'te 'Hot ignition = flash' 8 satır (hepsi SE → extinguished); 'flash' tanımı bulunamadı. Satır bayrağı DEĞİL.
- **PSI-10 lisansı** belirtilmemiş (PSI ve DataCite'ta boş); CC0 varsayma; DOI 10.60555/w4zy-bt45 ile atıf. (ETL/audit/metadata_diff.csv, web_verify_log.md)
- **PSI-107 SPICE** 8 satırda negatif hava hızı (−0.28, −5.92) – açıklama bulunamadı (`out_of_range:flow`). **FLEX-114** basınç 0 mmHg – NASA/TP-2015-216046 Tablo IX'ta da 0 (`zero_value:pressure`).
- **PSI-25 BASS-II** basınç tabloda yok; 1 atm varsayımı (Summary Report TM-20210011385, orta güven) → `pressure_atm_assumed`, min/max boş. **B14** satırı: CO2/CO yer değişimi şüphesi, doğrulanamadı (`known_issue`).
- **PSI-100 SAFFIRE-III:** tabloda O2 yok (`o2_not_in_table`); akış PSI'da 30 cm/s, Urban et al. (NTRS 20180005168) 25 cm/s → `flow_conflict_publication` (değer değişmedi).
- **PSI-20 BRE** gün düzeyi tablo (`summary_row`); çok değerli O2 seviye başına satıra açıldı (18 → 43); basınç **rapordan eşlendi** (%21→1.0, %26.5→0.694, %34→0.558 atm; %25/%40 boş) → `pressure_assumed_from_report`, sınıf C. '3400%'/'2100%' ham değer korunur; `o2_pct_report` = 34 / 21 (BRE Final Report Tablo 1).
- **Katı yakıt** en yüksek O2 = 22.7 %; PSI'da ≥ %30 O2'li katı yakıt testi YOK.
- **Outcome** yalnız 668/1805 satırda unknown dışı. PSI-26 ve PSI-25 sonuçları serbest metinden anahtar kelimeyle çıkarıldı (`parsed_text`); kısmi blowoff / operatör kaynaklı sönme ayrımı yapılmadı.
- **Birebir kopya satırlar** kaynakta var: PSI-39 (8), PSI-107 (34) → `is_duplicate`; silinmedi.
- **Yakıt (v3.1):** PSI-10 inverse 120 satırda yakıt tabloda yok; ekip onayıyla 'XC2H4 initial' dolu satırlarda `C2H4 (turetilmis: XC2H4 kolonu)` türetildi (`fuel_derived_from_column`; kanıt: PSI-10 Final Report 'nitrogen and ethylene (C2H4)'). Normal Flame dosyasına dokunulmadı (C2H4 187 + C3H8 20). Kalan boş: PSI-99 2-6, 2-9 (kaynak 'Material' hücresi boş).
- **Elle onay (v3.1):** PSI-26 3 satır (source_row 41 → extinguished, 47 → sustained, 71 → extinguished) kurallardan sonra `manual_review` ile atandı; neden + metin parçası `column_map.final.yaml: outcome_overrides`, `out/psi26_outcome_review.csv`.
- **PSI-26/25 'extinguished'** etiketi operatör kaynaklı sönmeyi (fan/akış kapatma) de kapsar; kendiliğinden sönme ile ayrımı yapılmadı.
- **PSI-26 outcome (v3 sertleştirme):** kısmi blowoff ('bottom half', 'but not', 'did not blow out'), 'did not ignite first N attempts' + sonra tutuşma, ve aynı kategoride olumlu+olumsuz eşleşme → unknown + outcome_ambiguous. Muhafazakâr olumsuzluk penceresi bazı doğru etiketleri de unknown yapabilir (ör. test 45). Tam metin + regex: `out/psi26_outcome_review.csv`.
- **PSI-20 notu:** 'approximate concentrations for tests that ignited are listed' → listelenen O2 seviyeleri, tutuşan testlerin yaklaşık konsantrasyonları (`ignited_level_per_notes`; BRE Final Report Tablo 1 dipnot 3, PDF s.24). Aynı dipnot: 'chamber pressures were also varied but are not identified in this summary table' → basınç eşlemesi rapordaki nominal atmosferlere dayanır. 'Flames Ignited' = gün toplamı (geometry_note).
- **PSI-102 makalesi** (SAE 2005-01-2930, 'Detection of Smoke from Microgravity Fires') PSI'dan indirildi; telif SAE'ye ait → yeniden dağıtmayın.

## Outcome enum
| değer | anlam |
|---|---|
| extinguished | alev söndü (PSI-159: SE = kendiliğinden; FLEX: Extinction; metin: 'extinguish') |
| blowoff | alev akışla üfürüldü / söndürüldü (metin: 'blow off/out') |
| sustained | alev sürdü / tamamen yandı (PSI-159 FT = komutla akış kesilene kadar; FLEX Completion; metin: 'burned to completion', 'kept going', 'propagat…') |
| no_ignition | tutuşma olmadı (PSI-25/26 metin) |
| **cool_flame** (v2) | soğuk alev doğrudan tutuştu, sıcak alev yok (PSI-159 'direct cool' / 'Cool flame? = yes' + Hot ignition = No) |
| **no_hot_ignition** (v2) | sıcak alev tutuşmadı (PSI-159 Hot ignition = No; soğuk alev kanıtı yok) |
| **droplet_disruption** (v2) | FLEX: test sönme olmadan damlacık parçalanmasıyla bitti (NASA/TP-2015-216046) |
| unknown | belirlenemedi / çelişkili (`outcome_conflict`, `outcome_ambiguous`) |

## evidence_grade (çakışmada en düşük: D < C < B < A)
- **A** – test düzeyi, ortam O2'si, basınç ölçülmüş (tabloda), anomali bayrağı yok
- **B** – ölçülmüş ama `o2_basis = oxidizer_stream` (PSI-10/159 inverse: O2 brülör oksitleyicisinin oranı)
- **C** – `summary_row` VEYA basınç varsayım (`pressure_assumed`, `pressure_assumed_from_report`) VEYA `o2_derived` VEYA anomali (out_of_range, zero_value, known_issue, unverified_unit, join_*, exact_duplicate_source, column_mismatch)
- **D** – O2 ya da basınç (ölçülen veya varsayılan) yok

## Şema

| kolon | tip | açıklama |
|---|---|---|
| psi_id | str | PSI investigation kimliği |
| test_id | str | Test/koşu kimliği (kaynak); yoksa PSI-XX-r<satır>; PSI-20 açılımında PSI-20-r<satır>-<n> |
| fuel_or_material | str | Yakıt / malzeme (kaynak metni) |
| fuel_phase | str | solid / liquid / gas |
| o2_pct_min | float64 | O2 hacim/mol % (birim kolon anlamına göre çevrildi) |
| o2_pct_max | float64 | O2 % (çok değerli hücrelerde max) |
| pressure_atm_min | float64 | Basınç atm (ölçülen/tablo; PSI-20'de rapor eşlemesi) |
| pressure_atm_max | float64 | Basınç atm |
| flow_cm_s_min | float64 | Akış hızı cm/s |
| flow_cm_s_max | float64 | Akış hızı cm/s |
| outcome | str | Sonuç enum'u (aşağıda) |
| outcome_source | str | column / parsed_text / manual_review / boş |
| geometry_note | str | Geometri/örnek notları (metin) |
| quality_flag | str | ';' ile ayrılmış bayraklar |
| source_file | str | Kaynak dosya adı |
| source_row | int64 | Kaynak dosyada satır no (başlık = 1) |
| raw_json | str | Orijinal satırın TÜM kolonları (ham; PSI-26'da table + conditions) |
| o2_basis | str | ambient / oxidizer_stream / derived |
| pressure_atm_assumed | float64 | Varsayılan/eşlenen basınç değeri (atm) – PSI-25: 1.0; PSI-20: rapor eşlemesi |
| pressure_is_assumed | bool | Basınç varsayım mı (bool) |
| o2_pct_report | float64 | Rapordan türetilmiş O2 % (yalnız PSI-20 '3400%'/'2100%' hücreleri) |
| is_duplicate | bool | Aynı dosyada birebir aynı raw_json'un 2.+ kopyası (bool; satır silinmez) |
| evidence_grade | str | A/B/C/D kanıt sınıfı (aşağıda) |
| outcome_confidence | str | high (kaynak kolon: PSI-159, PSI-69) / low (parsed_text: PSI-25, PSI-26; manual_review: PSI-26 3 satır) / boş (unknown) |
| variant | str | inverse / normal / boş |
| investigation_doi | str | Investigation DOI (atıf) |
| license | str | PSI metadata lisansı (PSI-10'da boş) |
| o2_pct_min_effective | float64 | ETKİN O2 % = o2_pct_report doluysa o, değilse o2_pct_min (dashboard için) |
| o2_pct_max_effective | float64 | ETKİN O2 % (bkz. min_effective) |
