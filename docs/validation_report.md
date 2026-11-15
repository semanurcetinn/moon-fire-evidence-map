# ETL doğrulama raporu

Config: `ETL\config\column_map.final.yaml` · experiments: 1805 satır · quality_log: 1707 satır · seed=42

## 1. Satır sayıları (beklenen çıktı = ham − tamamen boş − test-dışı + O2 açılım artışı)

| PSI | ham | boş | test-dışı | kaynak test satırı | açılım artışı | beklenen | çıktı | durum | açıklama |
|---|---|---|---|---|---|---|---|---|---|
| PSI-25 | 129 | 0 | 0 | 129 | 0 | 129 | 129 | ✔ | — |
| PSI-26 | 122 | 0 | 0 | 122 | 0 | 122 | 122 | ✔ | — |
| PSI-69 | 274 | 0 | 0 | 274 | 0 | 274 | 274 | ✔ | — |
| PSI-68 | 8 | 0 | 0 | 8 | 0 | 8 | 8 | ✔ | — |
| PSI-98 | 4 | 0 | 2 | 2 | 0 | 2 | 2 | ✔ | 2 test-dışı satır (F#C# akış görselleştirme / Note dipnotları) → quality_log `non_test_row` |
| PSI-99 | 15 | 0 | 6 | 9 | 0 | 9 | 9 | ✔ | 6 test-dışı satır (F#C# akış görselleştirme / Note dipnotları) → quality_log `non_test_row` |
| PSI-100 | 2 | 0 | 0 | 2 | 0 | 2 | 2 | ✔ | — |
| PSI-159 | 1194 | 861 | 0 | 333 | 0 | 333 | 333 | ✔ | 861 tamamen boş satır dosya sonunda (çıkarıldı) |
| PSI-10 | 327 | 0 | 0 | 327 | 0 | 327 | 327 | ✔ | — |
| PSI-39 | 87 | 0 | 0 | 87 | 0 | 87 | 87 | ✔ | — |
| PSI-20 | 18 | 0 | 0 | 18 | 25 | 43 | 43 | ✔ | +25 satır: çok değerli O2 hücreleri seviye başına ayrı satıra açıldı (v2 B1; aynı source_row, id -<n>) |
| PSI-107 | 469 | 0 | 0 | 469 | 0 | 469 | 469 | ✔ | — |

## 2. Aralık kontrolleri (O2 0–100 %, basınç 0–10 atm, akış 0–200 cm/s)

| alan | aralık dışı satır | quality_log'da var | örnek |
|---|---|---|---|
| o2 | 2 | 2/2 | PSI-20/PSI-20-r6-1: 3400–3400; PSI-20/PSI-20-r9-1: 2100–2100 |
| pressure | 0 | 0/0 | — |
| flow | 8 | 8/8 | PSI-107/PSI-107-r296: -0.28–-0.28; PSI-107/PSI-107-r298: -0.28–-0.28; PSI-107/PSI-107-r299: -0.28–-0.28; PSI-107/PSI-107-r300: -0.28–-0.28 |

Tüm aralık dışı satırlar ETL tarafından zaten quality_log'a yazılmış.

## 3. Spotcheck

Her investigation'dan en fazla 10 rastgele satır (seed=42) → `spotcheck.csv` (101 satır). Kaynak satır `source_file` + `source_row` ile dosyadan **yeniden okundu**.
- raw_json ile kaynak satırın birebir aynı olmadığı satır: **0**

## 4. Tekrarlar

### 4a. Birebir kopya (is_duplicate = True; aynı dosya, aynı raw_json)

Toplam **42** satır: {'PSI-107': 34, 'PSI-39': 8} (satırlar silinmedi; ilk örnek is_duplicate=False)

### 4b. Aynı test_id, FARKLI içerik

5 test_id çifti / 10 satır: {'PSI-26': 5}

| psi | test_id | satır | source_row'lar |
|---|---|---|---|
| PSI-26 | 24 | 2 | [25, 26] |
| PSI-26 | 85 | 2 | [88, 89] |
| PSI-26 | 89 | 2 | [93, 96] |
| PSI-26 | 90 | 2 | [94, 97] |
| PSI-26 | 91 | 2 | [95, 98] |

> **test_id tekil DEĞİL.** Kaynakta aynı test kimliği farklı içerikle ve birebir kopya olarak geçiyor. Tekil anahtar: `(psi_id, test_id, source_file, source_row)`.

### 4c. Assert: (psi_id, test_id, source_file, source_row) tekil → ✔ tekil

## 5. Kaynak izi ve diğer kontroller

- Kaynak izi kolonlarında boş değer (kolon bazında): psi_id: 0; source_file: 0; source_row: 0; investigation_doi: 0; license: 327 (PSI-10 327)
  - `license` boşluğu yalnız **PSI-10**: PSI metadata'sında ve DataCite'ta lisans alanı boş (CC0 varsayılmadı). Diğer kaynak izi kolonları tam.
- lisans dağılımı: {'CC0-1.0': 1478}
- 'Planned_Test Matrix' (hassas içerikli dosya) kaynak olarak kullanıldı mı: hayır
- catalog_only investigation'lardan experiments'a giren satır: 0

**Kritik hata sayısı: 0**
