# NASA_PSI_FINAL – Space Chillers · NASA Space Apps 2026 "Flame in Freefall"

Bu paket, NASA PSI (Physical Sciences Informatics) mikrogravite yanma deneylerinden derlenen **nihai veridir** (ETL **v3.1**, dondurulmuş – bkz. `docs/FREEZE.md`).

## Klasörler
- **data/** – çıktı tabloları
  - `experiments_dashboard.csv` + `data_dictionary.csv` → **dashboard için kullanılacak dosyalar**
  - `experiments.csv` – aynı satırlar + `raw_json` (her satırın orijinal kaynak hücreleri)
  - `moon_box_final.csv` – Ay üssü atmosferi kutusu (O2 ≥ %30, p ≤ 0.694 atm) + kenar + yakın kaçanlar
  - `quality_log.csv` – satır bazında kalite bayrakları ve gerekçeleri
  - `investigations.csv` – 25 PSI investigation (başlık, DOI, lisans, aile)
  - `psi26_outcome_review.csv` – PSI-26 serbest metin sonuçlarının insan incelemesi listesi
- **docs/** – `DATA_CARD.md` (şema, sınırlar, tanımlar), `FREEZE.md` (sha256), `RAPOR_ETL.md` (tüm yama geçmişi), `validation_report.md`, `moon_box_coverage.md`
- **etl/** – `etl.py`, `common.py`, `column_map.final.yaml` (v2 + v3 + v3.1 değişiklikleri; her değişiklik `# v3:` / `# v3.1:` yorumlu)

## Uyarılar
- O2 filtre ve grafiklerinde **`o2_pct_min_effective` / `o2_pct_max_effective`** kullanın (ham `o2_pct_*` denetim içindir).
- **"Temiz" veri = `evidence_grade` A** (test düzeyi, ortam O2, ölçülmüş basınç, anomalisiz). B = O2 oksitleyici akışı, C = özet/varsayım/anomali, D = O2 veya basınç yok.
- **Değerler düzeltilmemiştir**; şüpheli değerler olduğu gibi bırakılıp `quality_flag` ile işaretlenmiştir. Her satır `psi_id + source_file + source_row` ile kaynağa izlenebilir.
- **PSI-10 lisansı belirtilmemiştir** (PSI ve DataCite'ta boş) → CC0 varsaymayın; DOI **10.60555/w4zy-bt45** ile atıf yapın. Diğer investigation'lar CC0-1.0.
- `test_id` tek başına tekil değildir; tekil anahtar `(psi_id, test_id, source_file, source_row)`.
- **Ham veri pakete dahil değildir.** `etl/` klasörü şeffaflık içindir; ham PSI dosyaları olmadan çalışmaz.
