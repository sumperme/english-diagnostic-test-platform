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

export const CEFR_BANDS: CefrBand[] = [
  {
    min: 0,
    max: 25,
    cefr: 'B1',
    label: 'Pre-Intermediate',
    ielts: '4.0 - 5.0',
    toefl: '31 - 57',
    headline: 'Foundational development required before university study',
    description: 'Your diagnostic results indicate B1-level proficiency. Significant English language development is required before pursuing university programmes delivered in English.',
    recommendation: 'We strongly recommend enrolling in a structured English language programme to consolidate your foundational skills in grammar, vocabulary, and academic reading.',
    colorCls: 'bg-rose-100 text-rose-800 border-rose-300',
  },
  {
    min: 26,
    max: 39,
    cefr: 'B2',
    label: 'Upper Intermediate',
    ielts: '5.5 - 6.5',
    toefl: '58 - 78',
    headline: 'Targeted preparation recommended before university entry',
    description: 'Your diagnostic results reflect B2-level English proficiency. You have a reasonable foundation, though targeted language preparation is advisable before commencing university studies.',
    recommendation: 'Focus on intensive preparation in the language dimensions identified for improvement. Engage regularly with academic reading materials.',
    colorCls: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  {
    min: 40,
    max: 53,
    cefr: 'C1',
    label: 'Effective Operational Proficiency',
    ielts: '7.0 - 7.5',
    toefl: '79 - 95',
    headline: 'Academically ready for university study in English',
    description: 'Your results indicate C1-level competence. You demonstrate strong overall language control and are ready to engage with university-level academic content.',
    recommendation: 'Continued practice in the identified priority dimensions will further strengthen your academic performance. Seek opportunities to apply your language skills in formal academic writing.',
    colorCls: 'bg-sky-100 text-sky-800 border-sky-300',
  },
  {
    min: 54,
    max: 63,
    cefr: 'C1+',
    label: 'Strong C1 / Borderline C2',
    ielts: '7.5 - 8.0',
    toefl: '96 - 107',
    headline: 'Well-prepared for demanding academic programmes',
    description: 'Your performance demonstrates strong C1 proficiency approaching C2 mastery. You are well-prepared for the linguistic demands of university study.',
    recommendation: 'Refine nuanced grammar, reading, and vocabulary skills to achieve full C2 mastery. Engage with complex academic and professional texts.',
    colorCls: 'bg-teal-100 text-teal-800 border-teal-300',
  },
  {
    min: 64,
    max: 72,
    cefr: 'C2',
    label: 'Mastery',
    ielts: '8.0 - 9.0',
    toefl: '108 - 120',
    headline: 'Full academic and professional language readiness',
    description: 'Your diagnostic results demonstrate C2-level mastery. Your linguistic competence is fully suited for the most demanding academic and professional settings.',
    recommendation: 'Maintain your outstanding standard by engaging with advanced academic literature and professional discourse across diverse fields of knowledge.',
    colorCls: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
];
