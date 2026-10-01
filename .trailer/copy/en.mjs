/**
 * English trailer: on-screen text and the demo data the app is filled with.
 *
 * To add a language, copy this file to `<locale>.mjs` (the locale must be one
 * the app ships, see src/lib/i18n/locales) and translate every string. Keys
 * that the scenes use to find things on screen are marked below.
 */
export default {
  /** BCP 47 tag for the browser, which formats dates and numbers. */
  browserLocale: 'en-US',

  cards: {
    intro: {
      line: 'Your notes, timers, habits, medication and passwords.',
      sub: 'All in one place.',
    },
    localFirst: {
      line: 'No account. No server. Works offline.',
      platforms: ['Web', 'Windows', 'macOS', 'Linux', 'Android'],
    },
    outro: {
      url: 'noter.lukadevv.com',
      store: 'Available on the Microsoft Store',
    },
  },

  /** Short lower-third captions over the app scenes. */
  captions: {
    home: 'Your whole day at a glance',
    notes: 'Notes with blocks, links and tags',
    timers: 'Alarms and Pomodoro',
    vault: 'Encrypted vault and locked folders',
  },

  /** What the notes scene types, into the demo note titled `title`. */
  typing: {
    title: 'Launch v1.2',
    tasks: ['Store screenshots', 'Record the trailer'],
    see: 'See',
    // Must match the title of a demo note, so the [[ menu offers it.
    link: 'Marketing ideas',
    tag: 'launch',
  },

  demo: {
    folderPassphrase: 'march-sky-42',
    vaultPassword: 'three long words',
    folders: [
      { key: 'work', name: 'Work', icon: 'lucide:briefcase', color: '#4fb3d9' },
      { key: 'personal', name: 'Personal', icon: 'lucide:house', color: '#5cbf92' },
      { key: 'reading', name: 'Reading', icon: 'lucide:book-open', color: '#d9a441' },
      { key: 'journal', name: 'Journal', icon: 'lucide:feather', color: '#c27ad8', encrypted: true },
    ],
    notes: [
      // The note the notes scene opens and writes in.
      { folder: 'work', title: 'Launch v1.2', hoursAgo: 0.3, body: 'To do before Friday:' },
      {
        folder: 'work',
        title: 'Marketing ideas',
        pinned: true,
        hoursAgo: 3,
        body: '- Short video for socials\n- Comparison with other apps\n- Shortcut guide #marketing',
      },
      {
        folder: 'work',
        title: 'Design sync',
        hoursAgo: 6,
        body: 'Went over the new sidebar and icons.\n\n- [x] Colour palette\n- [ ] Compact mode #design',
      },
      {
        folder: 'personal',
        title: 'Groceries',
        hoursAgo: 20,
        body: '- [ ] Coffee\n- [ ] Wholegrain bread\n- [x] Strawberries\n- [ ] Oat milk #home',
      },
      {
        folder: 'reading',
        title: 'The Art of Stillness',
        hoursAgo: 30,
        body: '> Going nowhere can be an adventure too.\n\nPico Iyer, on slowing down. #books',
      },
      {
        folder: 'personal',
        title: 'Trip to the coast',
        hoursAgo: 52,
        body: 'Leaving on the 14th. Book the cabin, check the car. #travel',
      },
      {
        folder: 'journal',
        title: 'Tuesday',
        hoursAgo: 26,
        body: 'Went for an early walk and finally finished the chapter.',
      },
      {
        folder: 'journal',
        title: 'Monday',
        hoursAgo: 50,
        body: 'New week. Fewer screens, more books.',
      },
    ],
    habits: [
      { name: 'Read 20 minutes', icon: 'book-open', color: '#d9a441', streak: 12 },
      { name: 'Walk', icon: 'footprints', color: '#5cbf92', streak: 27 },
      {
        name: 'Glasses of water',
        icon: 'glass-water',
        color: '#4fb3d9',
        target: 8,
        streak: 5,
        todayCount: 5,
      },
      { name: 'Meditate', icon: 'flower-2', color: '#c27ad8', streak: 3 },
    ],
    meds: [
      {
        name: 'Vitamin D',
        dose: '1000 IU',
        color: '#d9a441',
        intervalHours: 24,
        lastTakenHoursAgo: 24,
        stock: 24,
      },
      { name: 'Omega 3', dose: '1 capsule', color: '#4fb3d9', intervalHours: 12, lastTakenHoursAgo: 3 },
    ],
    presets: [
      { label: 'Tea', minutes: 4, color: '#5cbf92', soundId: 'soft' },
      { label: 'Oven', minutes: 25, color: '#e06a5a', soundId: 'bell' },
      { label: 'Nap', minutes: 20, color: '#8b8ce8', soundId: 'soft' },
      { label: 'Laundry', minutes: 45, color: '#4fb3d9', soundId: 'classic' },
      { label: 'Stretch', minutes: 50, color: '#d9a441', soundId: 'pulse' },
      { label: 'Pasta', minutes: 9, color: '#c27ad8', soundId: 'digital' },
    ],
    secrets: [
      {
        kind: 'login',
        title: 'Personal email',
        favorite: true,
        fields: {
          username: 'lucy@example.com',
          password: 'Slow-Tide-27!',
          url: 'https://mail.example.com',
        },
      },
      { kind: 'login', title: 'Bank', fields: { username: 'lucy.r', password: 'Copper*Cloud*88' } },
      {
        kind: 'wifi',
        title: 'Home Wi-Fi',
        fields: { network: 'Home_5G', password: 'sunflowers-by-the-window' },
      },
      {
        kind: 'card',
        title: 'Debit card',
        fields: { cardholder: 'Lucy Rhodes', number: '4000 1234 5678 9010', expiry: '09/29', cvv: '123' },
      },
      { kind: 'note', title: 'Backup codes', fields: { text: '1842-7731\n5520-0917\n3365-4402' } },
    ],
  },
}
