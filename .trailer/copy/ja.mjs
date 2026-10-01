/**
 * Japanese trailer: on-screen text and the demo data the app is filled with.
 * Same shape as en.mjs; see there for what each field is for.
 */
export default {
  browserLocale: 'ja-JP',
  cards: {
    intro: {
      headline: 'あなたの一日を、ひとつの場所に。',
      features: ['ノート', 'タイマー', '習慣', '服薬', 'パスワード'],
    },
    localFirst: {
      statements: ['アカウント不要。', 'サーバー不要。', 'オフラインで動く。'],
      kicker: 'データはあなたのデバイスに残ります。',
      platforms: ['Web', 'Windows', 'macOS', 'Linux', 'Android'],
    },
    outro: {
      tagline: '無料、オープンソース。',
      url: 'noter.lukadevv.com',
      store: 'Microsoft Store で配信中',
    },
  },
  captions: {
    home: '一日をひと目で',
    notes: 'ブロック・リンク・タグで書くノート',
    timers: 'アラームとポモドーロ',
    vault: '暗号化された保管庫とロック付きフォルダー',
  },
  typing: {
    title: 'リリース v1.2',
    tasks: ['ストアのスクショ', 'トレーラー収録'],
    see: '参考：',
    link: 'マーケティング案',
    tag: 'リリース',
    linkTyped: 'マーケ',
  },
  demo: {
    folderPassphrase: 'haru-no-sora-42',
    vaultPassword: 'mittsu no nagai kotoba',
    folders: [
      {
        key: 'work',
        name: '仕事',
        icon: 'lucide:briefcase',
        color: '#4fb3d9',
      },
      {
        key: 'personal',
        name: '個人',
        icon: 'lucide:house',
        color: '#5cbf92',
      },
      {
        key: 'reading',
        name: '読書',
        icon: 'lucide:book-open',
        color: '#d9a441',
      },
      {
        key: 'journal',
        name: '日記',
        icon: 'lucide:feather',
        color: '#c27ad8',
        encrypted: true,
      },
    ],
    notes: [
      {
        folder: 'work',
        title: 'リリース v1.2',
        hoursAgo: 0.3,
        body: '金曜までにやること：',
      },
      {
        folder: 'work',
        title: 'マーケティング案',
        hoursAgo: 3,
        body: '- SNS 用のショート動画\n- 他アプリとの比較\n- ショートカットガイド #マーケティング',
        pinned: true,
      },
      {
        folder: 'work',
        title: 'デザイン定例',
        hoursAgo: 6,
        body: '新しいサイドバーとアイコンを確認。\n\n- [x] カラーパレット\n- [ ] コンパクトモード #デザイン',
      },
      {
        folder: 'personal',
        title: '買い物リスト',
        hoursAgo: 20,
        body: '- [ ] コーヒー\n- [ ] 全粒粉パン\n- [x] いちご\n- [ ] オーツミルク #家',
      },
      {
        folder: 'reading',
        title: '静けさの技法',
        hoursAgo: 30,
        body: '> どこにも行かないことも、ひとつの冒険になる。\n\nピコ・アイヤー、ゆっくり生きることについて。 #読書',
      },
      {
        folder: 'personal',
        title: '海辺の旅行',
        hoursAgo: 52,
        body: '14日に出発。コテージを予約して、車を点検。 #旅行',
      },
      {
        folder: 'journal',
        title: '火曜日',
        hoursAgo: 26,
        body: '朝早く散歩して、やっと章を書き終えた。',
      },
      {
        folder: 'journal',
        title: '月曜日',
        hoursAgo: 50,
        body: '新しい一週間。画面は少なめ、本は多め。',
      },
    ],
    habits: [
      {
        name: '20分読書',
        icon: 'book-open',
        color: '#d9a441',
        streak: 12,
      },
      {
        name: '散歩',
        icon: 'footprints',
        color: '#5cbf92',
        streak: 27,
      },
      {
        name: '水を飲む（杯）',
        icon: 'glass-water',
        color: '#4fb3d9',
        target: 8,
        streak: 5,
        todayCount: 5,
      },
      {
        name: '瞑想',
        icon: 'flower-2',
        color: '#c27ad8',
        streak: 3,
      },
    ],
    meds: [
      {
        name: 'ビタミンD',
        dose: '1000 IU',
        color: '#d9a441',
        intervalHours: 24,
        lastTakenHoursAgo: 24,
        stock: 24,
      },
      {
        name: 'オメガ3',
        dose: '1カプセル',
        color: '#4fb3d9',
        intervalHours: 12,
        lastTakenHoursAgo: 3,
      },
    ],
    presets: [
      {
        label: 'お茶',
        minutes: 4,
        color: '#5cbf92',
        soundId: 'soft',
      },
      {
        label: 'オーブン',
        minutes: 25,
        color: '#e06a5a',
        soundId: 'bell',
      },
      {
        label: '昼寝',
        minutes: 20,
        color: '#8b8ce8',
        soundId: 'soft',
      },
      {
        label: '洗濯',
        minutes: 45,
        color: '#4fb3d9',
        soundId: 'classic',
      },
      {
        label: 'ストレッチ',
        minutes: 50,
        color: '#d9a441',
        soundId: 'pulse',
      },
      {
        label: 'パスタ',
        minutes: 9,
        color: '#c27ad8',
        soundId: 'digital',
      },
    ],
    secrets: [
      {
        kind: 'login',
        title: '銀行',
        favorite: true,
        fields: {
          username: 'yui.s',
          password: 'Dou*Kumo*88',
        },
      },
      {
        kind: 'login',
        title: '個人メール',
        fields: {
          username: 'yui@example.com',
          password: 'Shizuka-Nami-27!',
          url: 'https://mail.example.com',
        },
      },
      {
        kind: 'wifi',
        title: '自宅の Wi-Fi',
        fields: {
          network: 'Home_5G',
          password: 'himawari-no-mado',
        },
      },
      {
        kind: 'card',
        title: 'デビットカード',
        fields: {
          cardholder: '佐藤 結衣',
          number: '4000 1234 5678 9010',
          expiry: '09/29',
          cvv: '123',
        },
      },
      {
        kind: 'note',
        title: 'バックアップコード',
        fields: {
          text: '1842-7731\n5520-0917\n3365-4402',
        },
      },
    ],
  },
}
