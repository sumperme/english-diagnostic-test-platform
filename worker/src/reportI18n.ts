// PDF report strings (EN + zh-HK). Narratives are keyed by levelKey / bandKey —
// attempt_reports.variables stores keys only, never rendered text.

export type ReportLang = 'en' | 'zh-HK';

type BandNarrative = { headline: string; recommendation: string };

export type ReportStrings = {
  title: string;
  subtitle: Record<string, string>; // by testCode
  candidate: string;
  name: string;
  ref: string;
  userGroup: string;
  testDate: string;
  duration: string;
  minutes: string;
  autoSubmitted: string;
  overallScore: string;
  cefrBand: string;
  partScores: string;
  partLabel: string;
  partBands: string;
  approxIelts: string;
  approxToefl: string;
  dimensionProfile: string;
  dimension: string;
  score: string;
  level: string;
  weakDimensions: string;
  none: string;
  cohortTitle: string;
  percentile: string;
  cohortRank: string;
  cohortSize: string;
  groupPercentile: string;
  aiFeedbackTitle: string;
  aiFeedbackDisclaimer: string;
  answerReview: string;
  questionCode: string;
  yourAnswer: string;
  result: string;
  correct: string;
  incorrect: string;
  unanswered: string;
  strengths: string;
  improvements: string;
  yourAnswerMark: string;
  correctAnswerMark: string;
  generatedAt: string;
  page: string;
  disclaimer: string;
  levelLabels: Record<string, string>;
  bandNarratives: Record<string, BandNarrative>;
  /** Localized full names keyed by dimensions.key (Test 1 grammar + Test 2 difficulty). */
  dimensionLabels: Record<string, string>;
  /** Short radar-axis labels keyed by dimensions.key. */
  dimensionShorts: Record<string, string>;
  /** Test 1 Part B vocab band labels (canonical 61-75 / 76-90). */
  vocabCommon: string;
  vocabSpecialized: string;
  /** Localized part skills for review group headers, keyed by test_parts.skill. */
  skillLabels: Record<string, string>;
};

export const REPORT_STRINGS: Record<ReportLang, ReportStrings> = {
  en: {
    title: 'English Diagnostic Test — Score Report',
    subtitle: {
      '01': 'Paper I — Grammar & Vocabulary',
      '02': 'Paper II — Listening & Reading',
      '03': 'Paper III — Speaking & Writing',
    },
    candidate: 'Candidate',
    name: 'Name',
    ref: 'Candidate ID',
    userGroup: 'Group',
    testDate: 'Test date',
    duration: 'Duration',
    minutes: 'min',
    autoSubmitted: 'Auto-submitted at time limit',
    overallScore: 'Overall Score',
    cefrBand: 'CEFR Band',
    partScores: 'Part Scores',
    partLabel: 'Part',
    partBands: 'Part CEFR Bands',
    approxIelts: 'Approx. IELTS',
    approxToefl: 'Approx. TOEFL iBT',
    dimensionProfile: 'Dimension Profile',
    dimension: 'Dimension',
    score: 'Score',
    level: 'Level',
    weakDimensions: 'Priority dimensions',
    none: 'None',
    aiFeedbackTitle: 'AI Tutor Feedback',
    aiFeedbackDisclaimer: 'AI-generated feedback, for reference alongside the full report.',
    cohortTitle: 'Cohort Comparison',
    percentile: 'Percentile (all candidates)',
    cohortRank: 'Rank',
    cohortSize: 'Cohort size',
    groupPercentile: 'Percentile (your group)',
    answerReview: 'Answer Review',
    questionCode: 'Question Code',
    yourAnswer: 'Your Answer',
    result: 'Result',
    correct: 'Correct',
    incorrect: 'Incorrect',
    unanswered: 'Not answered',
    strengths: 'Strengths',
    improvements: 'Improvements',
    yourAnswerMark: 'Your answer',
    correctAnswerMark: 'Correct answer',
    generatedAt: 'Generated',
    page: 'Page',
    disclaimer:
      'These correspondences with CEFR, IELTS and TOEFL are approximate and provided for orientation only; they are not official conversions and should not be used as substitutes for the respective tests.',
    levelLabels: {
      needsWork: 'Needs work',
      developing: 'Developing',
      good: 'Good',
      strong: 'Strong',
      excellent: 'Excellent',
    },
    bandNarratives: {
      a2below: {
        headline: 'Foundational English development is essential before university study',
        recommendation:
          'We strongly recommend enrolling in a structured English language programme to build core grammar, vocabulary, and reading skills before attempting advanced academic study.',
      },
      b1: {
        headline: 'Continued foundation-building recommended before university entry',
        recommendation:
          'Focus on systematic review of grammar structures and vocabulary expansion. Engage with graded academic texts and seek targeted tuition in weak areas.',
      },
      b2: {
        headline: 'Targeted preparation recommended before university entry',
        recommendation:
          'Focus on intensive preparation in the grammar dimensions identified for improvement. Engage regularly with academic reading materials.',
      },
      c1: {
        headline: 'Academically ready for university study in English',
        recommendation:
          'Continued practice in the identified priority dimensions will further strengthen your academic performance.',
      },
      c2: {
        headline: 'Full academic and professional language readiness',
        recommendation:
          'Maintain your outstanding standard by engaging with advanced academic literature and professional discourse across diverse fields of knowledge.',
      },
      b1Plus: {
        headline: 'Foundational comprehension development is needed before university study',
        recommendation:
          'Build core listening and reading skills with graded materials and structured tuition before attempting advanced academic study.',
      },
      lowB2: {
        headline: 'Continued consolidation recommended before university entry',
        recommendation:
          'Strengthen comprehension of main ideas and specific details through regular exposure to authentic talks and texts.',
      },
      highB2LowC1: {
        headline: 'Approaching academic readiness — targeted preparation advised',
        recommendation:
          'Focus on inference, tone, speaker attitude, and nuanced meaning in extended texts and talks to secure C1-level comprehension.',
      },
      c1PlusNearC2: {
        headline: 'Strong academic readiness, approaching mastery',
        recommendation:
          'Refine sensitivity to register shifts, irony, and rhetorical intent across the most demanding materials.',
      },
      c1PlusC2: {
        headline: 'Full academic and professional comprehension readiness',
        recommendation:
          'Maintain your outstanding standard by engaging with advanced academic literature, lectures, and professional discourse.',
      },
      b1b2: {
        headline: 'Developing speaking and writing at B1/B2',
        recommendation:
          'Practise sustained turns and organised paragraphs on familiar and abstract topics; expand range of grammar and vocabulary.',
      },
    },
    dimensionLabels: {
      tenses: 'Tenses',
      adjectiveClauses: 'Adjective Clauses',
      nounClauses: 'Noun Clauses',
      adverbialClausesReasons: 'Adverbs/Adverbial Clauses I: Reasons, Purposes & Results',
      adverbialClausesMannerTimePlace: 'Adverbs/Adverbial Clauses II: Manners, Time & Place',
      adverbialClausesConcession: 'Adverbs/Adverbial Clauses III: Concession & Contrast',
      conditionals: 'Conditionals',
      activePassive: 'Active vs Passive',
      gerundsInfinitives: 'Gerunds & Infinitives',
      reportedSpeech: 'Reported Speech & Reported Questions',
      collocationsPrepositions: 'Collocations & Prepositions',
      subjectVerbAgreement: 'Subject-verb Agreement',
      listeningB2: 'Listening — B2 items',
      listeningC1C2: 'Listening — C1/C2 items',
      readingB2: 'Reading — B2 items',
      readingC1C2: 'Reading — C1/C2 items',
      describingExperience: 'Describing Personal Experience',
      futureScenario: 'Future Scenario and Speculation',
      explainingProcess: 'Explaining a Process',
      abstractConcept: 'Explaining an Abstract Concept',
      explainingOpinion: 'Explaining an Opinion or Decision',
      comparingOptions: 'Comparing and Evaluating Options',
      interpretingData: 'Interpreting Data or a Short Text',
      persuadingEvent: 'Persuading Others to Take Part in an Event',
      summaryResponse: 'Summary Response',
      argumentativeEssay: 'Argumentative Essay',
    },
    dimensionShorts: {
      tenses: 'Tenses',
      adjectiveClauses: 'Adj. Cl.',
      nounClauses: 'Noun Cl.',
      adverbialClausesReasons: 'Adv. Cl. I',
      adverbialClausesMannerTimePlace: 'Adv. Cl. II',
      adverbialClausesConcession: 'Adv. Cl. III',
      conditionals: 'Conditionals',
      activePassive: 'Act/Pass',
      gerundsInfinitives: 'Ger/Inf',
      reportedSpeech: 'Reported',
      collocationsPrepositions: 'Coll/Prep',
      subjectVerbAgreement: 'S-V Agr.',
      listeningB2: 'Listening B2',
      listeningC1C2: 'Listening C1/C2',
      readingB2: 'Reading B2',
      readingC1C2: 'Reading C1/C2',
      describingExperience: 'Experience',
      futureScenario: 'Future',
      explainingProcess: 'Process',
      abstractConcept: 'Abstract',
      explainingOpinion: 'Opinion',
      comparingOptions: 'Compare',
      interpretingData: 'Data',
      persuadingEvent: 'Persuade',
      summaryResponse: 'Summary',
      argumentativeEssay: 'Essay',
    },
    vocabCommon: 'Vocabulary (Common)',
    vocabSpecialized: 'Vocabulary (Specialized Terms)',
    skillLabels: {
      grammar: 'Applied Grammar',
      vocabulary: 'Vocabulary',
      listening: 'Listening',
      reading: 'Reading',
      speaking: 'Speaking',
      writing: 'Writing',
    },
  },
  'zh-HK': {
    title: '英語診斷測試 — 成績報告',
    subtitle: {
      '01': '卷一 — 語法及詞彙',
      '02': '卷二 — 聆聽及閱讀',
      '03': '卷三 — 說話及寫作',
    },
    candidate: '考生',
    name: '姓名',
    ref: '考生編號',
    userGroup: '組別',
    testDate: '測試日期',
    duration: '作答時間',
    minutes: '分鐘',
    autoSubmitted: '達時限自動提交',
    overallScore: '總分',
    cefrBand: 'CEFR 等級',
    partScores: '分部得分',
    partLabel: '分部',
    partBands: '分部 CEFR 等級',
    approxIelts: '參考 IELTS',
    approxToefl: '參考 TOEFL iBT',
    dimensionProfile: '維度分析',
    dimension: '維度',
    score: '得分',
    level: '等級',
    weakDimensions: '優先提升範疇',
    none: '無',
    aiFeedbackTitle: 'AI 導師評語',
    aiFeedbackDisclaimer: 'AI 產生的評語，僅供參考，請結合完整報告使用。',
    cohortTitle: '同儕比較',
    percentile: '百分位（全體考生）',
    cohortRank: '排名',
    cohortSize: '同儕人數',
    groupPercentile: '百分位（所屬組別）',
    answerReview: '作答回顧',
    questionCode: '題目編號',
    yourAnswer: '你的答案',
    result: '結果',
    correct: '正確',
    incorrect: '錯誤',
    unanswered: '未作答',
    strengths: '優點',
    improvements: '改進建議',
    yourAnswerMark: '你的答案',
    correctAnswerMark: '正確答案',
    generatedAt: '產生時間',
    page: '頁',
    disclaimer: 'CEFR、IELTS 及 TOEFL 的對應僅供參考，並非官方換算，不應取代相關考試的正式成績。',
    levelLabels: {
      needsWork: '需要改善',
      developing: '發展中',
      good: '良好',
      strong: '強',
      excellent: '優秀',
    },
    bandNarratives: {
      a2below: {
        headline: '升讀大學前必須先鞏固英語基礎',
        recommendation: '強烈建議修讀有系統的英語課程，先建立核心語法、詞彙及閱讀能力，再進行高階學術學習。',
      },
      b1: {
        headline: '建議在入讀大學前持續鞏固基礎',
        recommendation: '集中有系統地溫習語法結構並擴充詞彙，配合分級學術文章閱讀，並就弱項尋求針對性指導。',
      },
      b2: {
        headline: '建議在入讀大學前進行針對性準備',
        recommendation: '集中改善報告中識別的語法維度，並定期閱讀學術材料。',
      },
      c1: {
        headline: '已具備以英語修讀大學課程的學術準備',
        recommendation: '持續練習報告中識別的優先範疇，可進一步提升學術表現。',
      },
      c2: {
        headline: '已全面具備學術及專業語言能力',
        recommendation: '建議持續接觸進階學術文獻及跨領域專業討論，保持卓越水平。',
      },
      b1Plus: {
        headline: '升讀大學前需先建立基礎理解能力',
        recommendation: '建議使用分級教材及有系統的課程，先鞏固核心聆聽及閱讀能力，再進行高階學術學習。',
      },
      lowB2: {
        headline: '建議在入讀大學前持續鞏固',
        recommendation: '透過定期接觸真實講話及文章，加強掌握主旨及具體細節的能力。',
      },
      highB2LowC1: {
        headline: '接近學術準備水平 — 建議進行針對性訓練',
        recommendation: '集中訓練推論、語氣、說話者態度及長篇內容的細緻含意，以穩固 C1 水平的理解能力。',
      },
      c1PlusNearC2: {
        headline: '學術準備充足，接近精通水平',
        recommendation: '進一步提升對語域轉換、反諷及修辭意圖的敏感度，挑戰最高難度的材料。',
      },
      c1PlusC2: {
        headline: '已全面具備學術及專業理解能力',
        recommendation: '建議持續接觸進階學術文獻、講座及專業討論，保持卓越水平。',
      },
      b1b2: {
        headline: '說話及寫作處於 B1/B2 發展階段',
        recommendation: '多練習就熟悉及抽象主題作持續發言與有組織段落，並擴充語法與詞彙範圍。',
      },
    },
    dimensionLabels: {
      tenses: '時態',
      adjectiveClauses: '形容詞子句',
      nounClauses: '名詞子句',
      adverbialClausesReasons: '副詞／副詞子句一：原因、目的及結果',
      adverbialClausesMannerTimePlace: '副詞／副詞子句二：方式、時間及地點',
      adverbialClausesConcession: '副詞／副詞子句三：讓步及對比',
      conditionals: '條件句',
      activePassive: '主動與被動語態',
      gerundsInfinitives: '動名詞及不定詞',
      reportedSpeech: '轉述句及轉述問句',
      collocationsPrepositions: '搭配詞及介詞',
      subjectVerbAgreement: '主謂一致',
      listeningB2: '聆聽 — B2 題目',
      listeningC1C2: '聆聽 — C1/C2 題目',
      readingB2: '閱讀 — B2 題目',
      readingC1C2: '閱讀 — C1/C2 題目',
      describingExperience: '描述個人經歷',
      futureScenario: '未來情境與推測',
      explainingProcess: '解釋過程',
      abstractConcept: '解釋抽象概念',
      explainingOpinion: '解釋意見或決定',
      comparingOptions: '比較與評估選項',
      interpretingData: '詮釋數據或短文',
      persuadingEvent: '說服他人參與活動',
      summaryResponse: '撮要回應',
      argumentativeEssay: '議論文章',
    },
    dimensionShorts: {
      tenses: '時態',
      adjectiveClauses: '形容詞子句',
      nounClauses: '名詞子句',
      adverbialClausesReasons: '副詞子句一',
      adverbialClausesMannerTimePlace: '副詞子句二',
      adverbialClausesConcession: '副詞子句三',
      conditionals: '條件句',
      activePassive: '主動/被動',
      gerundsInfinitives: '動名詞/不定詞',
      reportedSpeech: '轉述句',
      collocationsPrepositions: '搭配詞/介詞',
      subjectVerbAgreement: '主謂一致',
      listeningB2: '聆聽 B2',
      listeningC1C2: '聆聽 C1/C2',
      readingB2: '閱讀 B2',
      readingC1C2: '閱讀 C1/C2',
      describingExperience: '經歷',
      futureScenario: '未來',
      explainingProcess: '過程',
      abstractConcept: '抽象',
      explainingOpinion: '意見',
      comparingOptions: '比較',
      interpretingData: '數據',
      persuadingEvent: '說服',
      summaryResponse: '撮要',
      argumentativeEssay: '議論',
    },
    vocabCommon: '詞彙（常用）',
    vocabSpecialized: '詞彙（專門術語）',
    skillLabels: {
      grammar: '應用語法',
      vocabulary: '詞彙',
      listening: '聆聽',
      reading: '閱讀',
      speaking: '說話',
      writing: '寫作',
    },
  },
};
