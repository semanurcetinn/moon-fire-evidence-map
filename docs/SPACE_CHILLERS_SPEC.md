# SPACE CHILLERS – NASA Space Apps 2026 "Flame in Freefall" – PROJE SPEC (Tek Kaynak)

> Bu dosya, projeye sonradan dahil olan herhangi bir yapay zekâ ajanının (veya ekip üyesinin) bağlamı sıfırdan kazanması için yazılmıştır. Son güncelleme: **14 Kasım 2026, Cumartesi ~17:40 (Europe/Istanbul)**. Veri durumu: **DONDURULDU (ETL v3.1)**.
> Kural: Bu dosyada "DOĞRULANMADI" yazan her şey kesin bilgi gibi sunulmamalıdır.

---

## 0. TL;DR (30 saniyelik özet)

- **Yarışma:** NASA Space Apps Challenge 2026 – *"Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data"*.
- **Ekip:** MSKÜ "Space Chillers" (5 kişi).
- **Teslim:** İnteraktif, yapay zekâ destekli bir **dashboard**: NASA PSI (Physical Sciences Informatics) yanma deneylerini özetler, sıralar ve yorumlar; uzay aracı / Ay üssü yangın güvenliği perspektifi.
- **Ay kutusu (Moon box):** O₂ ≥ %30 ve basınç ≤ 10.2 psi (= 0.694 atm).
- **Son tarih:** Pazar 15 Kasım 2026 23:59 (**saat dilimi DOĞRULANMADI**, challenge sayfasından teyit edilecek).
- **Veri hazır:** `experiments.csv` (1805 satır, 12 Tier-1 araştırma), ETL v3.1, sha256 ile dondurulmuş. **ETL'e bir daha dokunma.**
- **Sıradaki iş:** Dashboard (grafikler, filtreler, RAG akışı), backend/frontend/RAG görevleri, sunum, 3 kanıtın insan doğrulaması, git commit+tag.

---

## 1. Yarışma ve Çözüm Çerçevesi

### 1.1 Problem
Mikroçekim (microgravity) yanma deneyleri; alev yayılımı, sönme, üfleme (blowoff), soğuk alev gibi olguları farklı formatlarda, farklı birimlerde ve dağınık dosyalarda sunuyor. Yangın güvenliği için "hangi koşulda (O₂, basınç, akış, yakıt) ne oluyor?" sorusuna **tek, tutarlı, izlenebilir** bir tablo ve onun üstünde yorumlama katmanı gerekiyor.

### 1.2 Çözümün üç katmanı
1. **Veri katmanı (BİTTİ):** Dağınık PSI verisini tek şemaya taşıyan, değer düzeltmeyen, kaynağı izlenebilir ETL.
2. **Dashboard katmanı (SIRADA):** Filtreler, grafikler, Moon box görünümü, kanıt kalitesi göstergeleri.
3. **Yorum/RAG katmanı (SIRADA):** SI (yapay zekâ) destekli yorum; yalnızca dondurulmuş veri + kaynak notlarına dayanarak, kanıt derecesi ve belirsizlikleri belirterek yanıt.

### 1.3 Ay kutusu tanımı
`o2_pct_max_effective ≥ 30` **ve** `pressure_atm_min ≤ 0.694` (0.694 atm = 10.2 psi).
Kenar bölge ("edge"): 0.694 < basınç ≤ 0.75 atm.

---

## 2. Çalışma Düzeni (Kim Ne Yapıyor)

- Kullanıcı Türkçe konuşur; **yanıtlar Türkçe** verilir.
- Çalışma modeli: **Claude (sohbet)** prompt yazar ve doğrular; **kullanıcının bilgisayarındaki ajan** prompt'u çalıştırır; kullanıcı çıktıları sohbete yükler; Claude çıktıları **bağımsız olarak** (pandas ile) doğrular.
- Proje kökü (kullanıcı makinesi): `<project root>`
  - ETL: `ETL\` (Python, çalıştırma: `py -P`)
  - Çıktılar: `ETL\out\`
- Prompt sürümleri: **Yama v2 (tam) → v3 → v3.1** (aşağıda detay).
- Git işlemleri **yalnızca ekip** tarafından yapılır.

---

## 3. Güvenlik / Dağıtım Kısıtları (İHLAL ETME)

| Kural | Neden |
|---|---|
| `PSI-26_Science Documents_Planned_Test Matrix.xlsx` açılmaz, kopyalanmaz, loglanmaz, yüklenmez | Hassas/izinsiz dosya |
| `.sqlite` ve `.parquet` paylaşılmaz / repoya girmez | Boyut + gereksiz, CSV yeterli |
| Ham/doküman verisi (`PROJE_VERI` vb.) ve `ETL\backup\` repoya girmez | Yeniden dağıtım ve karışıklık |
| SAE makalesi (PSI-102) yeniden dağıtılmaz | Telifli |
| ETL **değer düzeltmez**; yalnızca bayrak / not / türetilmiş kolon ekler | Bilimsel dürüstlük, `raw_json` korunur |
| Orijinal klasörlere ve orijinal yaml'a dokunulmaz | Kaynak bütünlüğü |
| PSI-10 lisansı **belirtilmemiş**; CC0 varsayma | DOI ile atıf: `10.60555/w4zy-bt45` |
| `make_final_yaml.py` **çalıştırılmaz** | Çalıştırılırsa v3/v3.1 yaml değişiklikleri silinir |
| Dondurulmuş dosyalar (bkz. §7) değiştirilmez | Hash tutarlılığı |

---

## 4. Veri Hattı (ETL) – Mimari

```
column_map.final.yaml  ──►  src/etl.py (+ common.py)  ──►  out/
   (konfigürasyon)            (dönüştürme + kurallar)        experiments.csv / .parquet / .sqlite
                                                             experiments_dashboard.csv  (raw_json yok)
                                                             quality_log.csv
                                                             investigations.csv
                                                             moon_box_coverage.md / .csv
                                                             moon_box_final.csv
                                                             psi26_outcome_review.csv
                                                             data_dictionary.csv
                                                             validation_report.md
                                                             DATA_CARD.md
                                                             FREEZE.md
                                                             RAPOR_ETL.md
```

### 4.1 ETL kuralları (değişmez)
1. **Değer düzeltme yok.** Ham değer `raw_json`'da kalır; bayrak/not/türetilmiş kolon eklenir.
2. **Birim, kolonun anlamına göre** belirlenir (başlıktaki birimden / konfigürasyondan).
3. **Varsayılan/türetilmiş değerler `_assumed` soneki** veya ilgili bayrakla işaretlenir.
4. **Çok değerli hücreler** min/max'e indirgenir veya satırlara açılır (explode).
5. **Köken (provenance)** her satırda: `psi_id`, `source_file`, `source_row`.
6. **Tekrar eden satırlar silinmez**, `is_duplicate` ile işaretlenir.

### 4.2 Benzersiz anahtar
`(psi_id, test_id, source_file, source_row)` — **tekil**. `test_id` tek başına tekil **değildir**:
- PSI-26'da 5 çift aynı `test_id`'ye sahip ama içerikleri farklı.
- PSI-39 ve PSI-107'de birebir yinelenen satırlar `is_duplicate` ile işaretli (silinmedi).

---

## 5. Şema (`experiments.csv`: 29 kolon; `experiments_dashboard.csv`: 28 kolon, `raw_json` hariç)

| Kolon | Anlam |
|---|---|
| `psi_id` | Araştırma kimliği (örn. PSI-159) |
| `test_id` | Test kimliği (tekil değil!) |
| `fuel_or_material` | Yakıt/malzeme |
| `fuel_phase` | gaz / sıvı / katı vb. |
| `o2_pct_min`, `o2_pct_max` | Ham-harmonize O₂ yüzdesi aralığı |
| `o2_pct_min_effective`, `o2_pct_max_effective` | **Dashboard filtre/grafik için bunları kullan** (PSI-20'de 3400→34, 2100→21 düzeltmesi bayrakla; ham değer korunur) |
| `pressure_atm_min`, `pressure_atm_max` | Basınç (atm) |
| `flow_cm_s_min`, `flow_cm_s_max` | Akış hızı (cm/s) |
| `outcome` | Sonuç (enum aşağıda) |
| `outcome_source` | `column` \| `parsed_text` \| `manual_review` \| `empty` |
| `outcome_confidence` | `high` (kaynak kolon) \| `low` (parsed_text veya manual_review) \| boş (bilinmiyor) |
| `geometry_note` | Geometri/ek not |
| `quality_flag` | Bayrak(lar) |
| `source_file`, `source_row` | Köken |
| `raw_json` | Ham satır (dashboard dosyasında yok) |
| `o2_basis` | `ambient` \| `oxidizer_stream` \| `derived` |
| `pressure_atm_assumed` | Varsayılan/eşlenen basınç değeri |
| `pressure_is_assumed` | Basınç varsayım mı? |
| `o2_pct_report` | Raporda yazan O₂ (PSI-20 için) |
| `is_duplicate` | Birebir yinelenen satır |
| `evidence_grade` | A/B/C/D (aşağıda) |
| `variant` | Deney varyantı (örn. normal/inverse) |
| `investigation_doi` | Araştırma DOI |
| `license` | Lisans bilgisi |

### 5.1 `outcome` enum
`extinguished` · `blowoff` · `sustained` · `no_ignition` · `cool_flame` · `no_hot_ignition` · `droplet_disruption` · `unknown`

Eşlemeler:
- SE → `extinguished`; FT → `sustained`.
- PSI-69: Extinction → extinguished, Completion → sustained, **Disruption → droplet_disruption** (NASA/TP-2015-216046).
- PSI-159: "direct cool" → `cool_flame`.
- **Dikkat:** PSI-25/26'daki `extinguished`, operatör kaynaklı sönmeyi (fan/akış kapatma) de kapsar; ayrıştırılmadı.

### 5.2 `evidence_grade` (en düşük kural kazanır: D<C<B<A)
- **A:** Test-düzeyi satır, ortam O₂, ölçülmüş basınç, anomali yok.
- **B:** Ölçülmüş ama O₂ = oksitleyici akış oranı (PSI-10 / PSI-159 *inverse*).
- **C:** Özet satır, varsayılan/rapordan eşlenen basınç, türetilmiş O₂ veya anomali.
- **D:** O₂ veya basınç eksik.

### 5.3 Dashboard kullanım kuralları
- O₂ filtre/grafiklerinde **`o2_pct_*_effective`** kullan.
- "Temiz veri" = **evidence A**. `outcome_confidence = low`, C ve D → **"yaklaşık"** etiketiyle göster.
- `unknown` sonuçları sessizce düşürme; ayrı gösterge ver (1137 satır).
- Her grafikte **kanıt derecesi** ve **lisans/atıf** erişilebilir olsun.

---

## 6. Veri Gerçekleri (v3.1, dondurulmuş)

### 6.1 Genel
- **1805 satır** (1780 kaynak + 25 satır PSI-20 O₂ patlatmasından).
- **12 Tier-1 araştırma:** PSI-10, 20, 25, 26, 39, 68, 69, 98, 99, 100, 107, 159.
- **evidence_grade:** A 859 · B 263 · C 173 · D 510.
- **outcome ≠ unknown:** 668 · **unknown:** 1137.
- **outcome_confidence:** high 606 · low 62.
- **outcome dağılımı:** unknown 1137 · extinguished 410 · sustained 122 · droplet_disruption 61 · no_hot_ignition 59 · blowoff 7 · no_ignition 7 · cool_flame 2.
- Boş yakıt: yalnızca **2 satır** (PSI-99 2-6, 2-9; kaynak hücre boş).

### 6.2 Ay kutusu (87 satır)
| Sınıf | Adet | İçerik |
|---|---|---|
| **A** | 20 | Tamamı **PSI-159 Normal Flames** (%50 bütan, %30 etan, %30 bütan; 0.5 atm; O₂ %31–39). 13 extinguished, 4 sustained, 2 cool_flame (F2/F5), 1 unknown + `outcome_conflict` (F4) |
| **B** | 46 | PSI-159 inverse 28 + PSI-10 inverse 18 (O₂ = oksitleyici akış oranı) |
| **C** | 21 | PSI-20 13 (rapordan eşlenen 0.558 atm @ %34) + PSI-68 8 özet satır |

- **Kenar (edge) 17 satır:** PSI-69 FLEX, O₂ %30–34, 10.33–10.50 psi; 15 droplet_disruption + 2 sustained.
- `moon_box_final.csv`: `in_box` 87 · `edge` 17 · `near_miss` 765.
- **Katı yakıt Ay kutusunda yok.** Katı yakıt için maksimum O₂ = %22.7 (PSI-26).

### 6.3 Araştırma bazlı notlar
- **PSI-10:** Normal Flame dosyası (C2H4 187 + C3H8 20). *Inverse* 120 satırda yakıt `XC2H4` kolonundan türetildi → `"C2H4 (turetilmis: XC2H4 kolonu)"` + bayrak `fuel_derived_from_column` (Final Report: "nitrogen and ethylene (C2H4)"). Lisans belirtilmemiş.
- **PSI-20 (BRE, gün-düzeyi):** Çok değerli O₂ satırlara açıldı (`PSI-20-r<row>-<n>`). Basınç, BRE Final Report eşlemesinden: %21→1.0, %26.5→0.694, %34→0.558 atm (%25 ve %40 eşlenmedi). Ham "3400%/2100%" korunur, `o2_pct_report` 34/21. Notes cümlesi ("approximate concentrations for tests that ignited are listed"; basınçlar değişti ama tanımlı değil) BRE Final Report Tablo 1 dipnot 3'te doğrulandı (PDF s.24, basılı s.23). Bayrak: `ignited_level_per_notes`. Outcome `unknown` kalır.
- **PSI-26:** Sonuçlar serbest metinden **sıkı regex + negasyon koruması + belirsizlik kuralları** ile; **3 elle override** (satır 41 → extinguished, 47 → sustained, 71 → extinguished; `outcome_source=manual_review`, `confidence=low`, bayrak `outcome_manual_review`). Dağılım: extinguished 24 · sustained 7 · no_ignition 5 · blowoff 1 · unknown 85. İnceleme dosyası: `psi26_outcome_review.csv`.
- **PSI-69:** Disruption = damlacık dağılması (NASA/TP-2015-216046).
- **PSI-159:** "direct cool" = soğuk alev.
- **PSI-25:** 1 atm basınç **varsayımı** + B14 şüphesi.
- **PSI-100:** Akış 25 vs 30 cm/s çelişkisi (bayraklı).
- **PSI-107:** Negatif hava hızı (8 satır) — düzeltilmedi, bayraklı.
- **FLEX-114:** 0 mmHg basınç — bayraklı.
- **PSI-99:** 2 yakıt boş.
- **B4** (SE sonrası soğuk alevler) ve **B5** (flaş ateşleme) yalnızca `DATA_CARD.md`'de.

---

## 7. Dondurma (FREEZE v3.1) – sha256

| Dosya | sha256 |
|---|---|
| `experiments.csv` | `a1c837f40ad266cc533d9f92ba50032bf324c64051d4710887c0815abcee1838` |
| `experiments_dashboard.csv` | `7967c53de47884511b104923b964f261c178bc2df34095bdda6188288b13ae70` |
| `column_map.final.yaml` | `6c82378ed7f22b43affbe43550fd37ac9bc810f216ef217721696b65aee80fd5` |
| `etl.py` | `41c7c285d62ffa62b57af942288de52bac8ac5642c58418c041267c683f3e32d` |
| `common.py` | `f2185436bcf088cacd968fcf6508cee422eda5ed9bd056309130b5f3e2f12a1a` |
| `data_dictionary.csv` | `e5c74e8da8f6001ba63eb1189f13ee91a8098e94f4a40d1d389e872ceeb7eef8` |
| `moon_box_final.csv` | `60bb6fa9555586c50d2cc9a0505e1725ffef5a50b31d229e34960bff77d69612` |

`quality_log.csv`: 1707 kayıt, tekrar eden `(psi, test, row, flag)` yok.
Bağımsız doğrulama (Claude, pandas): hash'ler FREEZE ile eşleşti; dashboard dosyası `raw_json` hariç `experiments.csv` ile özdeş; anahtar tekil; outcome dağılımı DATA_CARD ile tutarlı.

---

## 8. Süreç Tarihçesi (Ne Yaptık, Neden)

> Not: v2 öncesi ilk keşif/indirme/yaml-hazırlama aşaması bu belgede yalnızca özetlenmiştir (ayrıntılar `RAPOR_ETL.md` arşiv bölümlerinde). Bilinen: ilk indirmede bir HTTP 400 hatası (GET isteğinde Content-Type başlığı) düzeltildi; `make_final_yaml.py` ile nihai yaml üretildi.

### 8.1 Yama v2 (tam)
- Adım 0–9 + kabul testleri T1–T13.
- Sonuçları zenginleştirdi: `evidence_grade`, `o2_basis`, `pressure_is_assumed`, `is_duplicate`, PSI-20 patlatma ve basınç eşlemesi, PSI-26 serbest metin çıktı çözümleme.
- **v2 sonrası analizde bulunan eksikler:**
  1. 174 boş yakıt satırı (PSI-20, PSI-99, PSI-100, PSI-10 inverse).
  2. PSI-20 ham O₂ 3400/2100 → `*_effective` kolonları gerekti.
  3. PSI-26 parsed sonuçlar düşük güvenli → `outcome_confidence` + inceleme dosyası + daha sıkı kurallar gerekti.
  4. `quality_log` detayı tüm bayraklara kopyalanıyordu → bayrak başına detay.
  5. Doğrulama raporu birebir yinelenenleri ve aynı-`test_id`'yi karıştırıyordu → 4a/4b/4c ayrımı.

### 8.2 Yama v3
- Yakıt eşlemesi: PSI-20 "Fuel Bottle"; PSI-99/100 "Material"; PSI-10 inverse koşullu türetme.
- `outcome_confidence`, `psi26_outcome_review.csv`, `*_effective` O₂ kolonları.
- PSI-20 notları → `geometry_note` + `ignited_level_per_notes`.
- `quality_log` bayrak-başı detay; doğrulama 4a/4b/4c.
- Yeni çıktılar: `experiments_dashboard.csv`, `data_dictionary.csv`, `moon_box_final.csv`; `FREEZE.md`.
- Testler V1–V7.
- **Hata:** V1 başarısız. Nedeni, benim yazdığım ön koşul kontrolünün yanlış dosyaya (PSI-10 *Normal Flame*) bakmasıydı; ham veride doğrulandı ki 120 inverse satırın tamamında `XC2H4` kolonu var. Kontrol yanlış tanımlanmıştı → v3.1.

### 8.3 Yama v3.1 (son)
- PSI-10 inverse için `fuel_derived` açıldı (boş yakıt 122 → 2).
- PSI-26 `outcome_overrides` (satır 47, 41, 71; `manual_review`).
- `outcome_confidence = low` ← `parsed_text` + `manual_review`.
- DATA_CARD'a sınır notu. Testler W1–W8. Yedek: `ETL\backup\v3_oncesi_v31\`.
- **Sonuç: dondurma.**

### 8.4 Bağımsız doğrulama özeti (v3.1 sonrası)
Hash eşleşmesi, 1805 satır, anahtar tekilliği, yakıt boşluğu (2), PSI-26 üç manuel satır, Moon box 87 (A20/B46/C21), `*_effective` yalnızca 2 PSI-20 satırında ham değerden farklı. **Veri tarafı kapandı.**

---

## 9. Açık İşler (Öncelik Sırasıyla)

1. **Git (ekip):** `ETL/` kodu, `column_map.final.yaml`, `out/*.csv` (`experiments.csv`, `experiments_dashboard.csv`, `data_dictionary.csv`, `moon_box_final.csv`, `quality_log.csv`, `investigations.csv`) commit + **`v3.1` etiketi**; mesajda `FREEZE.md` sha256 değerleri. `.gitignore`: ham veri, `.sqlite`, `.parquet`, Planned_Test Matrix, SAE makalesi, `ETL\backup\`.
2. **Son tarih saat dilimini doğrula** (challenge sayfası). **DOĞRULANMADI.**
3. **Üç kanıtın insan doğrulaması (~15 dk):**
   - PSI-69 Disruption → NASA/TP-2015-216046 s.19 ve Tablo IX.
   - PSI-159 Final Report → soğuk alev (cool flame).
   - PSI-20 BRE Tablo 1 (dipnot 3 ajan tarafından zaten doğrulandı).
4. **Dashboard** (`experiments_dashboard.csv` + `data_dictionary.csv` ile): mimari, grafikler, filtreler, Moon box görünümü.
5. **RAG/yorum katmanı** ve backend/frontend/RAG görev prompt'ları.
6. **Sunum** (bkz. §11).
7. İsteğe bağlı: Moon box'taki 87 / A sınıfı 20 satırın elle kontrolü; bağımsız tam denetim (zorunlu değil).

---

## 10. Dashboard Önerisi (Taslak – Ekip Onayı Bekler)

**Filtreler:** yakıt, faz (gaz/sıvı/katı), O₂ aralığı (`*_effective`), basınç, akış, outcome, evidence_grade, outcome_confidence, araştırma (PSI), Moon box durumu (`in_box` / `edge` / `near_miss`).

**Görünümler:**
- O₂–basınç düzleminde nokta grafiği; Moon box dikdörtgeni; sonuç renk/şekli; kanıt derecesi saydamlık veya kenarlık.
- Outcome dağılımı (unknown dahil), araştırma bazında kapsam.
- Moon box tablosu (87 satır + 17 kenar), kaynak ve bayraklarıyla.
- Her satır için detay paneli: köken (`source_file`, `source_row`), bayraklar, `raw_json` (yalnızca uygulama içi, dışa aktarımda yok).
- "Veri sınırları" sekmesi: §12'deki sınırlar.

**RAG kuralları:**
- Yalnızca dondurulmuş veri + `DATA_CARD.md` + kaynak notlarından yanıt ver.
- Her iddiada `evidence_grade` ve `outcome_confidence` belirt; `unknown`'ı bilinmiyor diye söyle, tahmin yürütme.
- Katı yakıt için ≥%30 O₂ verisi **yok** demeli; Moon box kanıtının gaz alevli olduğunu açıkça söylemeli.
- Güvenlik tavsiyesi vermez: "bu veri, tasarım kararı için tek başına yeterli değildir" çerçevesi.

---

## 11. Sunumda Mutlaka Belirtilecekler

1. **Problem ve değer önerisi:** Dağınık PSI verisi → tek şema → yangın güvenliği için sıralanabilir kanıt.
2. **Yöntem dürüstlüğü:** Hiçbir değer düzeltilmedi; her satır kaynağa izlenebilir; kanıt derecelendirme (A–D) ve güven sütunu var.
3. **Ay kutusu hikâyesi:** 87 satır (A20/B46/C21), temiz çekirdek PSI-159 gaz alevleri.
4. **Dürüst sınırlar** (aşağıdaki §12).
5. **Atıf ve lisans:** Araştırma DOI'leri; PSI-10 lisansı belirtilmemiş.
6. **Reprodüksiyon:** Dondurma hash'leri, `data_dictionary.csv`, `DATA_CARD.md`.

---

## 12. Bilinen Sınırlar (Sunumda Açıkça Söyle)

- **Katı yakıt ≥%30 O₂ verisi yok** (maksimum %22.7, PSI-26). Ay kutusundaki temiz kanıt gaz alevleridir.
- **PSI-20 basıncı rapordan eşlenmiş bir varsayımdır** (hücrede ölçülmüş değil); sonuç bilinmiyor.
- **PSI-10 ve PSI-159 inverse'te O₂ = oksitleyici akış oranı**, ortam O₂'si değil (B sınıfı).
- **PSI-25/26 `extinguished`**: operatör kaynaklı sönmeyi de içerir; düşük güvenli; 3 satır elle incelendi.
- **PSI-25** 1 atm varsayımı; **PSI-100** akış çelişkisi; **PSI-107** negatif hava hızı; **FLEX-114** 0 mmHg; **PSI-99** 2 boş yakıt.
- **PSI-10 lisansı belirtilmemiş**; CC0 varsayma, DOI ile atıf yap.
- `unknown` outcome 1137/1805 — çoğu araştırma sonuç kaydı tutmuyor; bu, "sonuç yok" demektir, "sönmedi" demek değildir.

---

## 13. Ajanlar İçin Çalışma Kuralları

1. Önce bu dosyayı oku. Dondurulmuş dosyaları değiştirme; yeni türetilmiş dosyalar farklı adla üret.
2. Değer uydurma/düzeltme yok. Emin değilsen `unknown` / bayrak.
3. Her sayıyı kodla doğrula (tahmin yok). Rakam verirken dosya ve filtre kriterini belirt.
4. Güvenlik listesine (§3) aykırı hiçbir şey yapma, üretme, yükleme.
5. Belirsiz bir kararı (özellikle geri alınamaz) kullanıcıya sor; saat az olduğundan gereksiz soru sorma.
6. Yanıtlar Türkçe, kısa, uygulanabilir; sonda "ne değişti / sıradaki adım".
7. Dashboard geliştiricilerine şu değişiklikleri hatırlat: yeni outcome değerleri (`cool_flame`, `no_hot_ignition`, `droplet_disruption`), yeni kolonlar (§5), `*_effective` O₂ kullanımı.

---

## 14. Sözlük

- **PSI:** Physical Sciences Informatics (NASA).
- **Moon box:** O₂ ≥ %30, basınç ≤ 0.694 atm.
- **Inverse alev:** Oksitleyici akışta yakıtın difüze olduğu (ters difüzyon) alev; O₂ oksitleyici akış oranıdır.
- **Blowoff:** Akışla alev sönmesi (üfleme).
- **Cool flame:** Soğuk alev (düşük sıcaklık kimyası).
- **Disruption (PSI-69):** Damlacık dağılması.
- **SE / FT:** self-extinguished / flame through (eşleme: extinguished / sustained).
- **Effective O₂:** Ham O₂ raporlama anomalisinin (3400, 2100) bayrakla düzeltilmiş, ham değeri koruyan sürümü.

---

*Bu dosya, 14 Kasım 2026 oturumunun özetidir. Veri tarafı v3.1'de donmuştur; değişiklik gerekiyorsa yeni sürüm (v3.2+) ve yeni FREEZE gerekir.*
