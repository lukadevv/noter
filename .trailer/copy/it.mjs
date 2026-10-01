/**
 * Italian trailer: on-screen text and the demo data the app is filled with.
 * Same shape as en.mjs; see there for what each field is for.
 */
export default {
  browserLocale: 'it-IT',
  cards: {
    intro: {
      headline: 'Tutta la tua giornata, in un solo posto.',
      features: ['Note', 'Timer', 'Abitudini', 'Farmaci', 'Password'],
    },
    localFirst: {
      statements: ['Nessun account.', 'Nessun server.', 'Funziona offline.'],
      kicker: 'I tuoi dati restano sul tuo dispositivo.',
      platforms: ['Web', 'Windows', 'macOS', 'Linux', 'Android'],
    },
    outro: {
      tagline: 'Gratis e open source.',
      url: 'noter.lukadevv.com',
      store: 'Disponibile su Microsoft Store',
    },
  },
  captions: {
    home: "Tutta la giornata a colpo d'occhio",
    notes: 'Note con blocchi, link e tag',
    timers: 'Sveglie e Pomodoro',
    vault: 'Cassaforte cifrata e cartelle protette',
  },
  typing: {
    title: 'Lancio v1.2',
    tasks: ['Screenshot dello store', 'Registrare il trailer'],
    see: 'Vedi',
    link: 'Idee di marketing',
    tag: 'lancio',
  },
  demo: {
    folderPassphrase: 'cielo-di-marzo-42',
    vaultPassword: 'tre parole lunghe',
    folders: [
      {
        key: 'work',
        name: 'Lavoro',
        icon: 'lucide:briefcase',
        color: '#4fb3d9',
      },
      {
        key: 'personal',
        name: 'Personale',
        icon: 'lucide:house',
        color: '#5cbf92',
      },
      {
        key: 'reading',
        name: 'Letture',
        icon: 'lucide:book-open',
        color: '#d9a441',
      },
      {
        key: 'journal',
        name: 'Diario',
        icon: 'lucide:feather',
        color: '#c27ad8',
        encrypted: true,
      },
    ],
    notes: [
      {
        folder: 'work',
        title: 'Lancio v1.2',
        hoursAgo: 0.3,
        body: 'Da fare entro venerdì:',
      },
      {
        folder: 'work',
        title: 'Idee di marketing',
        hoursAgo: 3,
        body: '- Video breve per i social\n- Confronto con altre app\n- Guida alle scorciatoie #marketing',
        pinned: true,
      },
      {
        folder: 'work',
        title: 'Riunione design',
        hoursAgo: 6,
        body: 'Rivista la nuova barra laterale e le icone.\n\n- [x] Palette colori\n- [ ] Modalità compatta #design',
      },
      {
        folder: 'personal',
        title: 'Lista della spesa',
        hoursAgo: 20,
        body: "- [ ] Caffè\n- [ ] Pane integrale\n- [x] Fragole\n- [ ] Latte d'avena #casa",
      },
      {
        folder: 'reading',
        title: "L'arte della quiete",
        hoursAgo: 30,
        body: "> Andare da nessuna parte può essere un'avventura.\n\nPico Iyer, sul rallentare. #libri",
      },
      {
        folder: 'personal',
        title: 'Gita al mare',
        hoursAgo: 52,
        body: "Partenza il 14. Prenotare la casetta, controllare l'auto. #viaggi",
      },
      {
        folder: 'journal',
        title: 'Martedì',
        hoursAgo: 26,
        body: 'Passeggiata presto e finalmente finito il capitolo.',
      },
      {
        folder: 'journal',
        title: 'Lunedì',
        hoursAgo: 50,
        body: 'Settimana nuova. Meno schermi, più libri.',
      },
    ],
    habits: [
      {
        name: 'Leggere 20 minuti',
        icon: 'book-open',
        color: '#d9a441',
        streak: 12,
      },
      {
        name: 'Camminare',
        icon: 'footprints',
        color: '#5cbf92',
        streak: 27,
      },
      {
        name: "Bicchieri d'acqua",
        icon: 'glass-water',
        color: '#4fb3d9',
        target: 8,
        streak: 5,
        todayCount: 5,
      },
      {
        name: 'Meditare',
        icon: 'flower-2',
        color: '#c27ad8',
        streak: 3,
      },
    ],
    meds: [
      {
        name: 'Vitamina D',
        dose: '1000 UI',
        color: '#d9a441',
        intervalHours: 24,
        lastTakenHoursAgo: 24,
        stock: 24,
      },
      {
        name: 'Omega 3',
        dose: '1 capsula',
        color: '#4fb3d9',
        intervalHours: 12,
        lastTakenHoursAgo: 3,
      },
    ],
    presets: [
      {
        label: 'Tè',
        minutes: 4,
        color: '#5cbf92',
        soundId: 'soft',
      },
      {
        label: 'Forno',
        minutes: 25,
        color: '#e06a5a',
        soundId: 'bell',
      },
      {
        label: 'Pisolino',
        minutes: 20,
        color: '#8b8ce8',
        soundId: 'soft',
      },
      {
        label: 'Bucato',
        minutes: 45,
        color: '#4fb3d9',
        soundId: 'classic',
      },
      {
        label: 'Stretching',
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
        title: 'Banca',
        favorite: true,
        fields: {
          username: 'lucia.r',
          password: 'Rame*Nuvola*88',
        },
      },
      {
        kind: 'login',
        title: 'Email personale',
        fields: {
          username: 'lucia@example.com',
          password: 'Marea-Lenta-27!',
          url: 'https://mail.example.com',
        },
      },
      {
        kind: 'wifi',
        title: 'Wi-Fi di casa',
        fields: {
          network: 'Casa_5G',
          password: 'girasoli-alla-finestra',
        },
      },
      {
        kind: 'card',
        title: 'Carta di debito',
        fields: {
          cardholder: 'Lucia Romano',
          number: '4000 1234 5678 9010',
          expiry: '09/29',
          cvv: '123',
        },
      },
      {
        kind: 'note',
        title: 'Codici di backup',
        fields: {
          text: '1842-7731\n5520-0917\n3365-4402',
        },
      },
    ],
  },
}
