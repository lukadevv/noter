/**
 * Portuguese (Brazil) trailer: on-screen text and the demo data the app is filled with.
 * Same shape as en.mjs; see there for what each field is for.
 */
export default {
  browserLocale: 'pt-BR',
  cards: {
    intro: {
      headline: 'Seu dia inteiro, em um só lugar.',
      features: ['Notas', 'Timers', 'Hábitos', 'Medicação', 'Senhas'],
    },
    localFirst: {
      statements: ['Sem conta.', 'Sem servidor.', 'Funciona offline.'],
      kicker: 'Seus dados ficam no seu dispositivo.',
      platforms: ['Web', 'Windows', 'macOS', 'Linux', 'Android'],
    },
    outro: {
      tagline: 'Grátis e de código aberto.',
      url: 'noter.lukadevv.com',
      store: 'Disponível na Microsoft Store',
    },
  },
  captions: {
    home: 'Seu dia inteiro num relance',
    notes: 'Notas com blocos, links e tags',
    timers: 'Alarmes e Pomodoro',
    vault: 'Cofre criptografado e pastas protegidas',
  },
  typing: {
    title: 'Lançamento v1.2',
    tasks: ['Capturas da loja', 'Gravar o trailer'],
    see: 'Baseado em',
    link: 'Ideias de marketing',
    tag: 'lançamento',
  },
  demo: {
    folderPassphrase: 'ceu-de-marco-42',
    vaultPassword: 'tres palavras longas',
    folders: [
      {
        key: 'work',
        name: 'Trabalho',
        icon: 'lucide:briefcase',
        color: '#4fb3d9',
      },
      {
        key: 'personal',
        name: 'Pessoal',
        icon: 'lucide:house',
        color: '#5cbf92',
      },
      {
        key: 'reading',
        name: 'Leituras',
        icon: 'lucide:book-open',
        color: '#d9a441',
      },
      {
        key: 'journal',
        name: 'Diário',
        icon: 'lucide:feather',
        color: '#c27ad8',
        encrypted: true,
      },
    ],
    notes: [
      {
        folder: 'work',
        title: 'Lançamento v1.2',
        hoursAgo: 0.3,
        body: 'Pendências para sexta:',
      },
      {
        folder: 'work',
        title: 'Ideias de marketing',
        hoursAgo: 3,
        body: '- Vídeo curto para redes\n- Comparativo com outros apps\n- Guia de atalhos #marketing',
        pinned: true,
      },
      {
        folder: 'work',
        title: 'Reunião com design',
        hoursAgo: 6,
        body: 'Revisamos a nova barra lateral e os ícones.\n\n- [x] Paleta de cores\n- [ ] Modo compacto #design',
      },
      {
        folder: 'personal',
        title: 'Lista de compras',
        hoursAgo: 20,
        body: '- [ ] Café\n- [ ] Pão integral\n- [x] Morangos\n- [ ] Leite de aveia #casa',
      },
      {
        folder: 'reading',
        title: 'A arte da quietude',
        hoursAgo: 30,
        body: '> Ir a lugar nenhum também pode ser uma aventura.\n\nPico Iyer, sobre desacelerar. #livros',
      },
      {
        folder: 'personal',
        title: 'Viagem para o litoral',
        hoursAgo: 52,
        body: 'Saída no dia 14. Reservar a cabana e revisar o carro. #viagens',
      },
      {
        folder: 'journal',
        title: 'Terça',
        hoursAgo: 26,
        body: 'Saí para caminhar cedo e finalmente terminei o capítulo.',
      },
      {
        folder: 'journal',
        title: 'Segunda',
        hoursAgo: 50,
        body: 'Semana nova. Menos telas, mais livros.',
      },
    ],
    habits: [
      {
        name: 'Ler 20 minutos',
        icon: 'book-open',
        color: '#d9a441',
        streak: 12,
      },
      {
        name: 'Caminhar',
        icon: 'footprints',
        color: '#5cbf92',
        streak: 27,
      },
      {
        name: 'Copos de água',
        icon: 'glass-water',
        color: '#4fb3d9',
        target: 8,
        streak: 5,
        todayCount: 5,
      },
      {
        name: 'Meditar',
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
        name: 'Ômega 3',
        dose: '1 cápsula',
        color: '#4fb3d9',
        intervalHours: 12,
        lastTakenHoursAgo: 3,
      },
    ],
    presets: [
      {
        label: 'Chá',
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
        label: 'Soneca',
        minutes: 20,
        color: '#8b8ce8',
        soundId: 'soft',
      },
      {
        label: 'Roupa',
        minutes: 45,
        color: '#4fb3d9',
        soundId: 'classic',
      },
      {
        label: 'Alongar',
        minutes: 50,
        color: '#d9a441',
        soundId: 'pulse',
      },
      {
        label: 'Macarrão',
        minutes: 9,
        color: '#c27ad8',
        soundId: 'digital',
      },
    ],
    secrets: [
      {
        kind: 'login',
        title: 'Banco',
        favorite: true,
        fields: {
          username: 'lucia.r',
          password: 'Cobre*Nuvem*88',
        },
      },
      {
        kind: 'login',
        title: 'E-mail pessoal',
        fields: {
          username: 'lucia@example.com',
          password: 'Mare-Lenta-27!',
          url: 'https://mail.example.com',
        },
      },
      {
        kind: 'wifi',
        title: 'Wi-Fi de casa',
        fields: {
          network: 'Casa_5G',
          password: 'girassois-na-janela',
        },
      },
      {
        kind: 'card',
        title: 'Cartão de débito',
        fields: {
          cardholder: 'Lúcia Ramos',
          number: '4000 1234 5678 9010',
          expiry: '09/29',
          cvv: '123',
        },
      },
      {
        kind: 'note',
        title: 'Códigos de backup',
        fields: {
          text: '1842-7731\n5520-0917\n3365-4402',
        },
      },
    ],
  },
}
