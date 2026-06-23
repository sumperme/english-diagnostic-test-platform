export type CefrBand = {
  min: number;
  max: number;
  cefr: string;
  label: string;
  ielts: string;
  toefl: string;
  headline: string;
  description: string;
  recommendation: string;
  colorCls: string;
};

export const PROFICIENCY_DISCLAIMER =
  'These correspondences with CEFR, IELTS and TOEFL are approximate and provided for orientation only; they are not official conversions and should not be used as substitutes for the respective tests.';

export const CEFR_BANDS: CefrBand[] = [
  {
    min: 0,
    max: 26,
    cefr: '≤A2',
    label: 'Elementary / Pre-Intermediate',
    ielts: '≤ 3.5',
    toefl: '≤ 45',
    headline: 'Foundational English development is essential before university study',
    description:
      'Your diagnostic results indicate elementary to A2-level proficiency. Substantial English language development is required before pursuing university programmes delivered in English.',
    recommendation:
      'We strongly recommend enrolling in a structured English language programme to build core grammar, vocabulary, and reading skills before attempting advanced academic study.',
    colorCls: 'bg-rose-100 text-rose-800 border-rose-300',
  },
  {
    min: 27,
    max: 40,
    cefr: 'B1',
    label: 'Intermediate',
    ielts: '4.0 - 5.0',
    toefl: '42 - 71',
    headline: 'Continued foundation-building recommended before university entry',
    description:
      'Your diagnostic results reflect B1-level English proficiency. Further consolidation of grammar and vocabulary is needed before commencing university studies in English.',
    recommendation:
      'Focus on systematic review of grammar structures and vocabulary expansion. Engage with graded academic texts and seek targeted tuition in weak areas.',
    colorCls: 'bg-orange-100 text-orange-800 border-orange-300',
  },
  {
    min: 41,
    max: 56,
    cefr: 'B2',
    label: 'Upper Intermediate',
    ielts: '5.5 - 6.5',
    toefl: '72 - 94',
    headline: 'Targeted preparation recommended before university entry',
    description:
      'Your diagnostic results reflect B2-level English proficiency. You have a reasonable foundation, though targeted language preparation is advisable before commencing university studies.',
    recommendation:
      'Focus on intensive preparation in the grammar dimensions identified for improvement. Engage regularly with academic reading materials.',
    colorCls: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  {
    min: 57,
    max: 74,
    cefr: 'C1',
    label: 'Effective Operational Proficiency',
    ielts: '7.0 - 8.0',
    toefl: '95 - 114',
    headline: 'Academically ready for university study in English',
    description:
      'Your results indicate C1-level competence. You demonstrate strong overall language control and are ready to engage with university-level academic content.',
    recommendation:
      'Continued practice in the identified priority grammar dimensions will further strengthen your academic performance. Seek opportunities to apply your language skills in formal academic writing.',
    colorCls: 'bg-sky-100 text-sky-800 border-sky-300',
  },
  {
    min: 75,
    max: 90,
    cefr: 'C2',
    label: 'Mastery',
    ielts: '8.5 - 9.0',
    toefl: '115 - 120',
    headline: 'Full academic and professional language readiness',
    description:
      'Your diagnostic results demonstrate C2-level mastery. Your linguistic competence is fully suited for the most demanding academic and professional settings.',
    recommendation:
      'Maintain your outstanding standard by engaging with advanced academic literature and professional discourse across diverse fields of knowledge.',
    colorCls: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
];
