# Moon box kapsaması (YAMA v2)

Kutu: **o2_pct_max ≥ 30** VE **pressure_atm_min ≤ 0.694 atm** (10.2 psi). `evidence_grade`: A = test düzeyi + ortam O2 + ölçülmüş basınç + anomalisiz; B = oksitleyici akışı; C = özet / varsayılan ya da rapordan eşlenmiş basınç / türetilmiş O2 / anomali; D = O2 ya da basınç eksik.

## 1. Özet: investigation × evidence_grade × outcome

| psi_id | faz | satır | A | B | C | D | outcome kırılımı |
|---|---|---|---|---|---|---|---|
| PSI-10 | gas | 18 | 0 | 18 | 0 | 0 | unknown 18 |
| PSI-159 | gas | 48 | 20 | 28 | 0 | 0 | sustained 28, extinguished 14, no_hot_ignition 3, cool_flame 2, unknown 1 |
| PSI-20 | gas | 13 | 0 | 0 | 13 | 0 | unknown 13 |
| PSI-68 | liquid | 8 | 0 | 0 | 8 | 0 | unknown 8 |

Toplam kutuda **87** satır; A: **20**, B: 46, C: 21, D: 0

## 2. Temiz (A) satırlar

| psi_id | test_id | yakıt | O2 % (min–max) | basınç atm | outcome | bayraklar |
|---|---|---|---|---|---|---|
| PSI-159 | 21106A4 | 50% butane | 38.46–39.26 | 0.5 | extinguished | — |
| PSI-159 | 21106 B1 | 50% butane | 37.72–38.46 | 0.5 | extinguished | — |
| PSI-159 | 21106 C1 | 50% butane | 36.93–37.72 | 0.5 | extinguished | — |
| PSI-159 | 21106 D1 | 50% butane | 35.85–36.93 | 0.5 | extinguished | — |
| PSI-159 | 21106 F1 | 50% butane | 35.42–35.85 | 0.5 | sustained | — |
| PSI-159 | 21106 F2 | 50% butane | 35.42–35.42 | 0.5 | cool_flame | — |
| PSI-159 | 21106 F3 | 50% butane | 35.38–35.42 | 0.5 | sustained | — |
| PSI-159 | 21106 F4 | 50% butane | 35.29–35.38 | 0.5 | unknown | outcome_conflict |
| PSI-159 | 21106 F5 | 50% butane | 35.29–35.29 | 0.5 | cool_flame | — |
| PSI-159 | 21153A1 | 30% ethane | 37.59–38.87 | 0.5 | extinguished | — |
| PSI-159 | 21153 A2 | 30% ethane | 36.39–37.59 | 0.5 | extinguished | — |
| PSI-159 | 21153 A3 | 30% ethane | 34.08–36.39 | 0.5 | extinguished | — |
| PSI-159 | 21153 F1 | 30% ethane | 33.49–34.08 | 0.5 | extinguished | — |
| PSI-159 | 21153 A4 | 30% ethane | 33.24–33.49 | 0.5 | sustained | — |
| PSI-159 | 21153 A5 | 30% ethane | 31.45–33.24 | 0.5 | sustained | — |
| PSI-159 | 21174 A1 | 30% butane | 38.32–38.86 | 0.5 | extinguished | — |
| PSI-159 | 21174 A2 | 30% butane | 37.85–38.32 | 0.5 | extinguished | — |
| PSI-159 | 21174 A3 | 30% butane | 37.21–37.85 | 0.5 | extinguished | — |
| PSI-159 | 21174 A4 | 30% butane | 35.54–37.21 | 0.5 | extinguished | — |
| PSI-159 | 21174 B1 | 30% butane | 34.69–35.54 | 0.5 | extinguished | — |

## 3. B sınıfı – O2 oksitleyici akışı (ortam DEĞİL)

> O2 değeri brülörden akan oksitleyicinin O2 oranı; hazne ortamı N2 + yakıt. Ortam atmosferi analizine katılmamalı.

| psi_id | satır | O2 aralığı | basınç aralığı (atm) | outcome |
|---|---|---|---|---|
| PSI-10 | 18 | 31.97–85 | 0.4246–0.5192 | unknown 18 |
| PSI-159 | 28 | 30–85 | 0.4889–0.5444 | sustained 24, no_hot_ignition 3, extinguished 1 |

## 4. PSI-68 FLEX-2 özet satırları (summary_row)

8 satır; her satır bir yakıt için test **aralığı** (O2 0.17–0.30, p 0.5–3 atm). O2 max ile p min aynı testte birlikte oluşmamış olabilir → C sınıfı.

- PSI-68-r2 · IsoOctane (pure) · O2 17–30 · p 0.5–3 atm
- PSI-68-r3 · n-Octane (pure) · O2 17–30 · p 0.5–3 atm
- PSI-68-r4 · Heptane (pure) · O2 17–30 · p 0.5–3 atm
- PSI-68-r5 · Decane (pure) · O2 17–30 · p 0.5–3 atm
- PSI-68-r6 · Ethanol (pure) · O2 17–30 · p 0.5–3 atm
- PSI-68-r7 · Propanol (95%) Glycerol (5%) (mixture) · O2 17–30 · p 0.5–3 atm
- PSI-68-r8 · Heptane (50%) IsoOctane (50%) (mixture) · O2 17–30 · p 0.5–3 atm
- PSI-68-r9 · Propanol (80%) Glycerol (20%) (mixture) · O2 17–30 · p 0.5–3 atm

## 5. KENAR: o2_pct_max ≥ 30 ve 0.694 < pressure_atm_min ≤ 0.75 atm

17 satır.

| psi_id | test_id | yakıt | O2 % | basınç atm | psi | outcome | sınıf |
|---|---|---|---|---|---|---|---|
| PSI-69 | 19 | Heptane | 34 | 0.7093 | 10.42 | droplet_disruption | A |
| PSI-69 | 20 | Methanol | 34 | 0.7099 | 10.43 | sustained | A |
| PSI-69 | 21 | Methanol | 34 | 0.7113 | 10.45 | droplet_disruption | A |
| PSI-69 | 22 | Methanol | 34 | 0.7112 | 10.45 | droplet_disruption | A |
| PSI-69 | 23 | Heptane | 34 | 0.7129 | 10.48 | droplet_disruption | A |
| PSI-69 | 24 | Heptane | 34 | 0.7142 | 10.5 | droplet_disruption | A |
| PSI-69 | 25 | Methanol | 30 | 0.707 | 10.39 | sustained | A |
| PSI-69 | 26 | Methanol | 30 | 0.7084 | 10.41 | droplet_disruption | A |
| PSI-69 | 27 | Heptane | 30 | 0.7114 | 10.46 | droplet_disruption | A |
| PSI-69 | 28 | Heptane | 30 | 0.7101 | 10.44 | droplet_disruption | A |
| PSI-69 | 37 | Methanol | 34 | 0.703 | 10.33 | droplet_disruption | A |
| PSI-69 | 38 | Methanol | 34 | 0.7032 | 10.33 | droplet_disruption | A |
| PSI-69 | 39 | Heptane | 34 | 0.7038 | 10.34 | droplet_disruption | A |
| PSI-69 | 40 | Methanol | 30 | 0.7041 | 10.35 | droplet_disruption | A |
| PSI-69 | 41 | Methanol | 30 | 0.703 | 10.33 | droplet_disruption | A |
| PSI-69 | 42 | Heptane | 30 | 0.7039 | 10.35 | droplet_disruption | A |
| PSI-69 | 43 | Heptane | 30 | 0.7038 | 10.34 | droplet_disruption | A |

Kenar outcome dağılımı: droplet_disruption 15, sustained 2

## 6. PSI-20 BRE – rapor eşlemeli basınç (pressure_assumed_from_report)

Gün düzeyi tablo; çok değerli O2 hücreleri seviye başına ayrı satıra açıldı. Basınç BRE Final Report eşlemesinden: %21 → 1.0 atm, %26.5 → 0.694 atm, %34 → 0.558 atm; %25 / %40 için eşleme yok (boş).

| test_id | yakıt | O2 % | o2_pct_report | basınç atm (rapor) | kutuda | sınıf | bayrak notu |
|---|---|---|---|---|---|---|---|
| PSI-20-r2-1 | 100% C2H4 | 21 | — | 1 | hayır | C |  |
| **PSI-20-r2-2** | 100% C2H4 | 26.5 | — | **0.694** | hayır | C |  |
| PSI-20-r2-3 | 100% C2H4 | 40 | — | — | hayır | D |  |
| **PSI-20-r3-1** | 100% C2H4 | 26.5 | — | **0.694** | hayır | C |  |
| **PSI-20-r3-2** | 100% C2H4 | 34 | — | **0.558** | evet | C |  |
| PSI-20-r4-1 | 50% C2H4 | 21 | — | 1 | hayır | C |  |
| **PSI-20-r4-2** | 50% C2H4 | 26.5 | — | **0.694** | hayır | C |  |
| **PSI-20-r4-3** | 50% C2H4 | 34 | — | **0.558** | evet | C |  |
| PSI-20-r4-4 | 50% C2H4 | 40 | — | — | hayır | D |  |
| **PSI-20-r5-1** | 50% C2H4 | 26.5 | — | **0.694** | hayır | C |  |
| PSI-20-r5-2 | 50% C2H4 | 40 | — | — | hayır | D |  |
| **PSI-20-r6-1** | 50% C2H4 | 3400 | 34 | **0.558** | evet | C | o2_value_from_report |
| **PSI-20-r7-1** | 50% C2H4 | 26.5 | — | **0.694** | hayır | C |  |
| **PSI-20-r7-2** | 50% C2H4 | 34 | — | **0.558** | evet | C |  |
| **PSI-20-r8-1** | 100%C2H4 | 26.5 | — | **0.694** | hayır | C |  |
| **PSI-20-r8-2** | 100%C2H4 | 34 | — | **0.558** | evet | C |  |
| PSI-20-r9-1 | 100%C2H4 | 2100 | 21 | 1 | hayır | C | o2_value_from_report |
| PSI-20-r10-1 | 100%C2H4 | 21 | — | 1 | hayır | C |  |
| **PSI-20-r10-2** | 100%C2H4 | 26.5 | — | **0.694** | hayır | C |  |
| **PSI-20-r10-3** | 100%C2H4 | 34 | — | **0.558** | evet | C |  |
| PSI-20-r11-1 | 100% C2H4 | 25 | — | — | hayır | D |  |
| **PSI-20-r11-2** | 100% C2H4 | 34 | — | **0.558** | evet | C |  |
| PSI-20-r11-3 | 100% C2H4 | 40 | — | — | hayır | D |  |
| **PSI-20-r12-1** | 100% C2H4 | 26.5 | — | **0.694** | hayır | C |  |
| **PSI-20-r12-2** | 100% C2H4 | 34 | — | **0.558** | evet | C |  |
| PSI-20-r13-1 | 100% CH4 | 25 | — | — | hayır | D |  |
| **PSI-20-r13-2** | 100% CH4 | 34 | — | **0.558** | evet | C |  |
| PSI-20-r13-3 | 100% CH4 | 40 | — | — | hayır | D |  |
| PSI-20-r14-1 | 100% CH4 | 25 | — | — | hayır | D |  |
| PSI-20-r14-2 | 100% CH4 | 40 | — | — | hayır | D |  |
| PSI-20-r15-1 | 50% C2H4 | 25 | — | — | hayır | D |  |
| PSI-20-r15-2 | 50% C2H4 | 40 | — | — | hayır | D |  |
| **PSI-20-r16-1** | 100% C2H4 | 34 | — | **0.558** | evet | C |  |
| PSI-20-r16-2 | 100% C2H4 | 40 | — | — | hayır | D |  |
| PSI-20-r17-1 | 100% C2H4 | 25 | — | — | hayır | D |  |
| **PSI-20-r17-2** | 100% C2H4 | 34 | — | **0.558** | evet | C |  |
| PSI-20-r17-3 | 100% C2H4 | 40 | — | — | hayır | D |  |
| PSI-20-r18-1 | 100% C2H4 | 21 | — | 1 | hayır | C |  |
| **PSI-20-r18-2** | 100% C2H4 | 26.5 | — | **0.694** | hayır | C |  |
| **PSI-20-r18-3** | 100% C2H4 | 34 | — | **0.558** | evet | C |  |
| PSI-20-r19-1 | 100% C2H4 | 25 | — | — | hayır | D |  |
| **PSI-20-r19-2** | 100% C2H4 | 34 | — | **0.558** | evet | C |  |
| PSI-20-r19-3 | 100% C2H4 | 40 | — | — | hayır | D |  |

## 7. Katı yakıt

**Moon box'ta katı yakıt: YOK.** Katı yakıt satırı 264; en yüksek O2 (o2_pct_max) = 22.722 % (PSI-26). PSI'da ≥ %30 O2'li katı yakıt testi yok (PSI-25'teki 39.1 / 40.4 'final O2' kolonu; bilinen hata, kullanılmadı).
