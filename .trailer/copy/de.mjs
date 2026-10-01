/**
 * German trailer: on-screen text and the demo data the app is filled with.
 * Same shape as en.mjs; see there for what each field is for.
 */
export default {
  browserLocale: 'de-DE',
  cards: {
    intro: {
      headline: 'Dein ganzer Tag, an einem Ort.',
      features: ['Notizen', 'Timer', 'Gewohnheiten', 'Medikamente', 'Passwörter'],
    },
    localFirst: {
      statements: ['Kein Konto.', 'Kein Server.', 'Funktioniert offline.'],
      kicker: 'Deine Daten bleiben auf deinem Gerät.',
      platforms: ['Web', 'Windows', 'macOS', 'Linux', 'Android'],
    },
    outro: {
      tagline: 'Kostenlos und Open Source.',
      url: 'noter.lukadevv.com',
      store: 'Erhältlich im Microsoft Store',
    },
  },
  captions: {
    home: 'Dein ganzer Tag auf einen Blick',
    notes: 'Notizen mit Blöcken, Links und Tags',
    timers: 'Wecker und Pomodoro',
    vault: 'Verschlüsselter Tresor und gesperrte Ordner',
  },
  typing: {
    title: 'Launch v1.2',
    tasks: ['Store-Screenshots', 'Trailer aufnehmen'],
    see: 'Siehe',
    link: 'Marketing-Ideen',
    tag: 'launch',
  },
  demo: {
    folderPassphrase: 'maerz-himmel-42',
    vaultPassword: 'drei lange woerter',
    folders: [
      {
        key: 'work',
        name: 'Arbeit',
        icon: 'lucide:briefcase',
        color: '#4fb3d9',
      },
      {
        key: 'personal',
        name: 'Privat',
        icon: 'lucide:house',
        color: '#5cbf92',
      },
      {
        key: 'reading',
        name: 'Lesen',
        icon: 'lucide:book-open',
        color: '#d9a441',
      },
      {
        key: 'journal',
        name: 'Tagebuch',
        icon: 'lucide:feather',
        color: '#c27ad8',
        encrypted: true,
      },
    ],
    notes: [
      {
        folder: 'work',
        title: 'Launch v1.2',
        hoursAgo: 0.3,
        body: 'Bis Freitag erledigen:',
      },
      {
        folder: 'work',
        title: 'Marketing-Ideen',
        hoursAgo: 3,
        body: '- Kurzes Video für Social Media\n- Vergleich mit anderen Apps\n- Tastenkürzel-Guide #marketing',
        pinned: true,
      },
      {
        folder: 'work',
        title: 'Design-Abstimmung',
        hoursAgo: 6,
        body: 'Neue Seitenleiste und Icons besprochen.\n\n- [x] Farbpalette\n- [ ] Kompaktmodus #design',
      },
      {
        folder: 'personal',
        title: 'Einkaufsliste',
        hoursAgo: 20,
        body: '- [ ] Kaffee\n- [ ] Vollkornbrot\n- [x] Erdbeeren\n- [ ] Hafermilch #zuhause',
      },
      {
        folder: 'reading',
        title: 'Die Kunst des Innehaltens',
        hoursAgo: 30,
        body: '> Nirgendwohin zu gehen kann auch ein Abenteuer sein.\n\nPico Iyer übers Langsamerwerden. #bücher',
      },
      {
        folder: 'personal',
        title: 'Ausflug an die Küste',
        hoursAgo: 52,
        body: 'Abfahrt am 14. Hütte buchen, Auto checken. #reisen',
      },
      {
        folder: 'journal',
        title: 'Dienstag',
        hoursAgo: 26,
        body: 'Früh spazieren gewesen und endlich das Kapitel fertig.',
      },
      {
        folder: 'journal',
        title: 'Montag',
        hoursAgo: 50,
        body: 'Neue Woche. Weniger Bildschirm, mehr Bücher.',
      },
    ],
    habits: [
      {
        name: '20 Minuten lesen',
        icon: 'book-open',
        color: '#d9a441',
        streak: 12,
      },
      {
        name: 'Spazieren',
        icon: 'footprints',
        color: '#5cbf92',
        streak: 27,
      },
      {
        name: 'Gläser Wasser',
        icon: 'glass-water',
        color: '#4fb3d9',
        target: 8,
        streak: 5,
        todayCount: 5,
      },
      {
        name: 'Meditieren',
        icon: 'flower-2',
        color: '#c27ad8',
        streak: 3,
      },
    ],
    meds: [
      {
        name: 'Vitamin D',
        dose: '1000 IE',
        color: '#d9a441',
        intervalHours: 24,
        lastTakenHoursAgo: 24,
        stock: 24,
      },
      {
        name: 'Omega 3',
        dose: '1 Kapsel',
        color: '#4fb3d9',
        intervalHours: 12,
        lastTakenHoursAgo: 3,
      },
    ],
    presets: [
      {
        label: 'Tee',
        minutes: 4,
        color: '#5cbf92',
        soundId: 'soft',
      },
      {
        label: 'Ofen',
        minutes: 25,
        color: '#e06a5a',
        soundId: 'bell',
      },
      {
        label: 'Nickerchen',
        minutes: 20,
        color: '#8b8ce8',
        soundId: 'soft',
      },
      {
        label: 'Wäsche',
        minutes: 45,
        color: '#4fb3d9',
        soundId: 'classic',
      },
      {
        label: 'Dehnen',
        minutes: 50,
        color: '#d9a441',
        soundId: 'pulse',
      },
      {
        label: 'Pasta',
        minutes: 9,
        color: '#c27ad8',
        soundId: 'digital',
      },
    ],
    secrets: [
      {
        kind: 'login',
        title: 'Bank',
        favorite: true,
        fields: {
          username: 'lena.r',
          password: 'Kupfer*Wolke*88',
        },
      },
      {
        kind: 'login',
        title: 'Private E-Mail',
        fields: {
          username: 'lena@example.com',
          password: 'Leise-Flut-27!',
          url: 'https://mail.example.com',
        },
      },
      {
        kind: 'wifi',
        title: 'WLAN zu Hause',
        fields: {
          network: 'Zuhause_5G',
          password: 'sonnenblumen-am-fenster',
        },
      },
      {
        kind: 'card',
        title: 'Debitkarte',
        fields: {
          cardholder: 'Lena Richter',
          number: '4000 1234 5678 9010',
          expiry: '09/29',
          cvv: '123',
        },
      },
      {
        kind: 'note',
        title: 'Backup-Codes',
        fields: {
          text: '1842-7731\n5520-0917\n3365-4402',
        },
      },
    ],
  },
}
