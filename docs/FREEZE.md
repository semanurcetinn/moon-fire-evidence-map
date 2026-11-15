# FREEZE – ETL v3.1

- **Tarih:** 2026-11-14 (v3 freeze'in güncellemesi)
- **Config:** `ETL/config/column_map.final.yaml` (v2 + `# v3:` + `# v3.1:`)
- **Git işlemi yapılmadı** (commit/push ekipte).

## Satır sayıları
| Ölçüt | Değer |
|---|---|
| experiments.csv | 1805 satır (12 Tier-1; 1780 kaynak test satırı + 25 PSI-20 O2 açılımı) |
| experiments_dashboard.csv | 1805 satır, 28 kolon (raw_json yok) |
| quality_log.csv | 1707 kayıt; (psi, test, row, flag) tekrarı 0 |
| Moon box (effective O2 ≥ 30, p ≤ 0.694) | 87 satır: A 20 · B 46 · C 21; moon_box_final bölümleri {'near_miss': 765, 'in_box': 87, 'edge': 17} |
| evidence_grade | A 859 · B 263 · C 173 · D 510 |
| outcome ≠ unknown | 668 / 1805 (bunların 3'ü manual_review) |
| fuel_or_material boş | 2 (PSI-99 2-6, 2-9; kaynak hücre boş) |

## sha256
| Dosya | sha256 |
|---|---|
| out/experiments.csv | `a1c837f40ad266cc533d9f92ba50032bf324c64051d4710887c0815abcee1838` |
| out/experiments_dashboard.csv | `7967c53de47884511b104923b964f261c178bc2df34095bdda6188288b13ae70` |
| out/data_dictionary.csv | `e5c74e8da8f6001ba63eb1189f13ee91a8098e94f4a40d1d389e872ceeb7eef8` |
| out/moon_box_final.csv | `60bb6fa9555586c50d2cc9a0505e1725ffef5a50b31d229e34960bff77d69612` |
| config/column_map.final.yaml | `6c82378ed7f22b43affbe43550fd37ac9bc810f216ef217721696b65aee80fd5` |
| src/etl.py | `41c7c285d62ffa62b57af942288de52bac8ac5642c58418c041267c683f3e32d` |
| src/common.py | `f2185436bcf088cacd968fcf6508cee422eda5ed9bd056309130b5f3e2f12a1a` |

## Yeniden üretim
```
cd <project root>\ETL
py -P src\readiness.py
py -P src\etl.py
py -P tests\test_etl.py          (kritik hata 0 beklenir)
py -P audit_v31\acceptance_v31.py
```

**Uyarı:** `src/make_final_yaml.py` yalnızca v2 durumunu üretir (verified → final). Yeniden çalıştırılırsa `# v3:` ve `# v3.1:` değişiklikleri **kaybolur**.

## Yedekler
- v3.1 öncesi: `ETL/backup/v3_oncesi_v31/` (salt okunur)
- v3 öncesi: `ETL/backup/v3_oncesi/`
- v2 öncesi: `ETL/backup/out_pre_v2/` + `ETL/backup/*.20261114`
