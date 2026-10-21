// Report copy is English-only (Papers I–III). Both site locales reference these objects,
// so screens that read `t.report` with the visitor's locale still type-check.
// Paper I comments are not here: they come from feedback_items via the report payload.

export const REPORT_MESSAGES = {
  submitted: 'Test Submitted Successfully',
  autoSubmitted: 'Auto-Submitted (Time Expired)',
  title: 'Diagnostic Report',
  candidateInfo: 'Candidate Information',
  name: 'Name',
  candidateId: 'Candidate ID',
  date: 'Date',
  duration: 'Duration',
  userGroup: 'Study group',
  partA: 'Part A',
  partB: 'Part B',
  final: 'Final',
  overallScore: 'Overall Score',
  approxIelts: 'Approx. IELTS',
  approxToefl: 'Approx. TOEFL iBT',
  proficiencyDisclaimer:
    'These correspondences with CEFR, IELTS and TOEFL are approximate and provided for orientation only; they are not official conversions and should not be used as substitutes for the respective tests.',
  none: 'None',
  downloadPdf: 'Download Report (PDF)',
  downloading: 'Downloading…',
  pdfError: 'PDF download failed. Please try again.',
  pdfExpired:
    'Your test report is no longer available. Reports are retained on our servers for 24 hours after test completion. For future tests, please ensure you save a local copy for your records.',
  aiSectionTitle: 'AI Tutor Feedback',
  aiGenerate: 'Generate AI Feedback',
  aiGenerating: 'Generating…',
  aiTooltipOnce: 'One test allows one AI comment generation.',
  aiLoadingLines: [
    'Analysing your dimension profile…',
    'Consulting the CEFR level descriptors…',
    'Composing your personalised feedback…',
  ],
  aiFailed:
    'Our AI tutor is temporarily unavailable — your results are unaffected. Please try generating the feedback again in a moment.',
  aiDisclaimer: 'AI-generated feedback, for reference alongside your full report.',
  dimensionLabels: {
    complexTenses: 'Tenses & Time Expressions',
    modalsStance: 'Modal Verbs: Certainty, Possibility & Advice',
    adjectiveRelativeClauses: 'Adjective (Relative) Clauses',
    nounClausesNominalisation: 'Noun Clauses & Formal Academic Expressions',
    adverbialClausesConnectors: 'Linking Ideas & Sentence Relationships',
    conditionalsUnrealistic: 'Conditionals & Unreal Situations',
    reportedSpeech: 'Reported Speech',
    gerundsInfinitives: 'Gerunds & Infinitives',
    subjunctiveFormal: 'Formal Grammar & Official Language',
    inversionFronting: 'Inversion & Emphasis',
    participleReducedClauses: 'Participial Phrases & Reduced Clauses',
    dependentPrepositions: 'Prepositions & Common Word Combinations',
  },
  dimensionShorts: {
    complexTenses: 'Tenses',
    modalsStance: 'Modals',
    adjectiveRelativeClauses: 'Relative Cl.',
    nounClausesNominalisation: 'Noun Cl.',
    adverbialClausesConnectors: 'Linking',
    conditionalsUnrealistic: 'Conditionals',
    reportedSpeech: 'Reported',
    gerundsInfinitives: 'Ger./Inf.',
    subjunctiveFormal: 'Formal',
    inversionFronting: 'Inversion',
    participleReducedClauses: 'Participles',
    dependentPrepositions: 'Prepositions',
  },
  levelLabels: {
    needsWork: 'Needs work',
    developing: 'Developing',
    good: 'Good',
    strong: 'Strong',
    excellent: 'Excellent',
    foundation: 'Foundation',
    emerging: 'Emerging',
    approaching: 'Approaching',
    advanced: 'Advanced',
    proficient: 'Proficient',
  },
  paper1: {
    reportTitle: 'EDT English Diagnostic Report',
    subtitle: 'Paper I — Grammar & Vocabulary',
    candidateName: 'Candidate Name',
    date: 'Date',
    overallScore: 'Overall Score',
    cefrLevel: 'CEFR Level',
    estimatedIelts: 'Estimated IELTS',
    estimatedToefl: 'Estimated TOEFL iBT Score',
    partATitle: 'Part A Grammar',
    masteryProfile: 'Grammar Area Mastery Profile',
    partAPlacement: 'Part A Placement',
    partAScore: 'Part A Score',
    area: 'Area',
    priority: 'Priority',
    evaluationTitle: 'Detailed Diagnostic Evaluation',
    strengthsTitle: 'A. Identified Strengths',
    roadmapTitle: 'B. Actionable Growth Roadmap',
    areaOverview: 'Area Overview',
    grammarPoint: 'Grammar Point',
    scoreLabel: 'Score',
    concludingTitle: 'Moving Forward with Grammar',
    partBTitle: 'Part B Vocabulary',
    partBPlacement: 'Part B Placement',
    partBScore: 'Part B Score',
    cefrBreakdown: 'CEFR Breakdown',
    overallComments: 'Overall Comments',
    partBRoadmap: 'Actionable Growth Roadmap',
    cefrLevelPrefix: 'CEFR Level',
    upperRange: 'upper range',
    levelTitles: {
      B1: 'Level B1 (Everyday Vocabulary)',
      B2: 'Level B2 (Upper-Intermediate)',
      C1: 'Level C1 (Advanced Academic)',
      C2: 'Level C2 (Proficiency / Literary)',
    },
  },
};

/** Paper II / III report labels, spread into `test2` for both locales. */
export const TEST2_REPORT_MESSAGES = {
  reportSubtitle: 'English Diagnostic Test - Paper II Listening & Reading',
  partAListening: 'Listening',
  partBReading: 'Reading',
  overallBand: 'Overall CEFR Estimate',
  partBands: 'Skill-Level CEFR Estimates',
  partBandListening: 'Listening (Part A)',
  partBandReading: 'Reading (Part B)',
  difficultyTitle: 'Performance by Difficulty Band',
  difficultyNote:
    'Questions are tagged B2 or C1/C2 by design. Strong C1/C2 performance indicates readiness for demanding academic comprehension.',
  dimensionLabels: {
    listeningB2: 'Listening — B2 items',
    listeningC1C2: 'Listening — C1/C2 items',
    readingB2: 'Reading — B2 items',
    readingC1C2: 'Reading — C1/C2 items',
  },
  dimensionShorts: {
    listeningB2: 'Listening B2',
    listeningC1C2: 'Listening C1/C2',
    readingB2: 'Reading B2',
    readingC1C2: 'Reading C1/C2',
  },
  dimensionsRadarTitle: 'Dimension Profile (Listening & Reading)',
  bandNarratives: {
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
    c1: {
      headline: 'Academically ready for university study in English',
      recommendation:
        'Continue engaging with complex academic lectures and literature to consolidate C1-level comprehension.',
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
    c2: {
      headline: 'Full academic and professional comprehension readiness',
      recommendation:
        'Maintain your outstanding standard by engaging with advanced academic literature, lectures, and professional discourse.',
    },
  },
  pdfError: 'PDF download failed. Please try again.',
  paper3Report: {
    reportSubtitle: 'English Diagnostic Test - Paper III Speaking & Writing',
    partBandSpeaking: 'Speaking (Part A)',
    partBandWriting: 'Writing (Part B)',
    strengths: 'Strengths',
    improvements: 'Improvements',
    taskTitles: {
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
    bandNarratives: {
      b1b2: {
        headline: 'Developing speaking and writing at B1/B2',
        recommendation:
          'Practise sustained turns and organised paragraphs on familiar and abstract topics; expand range of grammar and vocabulary.',
      },
      c1: {
        headline: 'Strong C1 performance across speaking and writing',
        recommendation:
          'Continue refining precision, register, and extended argumentation for demanding academic and professional contexts.',
      },
      c2: {
        headline: 'Near-native C2 command of speaking and writing',
        recommendation:
          'Maintain excellence by engaging with sophisticated discourse and producing nuanced, well-structured responses under time pressure.',
      },
    },
  },
};
