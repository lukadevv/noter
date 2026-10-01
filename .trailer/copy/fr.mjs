/**
 * French trailer: on-screen text and the demo data the app is filled with.
 * Same shape as en.mjs; see there for what each field is for.
 */
export default {
  browserLocale: 'fr-FR',
  cards: {
    intro: {
      headline: 'Toute votre journée, au même endroit.',
      features: ['Notes', 'Minuteurs', 'Habitudes', 'Médicaments', 'Mots de passe'],
    },
    localFirst: {
      statements: ['Sans compte.', 'Sans serveur.', 'Fonctionne hors ligne.'],
      kicker: 'Vos données restent sur votre appareil.',
      platforms: ['Web', 'Windows', 'macOS', 'Linux', 'Android'],
    },
    outro: {
      tagline: 'Gratuit et open source.',
      url: 'noter.lukadevv.com',
      store: 'Disponible sur le Microsoft Store',
    },
  },
  captions: {
    home: "Toute votre journée en un coup d'œil",
    notes: 'Des notes avec blocs, liens et tags',
    timers: 'Alarmes et Pomodoro',
    vault: 'Coffre chiffré et dossiers verrouillés',
  },
  typing: {
    title: 'Lancement v1.2',
    tasks: ['Captures du store', 'Tourner la bande-annonce'],
    see: 'Voir aussi',
    link: 'Idées marketing',
    tag: 'lancement',
  },
  demo: {
    folderPassphrase: 'ciel-de-mars-42',
    vaultPassword: 'trois longs mots',
    folders: [
      {
        key: 'work',
        name: 'Travail',
        icon: 'lucide:briefcase',
        color: '#4fb3d9',
      },
      {
        key: 'personal',
        name: 'Perso',
        icon: 'lucide:house',
        color: '#5cbf92',
      },
      {
        key: 'reading',
        name: 'Lectures',
        icon: 'lucide:book-open',
        color: '#d9a441',
      },
      {
        key: 'journal',
        name: 'Journal',
        icon: 'lucide:feather',
        color: '#c27ad8',
        encrypted: true,
      },
    ],
    notes: [
      {
        folder: 'work',
        title: 'Lancement v1.2',
        hoursAgo: 0.3,
        body: 'À faire avant vendredi :',
      },
      {
        folder: 'work',
        title: 'Idées marketing',
        hoursAgo: 3,
        body: "- Courte vidéo pour les réseaux\n- Comparatif avec d'autres apps\n- Guide des raccourcis #marketing",
        pinned: true,
      },
      {
        folder: 'work',
        title: 'Point design',
        hoursAgo: 6,
        body: 'On a revu la nouvelle barre latérale et les icônes.\n\n- [x] Palette de couleurs\n- [ ] Mode compact #design',
      },
      {
        folder: 'personal',
        title: 'Courses',
        hoursAgo: 20,
        body: "- [ ] Café\n- [ ] Pain complet\n- [x] Fraises\n- [ ] Lait d'avoine #maison",
      },
      {
        folder: 'reading',
        title: "L'art de l'immobilité",
        hoursAgo: 30,
        body: "> Aller nulle part peut aussi être une aventure.\n\nPico Iyer, sur l'art de ralentir. #livres",
      },
      {
        folder: 'personal',
        title: 'Week-end à la mer',
        hoursAgo: 52,
        body: 'Départ le 14. Réserver le chalet, vérifier la voiture. #voyages',
      },
      {
        folder: 'journal',
        title: 'Mardi',
        hoursAgo: 26,
        body: 'Marche tôt ce matin, et enfin fini le chapitre.',
      },
      {
        folder: 'journal',
        title: 'Lundi',
        hoursAgo: 50,
        body: "Nouvelle semaine. Moins d'écrans, plus de livres.",
      },
    ],
    habits: [
      {
        name: 'Lire 20 minutes',
        icon: 'book-open',
        color: '#d9a441',
        streak: 12,
      },
      {
        name: 'Marcher',
        icon: 'footprints',
        color: '#5cbf92',
        streak: 27,
      },
      {
        name: "Verres d'eau",
        icon: 'glass-water',
        color: '#4fb3d9',
        target: 8,
        streak: 5,
        todayCount: 5,
      },
      {
        name: 'Méditer',
        icon: 'flower-2',
        color: '#c27ad8',
        streak: 3,
      },
    ],
    meds: [
      {
        name: 'Vitamine D',
        dose: '1000 UI',
        color: '#d9a441',
        intervalHours: 24,
        lastTakenHoursAgo: 24,
        stock: 24,
      },
      {
        name: 'Oméga 3',
        dose: '1 gélule',
        color: '#4fb3d9',
        intervalHours: 12,
        lastTakenHoursAgo: 3,
      },
    ],
    presets: [
      {
        label: 'Thé',
        minutes: 4,
        color: '#5cbf92',
        soundId: 'soft',
      },
      {
        label: 'Four',
        minutes: 25,
        color: '#e06a5a',
        soundId: 'bell',
      },
      {
        label: 'Sieste',
        minutes: 20,
        color: '#8b8ce8',
        soundId: 'soft',
      },
      {
        label: 'Lessive',
        minutes: 45,
        color: '#4fb3d9',
        soundId: 'classic',
      },
      {
        label: 'Étirements',
        minutes: 50,
        color: '#d9a441',
        soundId: 'pulse',
      },
      {
        label: 'Pâtes',
        minutes: 9,
        color: '#c27ad8',
        soundId: 'digital',
      },
    ],
    secrets: [
      {
        kind: 'login',
        title: 'Banque',
        favorite: true,
        fields: {
          username: 'lucie.r',
          password: 'Cuivre*Nuage*88',
        },
      },
      {
        kind: 'login',
        title: 'Mail perso',
        fields: {
          username: 'lucie@example.com',
          password: 'Maree-Lente-27!',
          url: 'https://mail.example.com',
        },
      },
      {
        kind: 'wifi',
        title: 'Wi-Fi maison',
        fields: {
          network: 'Maison_5G',
          password: 'tournesols-a-la-fenetre',
        },
      },
      {
        kind: 'card',
        title: 'Carte bancaire',
        fields: {
          cardholder: 'Lucie Robert',
          number: '4000 1234 5678 9010',
          expiry: '09/29',
          cvv: '123',
        },
      },
      {
        kind: 'note',
        title: 'Codes de secours',
        fields: {
          text: '1842-7731\n5520-0917\n3365-4402',
        },
      },
    ],
  },
}
