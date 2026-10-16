// PDF report strings (English only). Narratives are keyed by levelKey / bandKey —
// attempt_reports.variables stores keys only, never rendered text. Paper I comments come
// from feedback_items; only labels and section headings live here.

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
  approxIelts: string;
  approxToefl: string;
  dimensionProfile: string;
  dimension: string;
  score: string;
  level: string;
  weakDimensions: string;
  none: string;
  aiFeedbackTitle: string;
  aiFeedbackDisclaimer: string;
  generatedAt: string;
  page: string;
  disclaimer: string;
  levelLabels: Record<string, string>;
  bandNarratives: Record<string, BandNarrative>;
  /** Full names keyed by dimensions.key (Paper I grammar areas, Paper II difficulty, Paper III tasks). */
  dimensionLabels: Record<string, string>;
  /** Short radar-axis labels keyed by dimensions.key. */
  dimensionShorts: Record<string, string>;
  /** Part skills keyed by test_parts.skill. */
  skillLabels: Record<string, string>;
  paper1: Paper1Strings;
};

export type Paper1Strings = {
  reportTitle: string;
  candidateName: string;
  date: string;
  overallScore: string;
  cefrLevel: string;
  estimatedIelts: string;
  estimatedToefl: string;
  partATitle: string;
  masteryProfile: string;
  partAPlacement: string;
  partAScore: string;
  area: string;
  priority: string;
  evaluationTitle: string;
  strengthsTitle: string;
  roadmapTitle: string;
  areaOverview: string;
  grammarPoint: string;
  scoreLabel: string;
  concludingTitle: string;
  partBTitle: string;
  partBPlacement: string;
  partBScore: string;
  cefrBreakdown: string;
  overallComments: string;
  partBRoadmap: string;
  cefrLevelPrefix: string;
  upperRange: string;
  levelTitles: Record<string, string>;
};

export const REPORT_STRINGS: ReportStrings = {
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
    foundation: 'Foundation',
    emerging: 'Emerging',
    approaching: 'Approaching',
    advanced: 'Advanced',
    proficient: 'Proficient',
  },
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
        'Continued practice in the identified priority dimensions will further strengthen your academic performance.',
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
      headline: 'Full academic and professional language readiness',
      recommendation:
        'Maintain your outstanding standard by engaging with advanced academic literature and professional discourse across diverse fields of knowledge.',
    },
    b1b2: {
      headline: 'Developing speaking and writing at B1/B2',
      recommendation:
        'Practise sustained turns and organised paragraphs on familiar and abstract topics; expand range of grammar and vocabulary.',
    },
  },
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
  skillLabels: {
    grammar: 'Grammar',
    vocabulary: 'Vocabulary',
    listening: 'Listening',
    reading: 'Reading',
    speaking: 'Speaking',
    writing: 'Writing',
  },
  paper1: {
    reportTitle: 'EDT English Diagnostic Report',
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

/** "B2+ (Upper Intermediate, upper range)", "C1 (Advanced)", "A2 or below (Foundation)". */
export function formatPaper1Level(band: { cefrLabel: string; levelLabel: string }): string {
  if (!band.levelLabel) return band.cefrLabel;
  const suffix = band.cefrLabel.endsWith('+') ? `, ${REPORT_STRINGS.paper1.upperRange}` : '';
  return `${band.cefrLabel} (${band.levelLabel}${suffix})`;
}
