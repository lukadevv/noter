/**
 * Korean trailer: on-screen text and the demo data the app is filled with.
 * Same shape as en.mjs; see there for what each field is for.
 */
export default {
  browserLocale: 'ko-KR',
  cards: {
    intro: {
      headline: '하루의 모든 것을, 한곳에서.',
      features: ['노트', '타이머', '습관', '복약', '비밀번호'],
    },
    localFirst: {
      statements: ['계정 없이.', '서버 없이.', '오프라인에서도.'],
      kicker: '데이터는 내 기기에만 남습니다.',
      platforms: ['Web', 'Windows', 'macOS', 'Linux', 'Android'],
    },
    outro: {
      tagline: '무료, 오픈 소스.',
      url: 'noter.lukadevv.com',
      store: 'Microsoft Store에서 만나보세요',
    },
  },
  captions: {
    home: '하루를 한눈에',
    notes: '블록, 링크, 태그로 쓰는 노트',
    timers: '알람과 뽀모도로',
    vault: '암호화된 보관함과 잠긴 폴더',
  },
  typing: {
    title: '출시 v1.2',
    tasks: ['스토어 스크린샷', '트레일러 녹화'],
    see: '참고:',
    link: '마케팅 아이디어',
    tag: '출시',
    linkTyped: '마케팅',
  },
  demo: {
    folderPassphrase: 'bom-haneul-42',
    vaultPassword: 'se gae-ui gin daneo',
    folders: [
      {
        key: 'work',
        name: '업무',
        icon: 'lucide:briefcase',
        color: '#4fb3d9',
      },
      {
        key: 'personal',
        name: '개인',
        icon: 'lucide:house',
        color: '#5cbf92',
      },
      {
        key: 'reading',
        name: '독서',
        icon: 'lucide:book-open',
        color: '#d9a441',
      },
      {
        key: 'journal',
        name: '일기',
        icon: 'lucide:feather',
        color: '#c27ad8',
        encrypted: true,
      },
    ],
    notes: [
      {
        folder: 'work',
        title: '출시 v1.2',
        hoursAgo: 0.3,
        body: '금요일까지 할 일:',
      },
      {
        folder: 'work',
        title: '마케팅 아이디어',
        hoursAgo: 3,
        body: '- SNS용 짧은 영상\n- 다른 앱과 비교\n- 단축키 가이드 #마케팅',
        pinned: true,
      },
      {
        folder: 'work',
        title: '디자인 회의',
        hoursAgo: 6,
        body: '새 사이드바와 아이콘을 검토했어요.\n\n- [x] 색상 팔레트\n- [ ] 컴팩트 모드 #디자인',
      },
      {
        folder: 'personal',
        title: '장보기',
        hoursAgo: 20,
        body: '- [ ] 커피\n- [ ] 통밀빵\n- [x] 딸기\n- [ ] 귀리 우유 #집',
      },
      {
        folder: 'reading',
        title: '고요함의 기술',
        hoursAgo: 30,
        body: '> 아무 데도 가지 않는 것도 모험이 될 수 있다.\n\n피코 아이어, 느리게 사는 법에 대해. #책',
      },
      {
        folder: 'personal',
        title: '바닷가 여행',
        hoursAgo: 52,
        body: '14일 출발. 오두막 예약하고 차 점검하기. #여행',
      },
      {
        folder: 'journal',
        title: '화요일',
        hoursAgo: 26,
        body: '아침 일찍 산책하고 드디어 한 장을 끝냈다.',
      },
      {
        folder: 'journal',
        title: '월요일',
        hoursAgo: 50,
        body: '새로운 한 주. 화면은 덜, 책은 더.',
      },
    ],
    habits: [
      {
        name: '20분 독서',
        icon: 'book-open',
        color: '#d9a441',
        streak: 12,
      },
      {
        name: '산책',
        icon: 'footprints',
        color: '#5cbf92',
        streak: 27,
      },
      {
        name: '물 마시기(잔)',
        icon: 'glass-water',
        color: '#4fb3d9',
        target: 8,
        streak: 5,
        todayCount: 5,
      },
      {
        name: '명상',
        icon: 'flower-2',
        color: '#c27ad8',
        streak: 3,
      },
    ],
    meds: [
      {
        name: '비타민 D',
        dose: '1000 IU',
        color: '#d9a441',
        intervalHours: 24,
        lastTakenHoursAgo: 24,
        stock: 24,
      },
      {
        name: '오메가 3',
        dose: '1캡슐',
        color: '#4fb3d9',
        intervalHours: 12,
        lastTakenHoursAgo: 3,
      },
    ],
    presets: [
      {
        label: '차',
        minutes: 4,
        color: '#5cbf92',
        soundId: 'soft',
      },
      {
        label: '오븐',
        minutes: 25,
        color: '#e06a5a',
        soundId: 'bell',
      },
      {
        label: '낮잠',
        minutes: 20,
        color: '#8b8ce8',
        soundId: 'soft',
      },
      {
        label: '빨래',
        minutes: 45,
        color: '#4fb3d9',
        soundId: 'classic',
      },
      {
        label: '스트레칭',
        minutes: 50,
        color: '#d9a441',
        soundId: 'pulse',
      },
      {
        label: '파스타',
        minutes: 9,
        color: '#c27ad8',
        soundId: 'digital',
      },
    ],
    secrets: [
      {
        kind: 'login',
        title: '은행',
        favorite: true,
        fields: {
          username: 'jiwoo.k',
          password: 'Guri*Gureum*88',
        },
      },
      {
        kind: 'login',
        title: '개인 이메일',
        fields: {
          username: 'jiwoo@example.com',
          password: 'Joyonghan-Mulgyeol-27!',
          url: 'https://mail.example.com',
        },
      },
      {
        kind: 'wifi',
        title: '집 Wi-Fi',
        fields: {
          network: 'Home_5G',
          password: 'haebaragi-changga',
        },
      },
      {
        kind: 'card',
        title: '체크카드',
        fields: {
          cardholder: '김지우',
          number: '4000 1234 5678 9010',
          expiry: '09/29',
          cvv: '123',
        },
      },
      {
        kind: 'note',
        title: '백업 코드',
        fields: {
          text: '1842-7731\n5520-0917\n3365-4402',
        },
      },
    ],
  },
}
