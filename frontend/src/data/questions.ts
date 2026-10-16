export type OptionKey = 'A' | 'B' | 'C' | 'D';

export type Question = {
  id: string;
  canonicalNumber: number;
  part: 'A' | 'B';
  text: string;
  opts: Array<{ k: OptionKey; t: string }>;
};
