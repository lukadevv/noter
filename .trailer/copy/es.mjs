/**
 * Spanish trailer: on-screen text and the demo data the app is filled with.
 *
 * To add a language, copy this file to `<locale>.mjs` (the locale must be one
 * the app ships, see src/lib/i18n/locales) and translate every string. Keys
 * that the scenes use to find things on screen are marked below.
 */
export default {
  /** BCP 47 tag for the browser, which formats dates and numbers. */
  browserLocale: 'es-ES',

  cards: {
    intro: {
      // The last word takes the accent gradient.
      headline: 'Tu día entero, en un solo lugar.',
      // In this order: notes, timers, habits, medication, vault.
      features: ['Notas', 'Timers', 'Hábitos', 'Medicación', 'Contraseñas'],
    },
    localFirst: {
      statements: ['Sin cuenta.', 'Sin servidor.', 'Funciona offline.'],
      kicker: 'Tus datos se quedan en tu dispositivo.',
      platforms: ['Web', 'Windows', 'macOS', 'Linux', 'Android'],
    },
    outro: {
      tagline: 'Gratis y de código abierto.',
      url: 'noter.lukadevv.com',
      store: 'Disponible en Microsoft Store',
    },
  },

  /** Short lower-third captions over the app scenes. */
  captions: {
    home: 'Todo tu día, de un vistazo',
    notes: 'Notas con bloques, enlaces y etiquetas',
    timers: 'Alarmas y pomodoro',
    vault: 'Bóveda cifrada y carpetas con contraseña',
  },

  /** What the notes scene types, into the demo note titled `title`. */
  typing: {
    title: 'Lanzamiento v1.2',
    tasks: ['Capturas de la tienda', 'Grabar el trailer'],
    see: 'Basado en',
    // Must match the title of a demo note, so the [[ menu offers it.
    link: 'Ideas de marketing',
    tag: 'lanzamiento',
  },

  demo: {
    folderPassphrase: 'cielo-de-marzo-42',
    vaultPassword: 'tres palabras largas',
    folders: [
      { key: 'work', name: 'Trabajo', icon: 'lucide:briefcase', color: '#4fb3d9' },
      { key: 'personal', name: 'Personal', icon: 'lucide:house', color: '#5cbf92' },
      { key: 'reading', name: 'Lecturas', icon: 'lucide:book-open', color: '#d9a441' },
      { key: 'journal', name: 'Diario', icon: 'lucide:feather', color: '#c27ad8', encrypted: true },
    ],
    notes: [
      // The note the notes scene opens and writes in.
      { folder: 'work', title: 'Lanzamiento v1.2', hoursAgo: 0.3, body: 'Pendientes para el viernes:' },
      {
        folder: 'work',
        title: 'Ideas de marketing',
        pinned: true,
        hoursAgo: 3,
        body: '- Video corto para redes\n- Comparativa con otras apps\n- Guía de atajos #marketing',
      },
      {
        folder: 'work',
        title: 'Reunión con diseño',
        hoursAgo: 6,
        body: 'Revisamos la nueva barra lateral y los iconos.\n\n- [x] Paleta de colores\n- [ ] Modo compacto #diseño',
      },
      {
        folder: 'personal',
        title: 'Lista del súper',
        hoursAgo: 20,
        body: '- [ ] Café\n- [ ] Pan integral\n- [x] Frutillas\n- [ ] Yerba #casa',
      },
      {
        folder: 'reading',
        title: 'El arte de la quietud',
        hoursAgo: 30,
        body: '> Ir a ninguna parte también es un viaje.\n\nPico Iyer, sobre parar un rato. #libros',
      },
      {
        folder: 'personal',
        title: 'Viaje a Córdoba',
        hoursAgo: 52,
        body: 'Salida el 14. Reservar cabaña y revisar el auto. #viajes',
      },
      {
        folder: 'journal',
        title: 'Martes',
        hoursAgo: 26,
        body: 'Hoy salí a caminar temprano y por fin terminé el capítulo.',
      },
      {
        folder: 'journal',
        title: 'Lunes',
        hoursAgo: 50,
        body: 'Semana nueva. Menos pantallas, más libros.',
      },
    ],
    habits: [
      { name: 'Leer 20 minutos', icon: 'book-open', color: '#d9a441', streak: 12 },
      { name: 'Caminar', icon: 'footprints', color: '#5cbf92', streak: 27 },
      { name: 'Vasos de agua', icon: 'glass-water', color: '#4fb3d9', target: 8, streak: 5, todayCount: 5 },
      { name: 'Meditar', icon: 'flower-2', color: '#c27ad8', streak: 3 },
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
      { name: 'Omega 3', dose: '1 cápsula', color: '#4fb3d9', intervalHours: 12, lastTakenHoursAgo: 3 },
    ],
    presets: [
      { label: 'Té', minutes: 4, color: '#5cbf92', soundId: 'soft' },
      { label: 'Horno', minutes: 25, color: '#e06a5a', soundId: 'bell' },
      { label: 'Siesta', minutes: 20, color: '#8b8ce8', soundId: 'soft' },
      { label: 'Ropa', minutes: 45, color: '#4fb3d9', soundId: 'classic' },
      { label: 'Estirar', minutes: 50, color: '#d9a441', soundId: 'pulse' },
      { label: 'Pasta', minutes: 9, color: '#c27ad8', soundId: 'digital' },
    ],
    secrets: [
      {
        kind: 'login',
        title: 'Banco',
        favorite: true,
        fields: { username: 'lucia.r', password: 'Cobre*Nube*88' },
      },
      {
        kind: 'login',
        title: 'Correo personal',
        fields: {
          username: 'lucia@example.com',
          password: 'Marea-Lenta-27!',
          url: 'https://mail.example.com',
        },
      },
      {
        kind: 'wifi',
        title: 'Wi-Fi de casa',
        fields: { network: 'Casa_5G', password: 'girasoles-en-la-ventana' },
      },
      {
        kind: 'card',
        title: 'Tarjeta de débito',
        fields: { cardholder: 'Lucía Ramos', number: '4000 1234 5678 9010', expiry: '09/29', cvv: '123' },
      },
      { kind: 'note', title: 'Códigos de respaldo', fields: { text: '1842-7731\n5520-0917\n3365-4402' } },
    ],
  },
}
