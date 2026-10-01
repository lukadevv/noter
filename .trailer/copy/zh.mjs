/**
 * Chinese (Simplified) trailer: on-screen text and the demo data the app is filled with.
 * Same shape as en.mjs; see there for what each field is for.
 */
export default {
  browserLocale: 'zh-CN',
  cards: {
    intro: {
      headline: '你的一整天，尽在一处。',
      features: ['笔记', '计时器', '习惯', '用药', '密码'],
    },
    localFirst: {
      statements: ['无需账号。', '无需服务器。', '离线可用。'],
      kicker: '数据只保存在你的设备上。',
      platforms: ['Web', 'Windows', 'macOS', 'Linux', 'Android'],
    },
    outro: {
      tagline: '免费且开源。',
      url: 'noter.lukadevv.com',
      store: '已在 Microsoft Store 上架',
    },
  },
  captions: {
    home: '一眼看清你的一天',
    notes: '带区块、链接和标签的笔记',
    timers: '闹钟与番茄钟',
    vault: '加密保险库与加锁文件夹',
  },
  typing: {
    title: '发布 v1.2',
    tasks: ['商店截图', '录制预告片'],
    see: '参考：',
    link: '营销点子',
    tag: '发布',
    linkTyped: '营销',
  },
  demo: {
    folderPassphrase: 'qing-tian-42',
    vaultPassword: 'san ge chang ci',
    folders: [
      {
        key: 'work',
        name: '工作',
        icon: 'lucide:briefcase',
        color: '#4fb3d9',
      },
      {
        key: 'personal',
        name: '个人',
        icon: 'lucide:house',
        color: '#5cbf92',
      },
      {
        key: 'reading',
        name: '阅读',
        icon: 'lucide:book-open',
        color: '#d9a441',
      },
      {
        key: 'journal',
        name: '日记',
        icon: 'lucide:feather',
        color: '#c27ad8',
        encrypted: true,
      },
    ],
    notes: [
      {
        folder: 'work',
        title: '发布 v1.2',
        hoursAgo: 0.3,
        body: '周五前要做：',
      },
      {
        folder: 'work',
        title: '营销点子',
        hoursAgo: 3,
        body: '- 社交媒体短视频\n- 与其他应用的对比\n- 快捷键指南 #营销',
        pinned: true,
      },
      {
        folder: 'work',
        title: '设计同步会',
        hoursAgo: 6,
        body: '过了一遍新的侧边栏和图标。\n\n- [x] 配色方案\n- [ ] 紧凑模式 #设计',
      },
      {
        folder: 'personal',
        title: '购物清单',
        hoursAgo: 20,
        body: '- [ ] 咖啡\n- [ ] 全麦面包\n- [x] 草莓\n- [ ] 燕麦奶 #家',
      },
      {
        folder: 'reading',
        title: '静止的艺术',
        hoursAgo: 30,
        body: '> 哪儿也不去，也可以是一场冒险。\n\n皮科·耶尔谈慢下来。 #读书',
      },
      {
        folder: 'personal',
        title: '海边旅行',
        hoursAgo: 52,
        body: '14 号出发。订小木屋，检查车子。 #旅行',
      },
      {
        folder: 'journal',
        title: '星期二',
        hoursAgo: 26,
        body: '一早出门散步，终于写完了这一章。',
      },
      {
        folder: 'journal',
        title: '星期一',
        hoursAgo: 50,
        body: '新的一周。少看屏幕，多读书。',
      },
    ],
    habits: [
      {
        name: '阅读 20 分钟',
        icon: 'book-open',
        color: '#d9a441',
        streak: 12,
      },
      {
        name: '散步',
        icon: 'footprints',
        color: '#5cbf92',
        streak: 27,
      },
      {
        name: '喝水（杯）',
        icon: 'glass-water',
        color: '#4fb3d9',
        target: 8,
        streak: 5,
        todayCount: 5,
      },
      {
        name: '冥想',
        icon: 'flower-2',
        color: '#c27ad8',
        streak: 3,
      },
    ],
    meds: [
      {
        name: '维生素 D',
        dose: '1000 IU',
        color: '#d9a441',
        intervalHours: 24,
        lastTakenHoursAgo: 24,
        stock: 24,
      },
      {
        name: 'Omega 3 鱼油',
        dose: '1 粒',
        color: '#4fb3d9',
        intervalHours: 12,
        lastTakenHoursAgo: 3,
      },
    ],
    presets: [
      {
        label: '泡茶',
        minutes: 4,
        color: '#5cbf92',
        soundId: 'soft',
      },
      {
        label: '烤箱',
        minutes: 25,
        color: '#e06a5a',
        soundId: 'bell',
      },
      {
        label: '午睡',
        minutes: 20,
        color: '#8b8ce8',
        soundId: 'soft',
      },
      {
        label: '洗衣',
        minutes: 45,
        color: '#4fb3d9',
        soundId: 'classic',
      },
      {
        label: '拉伸',
        minutes: 50,
        color: '#d9a441',
        soundId: 'pulse',
      },
      {
        label: '煮面',
        minutes: 9,
        color: '#c27ad8',
        soundId: 'digital',
      },
    ],
    secrets: [
      {
        kind: 'login',
        title: '银行',
        favorite: true,
        fields: {
          username: 'xiaolin.w',
          password: 'Tong*Yun*88',
        },
      },
      {
        kind: 'login',
        title: '个人邮箱',
        fields: {
          username: 'xiaolin@example.com',
          password: 'Man-Chao-27!',
          url: 'https://mail.example.com',
        },
      },
      {
        kind: 'wifi',
        title: '家里的 Wi-Fi',
        fields: {
          network: 'Home_5G',
          password: 'xiangrikui-chuangbian',
        },
      },
      {
        kind: 'card',
        title: '借记卡',
        fields: {
          cardholder: '王小林',
          number: '4000 1234 5678 9010',
          expiry: '09/29',
          cvv: '123',
        },
      },
      {
        kind: 'note',
        title: '备用验证码',
        fields: {
          text: '1842-7731\n5520-0917\n3365-4402',
        },
      },
    ],
  },
}
