/**
 * Arabic trailer: on-screen text and the demo data the app is filled with.
 * Same shape as en.mjs; see there for what each field is for.
 */
export default {
  browserLocale: 'ar',
  dir: 'rtl',
  cards: {
    intro: {
      headline: 'يومك كله، في مكان واحد.',
      features: ['الملاحظات', 'المؤقتات', 'العادات', 'الأدوية', 'كلمات المرور'],
    },
    localFirst: {
      statements: ['بلا حساب.', 'بلا خادم.', 'يعمل دون اتصال.'],
      kicker: 'بياناتك تبقى على جهازك.',
      platforms: ['Web', 'Windows', 'macOS', 'Linux', 'Android'],
    },
    outro: {
      tagline: 'مجاني ومفتوح المصدر.',
      url: 'noter.lukadevv.com',
      store: 'متوفر على Microsoft Store',
    },
  },
  captions: {
    home: 'يومك كله بنظرة واحدة',
    notes: 'ملاحظات بكتل وروابط ووسوم',
    timers: 'منبهات وبومودورو',
    vault: 'خزنة مشفّرة ومجلدات مقفلة',
  },
  typing: {
    title: 'إطلاق v1.2',
    tasks: ['لقطات المتجر', 'تسجيل العرض الترويجي'],
    see: 'انظر',
    link: 'أفكار تسويقية',
    tag: 'إطلاق',
    linkTyped: 'أفكار',
  },
  demo: {
    folderPassphrase: 'samaa-maris-42',
    vaultPassword: 'thalath kalimat tawila',
    folders: [
      {
        key: 'work',
        name: 'العمل',
        icon: 'lucide:briefcase',
        color: '#4fb3d9',
      },
      {
        key: 'personal',
        name: 'شخصي',
        icon: 'lucide:house',
        color: '#5cbf92',
      },
      {
        key: 'reading',
        name: 'قراءة',
        icon: 'lucide:book-open',
        color: '#d9a441',
      },
      {
        key: 'journal',
        name: 'يوميات',
        icon: 'lucide:feather',
        color: '#c27ad8',
        encrypted: true,
      },
    ],
    notes: [
      {
        folder: 'work',
        title: 'إطلاق v1.2',
        hoursAgo: 0.3,
        body: 'مهام قبل الجمعة:',
      },
      {
        folder: 'work',
        title: 'أفكار تسويقية',
        hoursAgo: 3,
        body: '- فيديو قصير لمواقع التواصل\n- مقارنة مع تطبيقات أخرى\n- دليل الاختصارات #تسويق',
        pinned: true,
      },
      {
        folder: 'work',
        title: 'اجتماع التصميم',
        hoursAgo: 6,
        body: 'راجعنا الشريط الجانبي الجديد والأيقونات.\n\n- [x] لوحة الألوان\n- [ ] الوضع المضغوط #تصميم',
      },
      {
        folder: 'personal',
        title: 'قائمة المشتريات',
        hoursAgo: 20,
        body: '- [ ] قهوة\n- [ ] خبز أسمر\n- [x] فراولة\n- [ ] حليب الشوفان #المنزل',
      },
      {
        folder: 'reading',
        title: 'فن السكون',
        hoursAgo: 30,
        body: '> ألّا تذهب إلى أي مكان قد يكون مغامرة أيضًا.\n\nبيكو آير عن التمهّل. #كتب',
      },
      {
        folder: 'personal',
        title: 'رحلة إلى الساحل',
        hoursAgo: 52,
        body: 'الانطلاق يوم 14. حجز الكوخ وفحص السيارة. #سفر',
      },
      {
        folder: 'journal',
        title: 'الثلاثاء',
        hoursAgo: 26,
        body: 'خرجت للمشي باكرًا وأنهيت الفصل أخيرًا.',
      },
      {
        folder: 'journal',
        title: 'الاثنين',
        hoursAgo: 50,
        body: 'أسبوع جديد. شاشات أقل، كتب أكثر.',
      },
    ],
    habits: [
      {
        name: 'قراءة 20 دقيقة',
        icon: 'book-open',
        color: '#d9a441',
        streak: 12,
      },
      {
        name: 'المشي',
        icon: 'footprints',
        color: '#5cbf92',
        streak: 27,
      },
      {
        name: 'أكواب الماء',
        icon: 'glass-water',
        color: '#4fb3d9',
        target: 8,
        streak: 5,
        todayCount: 5,
      },
      {
        name: 'التأمل',
        icon: 'flower-2',
        color: '#c27ad8',
        streak: 3,
      },
    ],
    meds: [
      {
        name: 'فيتامين د',
        dose: '1000 وحدة',
        color: '#d9a441',
        intervalHours: 24,
        lastTakenHoursAgo: 24,
        stock: 24,
      },
      {
        name: 'أوميغا 3',
        dose: 'كبسولة واحدة',
        color: '#4fb3d9',
        intervalHours: 12,
        lastTakenHoursAgo: 3,
      },
    ],
    presets: [
      {
        label: 'شاي',
        minutes: 4,
        color: '#5cbf92',
        soundId: 'soft',
      },
      {
        label: 'الفرن',
        minutes: 25,
        color: '#e06a5a',
        soundId: 'bell',
      },
      {
        label: 'قيلولة',
        minutes: 20,
        color: '#8b8ce8',
        soundId: 'soft',
      },
      {
        label: 'الغسيل',
        minutes: 45,
        color: '#4fb3d9',
        soundId: 'classic',
      },
      {
        label: 'تمدد',
        minutes: 50,
        color: '#d9a441',
        soundId: 'pulse',
      },
      {
        label: 'معكرونة',
        minutes: 9,
        color: '#c27ad8',
        soundId: 'digital',
      },
    ],
    secrets: [
      {
        kind: 'login',
        title: 'البنك',
        favorite: true,
        fields: {
          username: 'layla.h',
          password: 'Nahas*Ghaym*88',
        },
      },
      {
        kind: 'login',
        title: 'البريد الشخصي',
        fields: {
          username: 'layla@example.com',
          password: 'Mad-Hadi-27!',
          url: 'https://mail.example.com',
        },
      },
      {
        kind: 'wifi',
        title: 'واي فاي المنزل',
        fields: {
          network: 'Home_5G',
          password: 'zahrat-alshams',
        },
      },
      {
        kind: 'card',
        title: 'بطاقة الخصم',
        fields: {
          cardholder: 'ليلى حسن',
          number: '4000 1234 5678 9010',
          expiry: '09/29',
          cvv: '123',
        },
      },
      {
        kind: 'note',
        title: 'رموز الاحتياط',
        fields: {
          text: '1842-7731\n5520-0917\n3365-4402',
        },
      },
    ],
  },
}
