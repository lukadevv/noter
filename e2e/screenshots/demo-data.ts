import type { Locale } from '../../src/lib/i18n/types'

/**
 * The made-up content shown in the screenshots, written once per language.
 *
 * Only what the user would have typed lives here (habit and medication names,
 * note text). Everything the app itself labels comes from its own catalogues,
 * so a screenshot never shows a translation that the app does not.
 */
export interface DemoData {
  habits: { water: string; read: string; gym: string }
  meds: { ibuprofen: string; ibuprofenDose: string; vitaminD: string; vitaminDDose: string }
  /** Markdown bodies; the first line is a heading, which becomes the title. */
  notes: string[]
}

export const DEMO: Record<Locale, DemoData> = {
  en: {
    habits: { water: 'Drink water', read: 'Read 10 pages', gym: 'Gym' },
    meds: {
      ibuprofen: 'Ibuprofen',
      ibuprofenDose: '400 mg',
      vitaminD: 'Vitamin D',
      vitaminDDose: '1 tablet',
    },
    notes: [
      '# Weekly plan\n\n- [x] Book the dentist\n- [x] Pay the rent\n- [ ] Finish the quarterly report\n- [ ] Call grandma\n- [ ] Buy a birthday gift',
      '# Trip to Lisbon\n\nFlying out on the 14th, back on the 21st.\n\n## To see\n- Belém Tower\n- Alfama at sunset\n- Day trip to Sintra',
      '# Lentil soup\n\n## Ingredients\n- 250 g red lentils\n- 1 onion, 2 carrots\n- Cumin, paprika, lemon\n\nSimmer for 25 minutes, then blend half.',
      '# Meeting notes\n\nLaunch moved to **October 12**. Design review on Friday.',
      '# Weekend ideas\n\n- Farmers market on Saturday\n- Finish the puzzle\n- Long walk by the river',
    ],
  },
  es: {
    habits: { water: 'Beber agua', read: 'Leer 10 páginas', gym: 'Gimnasio' },
    meds: {
      ibuprofen: 'Ibuprofeno',
      ibuprofenDose: '400 mg',
      vitaminD: 'Vitamina D',
      vitaminDDose: '1 comprimido',
    },
    notes: [
      '# Plan de la semana\n\n- [x] Pedir cita con el dentista\n- [x] Pagar el alquiler\n- [ ] Terminar el informe trimestral\n- [ ] Llamar a la abuela\n- [ ] Comprar un regalo de cumpleaños',
      '# Viaje a Lisboa\n\nVuelo el día 14, vuelta el 21.\n\n## Qué ver\n- Torre de Belém\n- Alfama al atardecer\n- Excursión a Sintra',
      '# Sopa de lentejas\n\n## Ingredientes\n- 250 g de lentejas rojas\n- 1 cebolla, 2 zanahorias\n- Comino, pimentón, limón\n\nCocer 25 minutos y triturar la mitad.',
      '# Notas de la reunión\n\nEl lanzamiento pasa al **12 de octubre**. Revisión de diseño el viernes.',
      '# Ideas para el finde\n\n- Mercado el sábado\n- Terminar el puzle\n- Paseo largo junto al río',
    ],
  },
  pt: {
    habits: { water: 'Beber água', read: 'Ler 10 páginas', gym: 'Academia' },
    meds: {
      ibuprofen: 'Ibuprofeno',
      ibuprofenDose: '400 mg',
      vitaminD: 'Vitamina D',
      vitaminDDose: '1 comprimido',
    },
    notes: [
      '# Plano da semana\n\n- [x] Marcar o dentista\n- [x] Pagar o aluguel\n- [ ] Terminar o relatório trimestral\n- [ ] Ligar para a vó\n- [ ] Comprar um presente de aniversário',
      '# Viagem a Lisboa\n\nVoo no dia 14, volta no dia 21.\n\n## Para ver\n- Torre de Belém\n- Alfama ao pôr do sol\n- Passeio a Sintra',
      '# Sopa de lentilha\n\n## Ingredientes\n- 250 g de lentilha vermelha\n- 1 cebola, 2 cenouras\n- Cominho, páprica, limão\n\nCozinhe por 25 minutos e bata metade.',
      '# Notas da reunião\n\nO lançamento passou para **12 de outubro**. Revisão de design na sexta.',
      '# Ideias para o fim de semana\n\n- Feira no sábado\n- Terminar o quebra-cabeça\n- Caminhada longa à beira do rio',
    ],
  },
  fr: {
    habits: { water: 'Boire de l’eau', read: 'Lire 10 pages', gym: 'Salle de sport' },
    meds: {
      ibuprofen: 'Ibuprofène',
      ibuprofenDose: '400 mg',
      vitaminD: 'Vitamine D',
      vitaminDDose: '1 comprimé',
    },
    notes: [
      '# Planning de la semaine\n\n- [x] Prendre rendez-vous chez le dentiste\n- [x] Payer le loyer\n- [ ] Finir le rapport trimestriel\n- [ ] Appeler mamie\n- [ ] Acheter un cadeau d’anniversaire',
      '# Voyage à Lisbonne\n\nVol le 14, retour le 21.\n\n## À voir\n- Tour de Belém\n- Alfama au coucher du soleil\n- Excursion à Sintra',
      '# Soupe de lentilles\n\n## Ingrédients\n- 250 g de lentilles corail\n- 1 oignon, 2 carottes\n- Cumin, paprika, citron\n\nMijoter 25 minutes, puis mixer la moitié.',
      '# Notes de réunion\n\nLe lancement est repoussé au **12 octobre**. Revue design vendredi.',
      '# Idées pour le week-end\n\n- Marché samedi\n- Finir le puzzle\n- Longue balade au bord de la rivière',
    ],
  },
  de: {
    habits: { water: 'Wasser trinken', read: '10 Seiten lesen', gym: 'Fitnessstudio' },
    meds: {
      ibuprofen: 'Ibuprofen',
      ibuprofenDose: '400 mg',
      vitaminD: 'Vitamin D',
      vitaminDDose: '1 Tablette',
    },
    notes: [
      '# Wochenplan\n\n- [x] Zahnarzttermin vereinbaren\n- [x] Miete überweisen\n- [ ] Quartalsbericht fertigstellen\n- [ ] Oma anrufen\n- [ ] Geburtstagsgeschenk kaufen',
      '# Reise nach Lissabon\n\nHinflug am 14., zurück am 21.\n\n## Sehenswert\n- Torre de Belém\n- Alfama bei Sonnenuntergang\n- Tagesausflug nach Sintra',
      '# Linsensuppe\n\n## Zutaten\n- 250 g rote Linsen\n- 1 Zwiebel, 2 Karotten\n- Kreuzkümmel, Paprika, Zitrone\n\n25 Minuten köcheln lassen, dann die Hälfte pürieren.',
      '# Besprechungsnotizen\n\nDer Launch ist auf den **12. Oktober** verschoben. Design-Review am Freitag.',
      '# Ideen fürs Wochenende\n\n- Wochenmarkt am Samstag\n- Das Puzzle fertig machen\n- Langer Spaziergang am Fluss',
    ],
  },
  it: {
    habits: { water: 'Bere acqua', read: 'Leggere 10 pagine', gym: 'Palestra' },
    meds: {
      ibuprofen: 'Ibuprofene',
      ibuprofenDose: '400 mg',
      vitaminD: 'Vitamina D',
      vitaminDDose: '1 compressa',
    },
    notes: [
      '# Piano della settimana\n\n- [x] Prenotare il dentista\n- [x] Pagare l’affitto\n- [ ] Finire il report trimestrale\n- [ ] Chiamare la nonna\n- [ ] Comprare un regalo di compleanno',
      '# Viaggio a Lisbona\n\nVolo il 14, ritorno il 21.\n\n## Da vedere\n- Torre di Belém\n- Alfama al tramonto\n- Gita a Sintra',
      '# Zuppa di lenticchie\n\n## Ingredienti\n- 250 g di lenticchie rosse\n- 1 cipolla, 2 carote\n- Cumino, paprika, limone\n\nCuocere 25 minuti, poi frullare metà.',
      '# Appunti della riunione\n\nIl lancio slitta al **12 ottobre**. Revisione del design venerdì.',
      '# Idee per il weekend\n\n- Mercato sabato\n- Finire il puzzle\n- Lunga passeggiata lungo il fiume',
    ],
  },
  zh: {
    habits: { water: '喝水', read: '读 10 页书', gym: '健身' },
    meds: {
      ibuprofen: '布洛芬',
      ibuprofenDose: '400 mg',
      vitaminD: '维生素 D',
      vitaminDDose: '1 片',
    },
    notes: [
      '# 本周计划\n\n- [x] 预约牙医\n- [x] 交房租\n- [ ] 完成季度报告\n- [ ] 给奶奶打电话\n- [ ] 买生日礼物',
      '# 里斯本之旅\n\n14 号出发，21 号返回。\n\n## 想去的地方\n- 贝伦塔\n- 日落时的阿尔法玛\n- 辛特拉一日游',
      '# 扁豆汤\n\n## 食材\n- 红扁豆 250 g\n- 洋葱 1 个，胡萝卜 2 根\n- 孜然、红椒粉、柠檬\n\n小火煮 25 分钟，再把一半打成泥。',
      '# 会议记录\n\n发布推迟到 **10 月 12 日**。周五进行设计评审。',
      '# 周末计划\n\n- 周六逛集市\n- 拼完拼图\n- 沿河散步',
    ],
  },
  ja: {
    habits: { water: '水を飲む', read: '10ページ読む', gym: 'ジム' },
    meds: {
      ibuprofen: 'イブプロフェン',
      ibuprofenDose: '400 mg',
      vitaminD: 'ビタミンD',
      vitaminDDose: '1錠',
    },
    notes: [
      '# 今週の予定\n\n- [x] 歯医者を予約する\n- [x] 家賃を払う\n- [ ] 四半期レポートを仕上げる\n- [ ] おばあちゃんに電話する\n- [ ] 誕生日プレゼントを買う',
      '# リスボン旅行\n\n14日に出発、21日に帰国。\n\n## 見たいもの\n- ベレンの塔\n- 夕暮れのアルファマ\n- シントラへ日帰り',
      '# レンズ豆のスープ\n\n## 材料\n- 赤レンズ豆 250 g\n- 玉ねぎ 1個、にんじん 2本\n- クミン、パプリカ、レモン\n\n25分煮込み、半分をミキサーにかける。',
      '# 会議メモ\n\nリリースは **10月12日** に延期。金曜日にデザインレビュー。',
      '# 週末にやりたいこと\n\n- 土曜日にマルシェ\n- パズルを完成させる\n- 川沿いを長めに散歩',
    ],
  },
  ko: {
    habits: { water: '물 마시기', read: '10쪽 읽기', gym: '헬스' },
    meds: {
      ibuprofen: '이부프로펜',
      ibuprofenDose: '400 mg',
      vitaminD: '비타민 D',
      vitaminDDose: '1정',
    },
    notes: [
      '# 이번 주 계획\n\n- [x] 치과 예약하기\n- [x] 월세 내기\n- [ ] 분기 보고서 마무리\n- [ ] 할머니께 전화하기\n- [ ] 생일 선물 사기',
      '# 리스본 여행\n\n14일 출발, 21일 귀국.\n\n## 가 볼 곳\n- 벨렝 탑\n- 해 질 녘 알파마\n- 신트라 당일치기',
      '# 렌틸콩 수프\n\n## 재료\n- 붉은 렌틸콩 250 g\n- 양파 1개, 당근 2개\n- 커민, 파프리카, 레몬\n\n25분 끓인 뒤 절반을 갈아 주세요.',
      '# 회의 메모\n\n출시일이 **10월 12일**로 연기됨. 금요일에 디자인 리뷰.',
      '# 주말 아이디어\n\n- 토요일 장터 구경\n- 퍼즐 완성하기\n- 강변 따라 오래 걷기',
    ],
  },
  ar: {
    habits: { water: 'شرب الماء', read: 'قراءة 10 صفحات', gym: 'النادي الرياضي' },
    meds: {
      ibuprofen: 'إيبوبروفين',
      ibuprofenDose: '400 ملغ',
      vitaminD: 'فيتامين د',
      vitaminDDose: 'قرص واحد',
    },
    notes: [
      '# خطة الأسبوع\n\n- [x] حجز موعد عند طبيب الأسنان\n- [x] دفع الإيجار\n- [ ] إنهاء التقرير الربعي\n- [ ] الاتصال بالجدة\n- [ ] شراء هدية عيد ميلاد',
      '# رحلة إلى لشبونة\n\nالسفر يوم 14 والعودة يوم 21.\n\n## أماكن للزيارة\n- برج بيليم\n- حي ألفاما عند الغروب\n- رحلة يومية إلى سينترا',
      '# شوربة العدس\n\n## المكونات\n- 250 غ عدس أحمر\n- بصلة وجزرتان\n- كمون وبابريكا وليمون\n\nاطبخها على نار هادئة 25 دقيقة ثم اهرس نصفها.',
      '# ملاحظات الاجتماع\n\nتأجّل الإطلاق إلى **12 أكتوبر**. مراجعة التصميم يوم الجمعة.',
      '# أفكار لعطلة نهاية الأسبوع\n\n- السوق يوم السبت\n- إكمال الأحجية\n- نزهة طويلة على ضفة النهر',
    ],
  },
}
