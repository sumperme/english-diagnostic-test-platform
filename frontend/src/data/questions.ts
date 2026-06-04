export type OptionKey = 'A' | 'B' | 'C' | 'D';

export type Question = {
  id: string;
  canonicalNumber: number;
  part: 'A' | 'B';
  text: string;
  opts: Array<{ k: OptionKey; t: string }>;
};

export const PART_A: Question[] = [
  { id: 'A1', canonicalNumber: 1, part: 'A', text: 'Everybody _____ by the terrible news yesterday.', opts: [{ k: 'A', t: 'was shocked' }, { k: 'B', t: 'shocked' }, { k: 'C', t: 'has shocked' }, { k: 'D', t: 'has been shocked' }] },
  { id: 'A2', canonicalNumber: 2, part: 'A', text: 'The accident _____ by bad road conditions.', opts: [{ k: 'A', t: 'caused' }, { k: 'B', t: 'has been caused' }, { k: 'C', t: 'has caused' }, { k: 'D', t: 'is caused' }] },
  { id: 'A3', canonicalNumber: 3, part: 'A', text: 'I _____ calm in the face of his ridiculous threats.', opts: [{ k: 'A', t: 'remained' }, { k: 'B', t: 'was remained' }, { k: 'C', t: 'has been remained' }, { k: 'D', t: 'had been remained' }] },
  { id: 'A4', canonicalNumber: 4, part: 'A', text: 'That is the disco _____ we had a fight a year ago.', opts: [{ k: 'A', t: 'where' }, { k: 'B', t: 'which' }, { k: 'C', t: 'that' }, { k: 'D', t: 'and' }] },
  { id: 'A5', canonicalNumber: 5, part: 'A', text: 'The lady _____ is crying lives above my apartment.', opts: [{ k: 'A', t: 'who has a baby' }, { k: 'B', t: "who's baby" }, { k: 'C', t: 'the baby of which' }, { k: 'D', t: 'whose baby' }] },
  { id: 'A6', canonicalNumber: 6, part: 'A', text: 'The music _____ received an award.', opts: [{ k: 'A', t: 'was composed' }, { k: 'B', t: 'which composed' }, { k: 'C', t: 'she composed' }, { k: 'D', t: 'had been composed' }] },
  { id: 'A7', canonicalNumber: 7, part: 'A', text: 'I _____ for three hours when she called.', opts: [{ k: 'A', t: 'will study' }, { k: 'B', t: 'studied' }, { k: 'C', t: 'had studied' }, { k: 'D', t: 'will have been studying' }] },
  { id: 'A8', canonicalNumber: 8, part: 'A', text: 'By the time the clock strikes five, we _____ for four long hours.', opts: [{ k: 'A', t: 'will have been waiting' }, { k: 'B', t: 'will wait' }, { k: 'C', t: 'wait' }, { k: 'D', t: 'have waited' }] },
  { id: 'A9', canonicalNumber: 9, part: 'A', text: '_____ I lost so much weight, my pants are loose.', opts: [{ k: 'A', t: 'Since' }, { k: 'B', t: 'Due to' }, { k: 'C', t: 'Despite' }, { k: 'D', t: 'Provided' }] },
  { id: 'A10', canonicalNumber: 10, part: 'A', text: 'Thomas looks _____ he had not slept for days.', opts: [{ k: 'A', t: 'as' }, { k: 'B', t: 'though' }, { k: 'C', t: 'if' }, { k: 'D', t: 'as though' }] },
  { id: 'A11', canonicalNumber: 11, part: 'A', text: 'Elsie set her alarm _____ she would not be late for class.', opts: [{ k: 'A', t: 'therefore' }, { k: 'B', t: 'so that' }, { k: 'C', t: 'as a result' }, { k: 'D', t: 'for' }] },
  { id: 'A12', canonicalNumber: 12, part: 'A', text: 'The decrease _____ profits is due to the bad market.', opts: [{ k: 'A', t: 'of' }, { k: 'B', t: 'in' }, { k: 'C', t: 'by' }, { k: 'D', t: 'from' }] },
  { id: 'A13', canonicalNumber: 13, part: 'A', text: 'I am _____ hungry that my stomach is growling.', opts: [{ k: 'A', t: 'as' }, { k: 'B', t: 'so' }, { k: 'C', t: 'very' }, { k: 'D', t: 'terribly' }] },
  { id: 'A14', canonicalNumber: 14, part: 'A', text: "He has very little experience. I don't think he would be capable _____ running such a large project.", opts: [{ k: 'A', t: 'of' }, { k: 'B', t: 'with' }, { k: 'C', t: 'in' }, { k: 'D', t: 'towards' }] },
  { id: 'A15', canonicalNumber: 15, part: 'A', text: 'The Mini-TV is very popular _____ our younger customers.', opts: [{ k: 'A', t: 'between' }, { k: 'B', t: 'with' }, { k: 'C', t: 'in' }, { k: 'D', t: 'against' }] },
  { id: 'A16', canonicalNumber: 16, part: 'A', text: 'If you _____ it with care, you would not have broken it.', opts: [{ k: 'A', t: 'had handled' }, { k: 'B', t: 'handled' }, { k: 'C', t: 'were handling' }, { k: 'D', t: 'would handle' }] },
  { id: 'A17', canonicalNumber: 17, part: 'A', text: 'George _____ that the company had recruited fifty more sales representatives.', opts: [{ k: 'A', t: 'wondered' }, { k: 'B', t: 'reported' }, { k: 'C', t: 'told' }, { k: 'D', t: 'called' }] },
  { id: 'A18', canonicalNumber: 18, part: 'A', text: 'Leslie asked Ryan how often _____ the piano.', opts: [{ k: 'A', t: 'did he practise' }, { k: 'B', t: 'does he practise' }, { k: 'C', t: 'he practised' }, { k: 'D', t: 'practising' }] },
  { id: 'A19', canonicalNumber: 19, part: 'A', text: 'You treat the matter lightly, _____ I myself was never more serious.', opts: [{ k: 'A', t: 'however' }, { k: 'B', t: 'when' }, { k: 'C', t: 'whereas' }, { k: 'D', t: 'nevertheless' }] },
  { id: 'A20', canonicalNumber: 20, part: 'A', text: 'The telephone _____ for three minutes before someone answered it.', opts: [{ k: 'A', t: 'rings' }, { k: 'B', t: 'has rung' }, { k: 'C', t: 'had rung' }, { k: 'D', t: 'has been ringing' }] },
  { id: 'A21', canonicalNumber: 21, part: 'A', text: 'He will take care of _____ it to you.', opts: [{ k: 'A', t: 'send' }, { k: 'B', t: 'sent' }, { k: 'C', t: 'sending' }, { k: 'D', t: 'being sent' }] },
  { id: 'A22', canonicalNumber: 22, part: 'A', text: 'If I _____ a car, I would drive you home.', opts: [{ k: 'A', t: 'have' }, { k: 'B', t: 'had' }, { k: 'C', t: 'had had' }, { k: 'D', t: 'am having' }] },
  { id: 'A23', canonicalNumber: 23, part: 'A', text: 'I can come as long as I _____ by 4pm.', opts: [{ k: 'A', t: 'leave' }, { k: 'B', t: 'will leave' }, { k: 'C', t: 'can leave' }, { k: 'D', t: 'may leave' }] },
  { id: 'A24', canonicalNumber: 24, part: 'A', text: 'She acknowledged _____ assistance.', opts: [{ k: 'A', t: 'to receive' }, { k: 'B', t: 'receiving' }, { k: 'C', t: 'to have received' }, { k: 'D', t: 'has received' }] },
  { id: 'A25', canonicalNumber: 25, part: 'A', text: 'The people next door are so noisy that I can hardly hear what _____.', opts: [{ k: 'A', t: 'are you saying' }, { k: 'B', t: 'that you are saying' }, { k: 'C', t: 'you are saying' }, { k: 'D', t: 'are saying by you' }] },
  { id: 'A26', canonicalNumber: 26, part: 'A', text: 'Can you imagine _____ ?', opts: [{ k: 'A', t: 'how cute Donna is' }, { k: 'B', t: 'how cute is Donna' }, { k: 'C', t: 'is Donna cute' }, { k: 'D', t: 'how Donna is cute' }] },
  { id: 'A27', canonicalNumber: 27, part: 'A', text: "Don't phone me this afternoon. I _____ a class.", opts: [{ k: 'A', t: 'teach' }, { k: 'B', t: 'am teaching' }, { k: 'C', t: 'will be teaching' }, { k: 'D', t: 'have been teaching' }] },
  { id: 'A28', canonicalNumber: 28, part: 'A', text: "You'd better take a taxi. _____, you'll arrive late.", opts: [{ k: 'A', t: 'Consequently' }, { k: 'B', t: 'Furthermore' }, { k: 'C', t: 'Otherwise' }, { k: 'D', t: 'Subsequently' }] },
  { id: 'A29', canonicalNumber: 29, part: 'A', text: "She can't tolerate _____.", opts: [{ k: 'A', t: 'wait' }, { k: 'B', t: 'to wait' }, { k: 'C', t: 'waiting' }, { k: 'D', t: 'being waited' }] },
  { id: 'A30', canonicalNumber: 30, part: 'A', text: 'Last week, my friend was hospitalised for depression, but we did not know where _____.', opts: [{ k: 'A', t: 'to stay' }, { k: 'B', t: 'she stayed' }, { k: 'C', t: 'her staying' }, { k: 'D', t: 'she would have stayed' }] },
  { id: 'A31', canonicalNumber: 31, part: 'A', text: 'The neighborhood is not very nice. I like the house, _____.', opts: [{ k: 'A', t: 'though' }, { k: 'B', t: 'although' }, { k: 'C', t: 'hence' }, { k: 'D', t: 'moreover' }] },
  { id: 'A32', canonicalNumber: 32, part: 'A', text: 'Tammy is extremely rich, _____ she is not snobbish.', opts: [{ k: 'A', t: 'but' }, { k: 'B', t: 'however' }, { k: 'C', t: 'and' }, { k: 'D', t: 'hence' }] },
  { id: 'A33', canonicalNumber: 33, part: 'A', text: "Emma's newest pair of eyeglasses _____ corrected her vision so well that this young lady clearly sees Gary sneering at her nerdy appearance.", opts: [{ k: 'A', t: 'have' }, { k: 'B', t: 'has' }, { k: 'C', t: 'had' }, { k: 'D', t: 'will have' }] },
  { id: 'A34', canonicalNumber: 34, part: 'A', text: "The class _____ about the solution to the stuffy condition of the room. Ten students want to open the window, but the others don't.", opts: [{ k: 'A', t: 'disagrees' }, { k: 'B', t: 'disagree' }, { k: 'C', t: 'disagreed' }, { k: 'D', t: 'will disagree' }] },
  { id: 'A35', canonicalNumber: 35, part: 'A', text: "Every bowl and dish _____ slipped out of Sammi's soapy hands and shattered on the hard tile of the kitchen floor.", opts: [{ k: 'A', t: 'has' }, { k: 'B', t: 'have' }, { k: 'C', t: 'will have' }, { k: 'D', t: 'had' }] },
  { id: 'A36', canonicalNumber: 36, part: 'A', text: 'She asked _____ Tammy had visited the team members staying in hospital.', opts: [{ k: 'A', t: 'did' }, { k: 'B', t: 'that' }, { k: 'C', t: 'where' }, { k: 'D', t: 'whether' }] },
];

export const PART_B: Question[] = [
  { id: 'B1', canonicalNumber: 37, part: 'B', text: "In a business meeting, it's important to maintain a _______ attitude toward feedback.", opts: [{ k: 'A', t: 'defensive' }, { k: 'B', t: 'receptive' }, { k: 'C', t: 'dismissive' }, { k: 'D', t: 'hostile' }] },
  { id: 'B2', canonicalNumber: 38, part: 'B', text: 'The lecture was so _______ that many students fell asleep.', opts: [{ k: 'A', t: 'captivating' }, { k: 'B', t: 'tedious' }, { k: 'C', t: 'enlightening' }, { k: 'D', t: 'invigorating' }] },
  { id: 'B3', canonicalNumber: 39, part: 'B', text: 'Despite her initial fears, she was able to _______ her anxiety and give the presentation confidently.', opts: [{ k: 'A', t: 'suppress' }, { k: 'B', t: 'escalate' }, { k: 'C', t: 'amplify' }, { k: 'D', t: 'authenticate' }] },
  { id: 'B4', canonicalNumber: 40, part: 'B', text: 'He tends to _______ personal anecdotes into his presentations, making them more relatable.', opts: [{ k: 'A', t: 'fabricate' }, { k: 'B', t: 'integrate' }, { k: 'C', t: 'eliminate' }, { k: 'D', t: 'segregate' }] },
  { id: 'B5', canonicalNumber: 41, part: 'B', text: 'The new policy aims to _______ the existing gaps in our research methods.', opts: [{ k: 'A', t: 'perpetuate' }, { k: 'B', t: 'obscure' }, { k: 'C', t: 'bridge' }, { k: 'D', t: 'exacerbate' }] },
  { id: 'B6', canonicalNumber: 42, part: 'B', text: 'Her ability to _______ complex theories into simpler terms is commendable.', opts: [{ k: 'A', t: 'convolute' }, { k: 'B', t: 'correlate' }, { k: 'C', t: 'extrapolate' }, { k: 'D', t: 'translate' }] },
  { id: 'B7', canonicalNumber: 43, part: 'B', text: "The author's arguments were well-_______ and supported by extensive research.", opts: [{ k: 'A', t: 'justified' }, { k: 'B', t: 'articulated' }, { k: 'C', t: 'clarified' }, { k: 'D', t: 'defined' }] },
  { id: 'B8', canonicalNumber: 44, part: 'B', text: 'To improve teamwork, it is essential to cultivate a _______ environment.', opts: [{ k: 'A', t: 'competitive' }, { k: 'B', t: 'collaborative' }, { k: 'C', t: 'isolated' }, { k: 'D', t: 'confrontational' }] },
  { id: 'B9', canonicalNumber: 45, part: 'B', text: 'The manager was _______ about the necessity of meeting deadlines.', opts: [{ k: 'A', t: 'ambiguous' }, { k: 'B', t: 'adamant' }, { k: 'C', t: 'indifferent' }, { k: 'D', t: 'hesitant' }] },
  { id: 'B10', canonicalNumber: 46, part: 'B', text: "There is a growing _______ for renewable energy sources in today's society.", opts: [{ k: 'A', t: 'apathy' }, { k: 'B', t: 'demand' }, { k: 'C', t: 'decline' }, { k: 'D', t: 'contempt' }] },
  { id: 'B11', canonicalNumber: 47, part: 'B', text: "The scientist's findings were met with _______ from the research community due to their groundbreaking nature.", opts: [{ k: 'A', t: 'skepticism' }, { k: 'B', t: 'enthusiasm' }, { k: 'C', t: 'resignation' }, { k: 'D', t: 'indifference' }] },
  { id: 'B12', canonicalNumber: 48, part: 'B', text: 'She has a _______ grasp of multiple languages, which benefits her career.', opts: [{ k: 'A', t: 'superficial' }, { k: 'B', t: 'profound' }, { k: 'C', t: 'limited' }, { k: 'D', t: 'marginal' }] },
  { id: 'B13', canonicalNumber: 49, part: 'B', text: "The project's success can be attributed to the team's _______ efforts.", opts: [{ k: 'A', t: 'lackadaisical' }, { k: 'B', t: 'fragmented' }, { k: 'C', t: 'concerted' }, { k: 'D', t: 'sporadic' }] },
  { id: 'B14', canonicalNumber: 50, part: 'B', text: 'In her presentation, she was able to clearly _______ the main challenges facing the industry.', opts: [{ k: 'A', t: 'obscure' }, { k: 'B', t: 'delineate' }, { k: 'C', t: 'convolute' }, { k: 'D', t: 'misrepresent' }] },
  { id: 'B15', canonicalNumber: 51, part: 'B', text: 'He has a _______ tendency to procrastinate, which affects his work performance.', opts: [{ k: 'A', t: 'commendable' }, { k: 'B', t: 'chronic' }, { k: 'C', t: 'sporadic' }, { k: 'D', t: 'temperate' }] },
  { id: 'B16', canonicalNumber: 52, part: 'B', text: 'Understanding cultural differences is _______ in global business today.', opts: [{ k: 'A', t: 'irrelevant' }, { k: 'B', t: 'peripheral' }, { k: 'C', t: 'fundamental' }, { k: 'D', t: 'tedious' }] },
  { id: 'B17', canonicalNumber: 53, part: 'B', text: 'The reforms aim to _______ inequalities in educational access.', opts: [{ k: 'A', t: 'entrench' }, { k: 'B', t: 'alleviate' }, { k: 'C', t: 'amplify' }, { k: 'D', t: 'complicate' }] },
  { id: 'B18', canonicalNumber: 54, part: 'B', text: "The team's morale was _______ after receiving positive feedback from the client.", opts: [{ k: 'A', t: 'diminished' }, { k: 'B', t: 'boosted' }, { k: 'C', t: 'neutral' }, { k: 'D', t: 'undermined' }] },
  { id: 'B19', canonicalNumber: 55, part: 'B', text: "The committee's decision was met with _______ from various stakeholders.", opts: [{ k: 'A', t: 'acclaim' }, { k: 'B', t: 'derision' }, { k: 'C', t: 'approval' }, { k: 'D', t: 'apathy' }] },
  { id: 'B20', canonicalNumber: 56, part: 'B', text: 'Her ability to pivot quickly in discussions showcased her _______ thinking.', opts: [{ k: 'A', t: 'rigid' }, { k: 'B', t: 'innovative' }, { k: 'C', t: 'superficial' }, { k: 'D', t: 'stagnant' }] },
  { id: 'B21', canonicalNumber: 57, part: 'B', text: 'The author employs _______ to illustrate complex emotions throughout the narrative.', opts: [{ k: 'A', t: 'hyperbole' }, { k: 'B', t: 'ambiguity' }, { k: 'C', t: 'satire' }, { k: 'D', t: 'allegory' }] },
  { id: 'B22', canonicalNumber: 58, part: 'B', text: 'Despite the overwhelming evidence, his claims remain _______.', opts: [{ k: 'A', t: 'unsubstantiated' }, { k: 'B', t: 'incontrovertible' }, { k: 'C', t: 'evident' }, { k: 'D', t: 'reliable' }] },
  { id: 'B23', canonicalNumber: 59, part: 'B', text: 'The treaty was inherently _______, as it was based on trust between nations.', opts: [{ k: 'A', t: 'fragile' }, { k: 'B', t: 'robust' }, { k: 'C', t: 'inflexible' }, { k: 'D', t: 'deterministic' }] },
  { id: 'B24', canonicalNumber: 60, part: 'B', text: 'Her intention was to _______ the discussion, leading to more fruitful outcomes.', opts: [{ k: 'A', t: 'hinder' }, { k: 'B', t: 'obfuscate' }, { k: 'C', t: 'facilitate' }, { k: 'D', t: 'complicate' }] },
  { id: 'B25', canonicalNumber: 61, part: 'B', text: "The artist's work is often characterized as _______ for its bold colors and dynamic forms.", opts: [{ k: 'A', t: 'conventional' }, { k: 'B', t: 'avant-garde' }, { k: 'C', t: 'mundane' }, { k: 'D', t: 'derivative' }] },
  { id: 'B26', canonicalNumber: 62, part: 'B', text: 'The researchers aimed to _______ the potential impacts of climate change on marine life.', opts: [{ k: 'A', t: 'evaluate' }, { k: 'B', t: 'dismiss' }, { k: 'C', t: 'exaggerate' }, { k: 'D', t: 'impede' }] },
  { id: 'B27', canonicalNumber: 63, part: 'B', text: 'Finding a common ground can be a _______ task in negotiations.', opts: [{ k: 'A', t: 'straightforward' }, { k: 'B', t: 'arduous' }, { k: 'C', t: 'trivial' }, { k: 'D', t: 'effortless' }] },
  { id: 'B28', canonicalNumber: 64, part: 'B', text: 'The landscape was _______ with vibrant flowers, creating a picturesque view.', opts: [{ k: 'A', t: 'adorned' }, { k: 'B', t: 'barren' }, { k: 'C', t: 'desolate' }, { k: 'D', t: 'monotonous' }] },
  { id: 'B29', canonicalNumber: 65, part: 'B', text: 'In his speech, he made a _______ plea for action on climate change.', opts: [{ k: 'A', t: 'perfunctory' }, { k: 'B', t: 'compelling' }, { k: 'C', t: 'apathetic' }, { k: 'D', t: 'trivial' }] },
  { id: 'B30', canonicalNumber: 66, part: 'B', text: 'Her arguments were meticulously _______ and left no room for doubt.', opts: [{ k: 'A', t: 'constructed' }, { k: 'B', t: 'fragmented' }, { k: 'C', t: 'vacillating' }, { k: 'D', t: 'imprecise' }] },
  { id: 'B31', canonicalNumber: 67, part: 'B', text: 'The consequences of the decision were _______ and required careful consideration.', opts: [{ k: 'A', t: 'inconsequential' }, { k: 'B', t: 'far-reaching' }, { k: 'C', t: 'insignificant' }, { k: 'D', t: 'peripheral' }] },
  { id: 'B32', canonicalNumber: 68, part: 'B', text: 'To _______ the potential risks, thorough research is essential.', opts: [{ k: 'A', t: 'dismiss' }, { k: 'B', t: 'evaluate' }, { k: 'C', t: 'exaggerate' }, { k: 'D', t: 'mitigate' }] },
  { id: 'B33', canonicalNumber: 69, part: 'B', text: "The team's _______ approach to problem-solving led to innovative solutions.", opts: [{ k: 'A', t: 'stagnant' }, { k: 'B', t: 'conventional' }, { k: 'C', t: 'incremental' }, { k: 'D', t: 'multifaceted' }] },
  { id: 'B34', canonicalNumber: 70, part: 'B', text: 'The concept was so _______ that it took years for others to comprehend its implications.', opts: [{ k: 'A', t: 'elementary' }, { k: 'B', t: 'abstruse' }, { k: 'C', t: 'simplistic' }, { k: 'D', t: 'redundant' }] },
  { id: 'B35', canonicalNumber: 71, part: 'B', text: 'His analyses were often _______ and offered fresh insights into the field.', opts: [{ k: 'A', t: 'pedestrian' }, { k: 'B', t: 'superficial' }, { k: 'C', t: 'visionary' }, { k: 'D', t: 'narrow' }] },
  { id: 'B36', canonicalNumber: 72, part: 'B', text: 'The scientist faced scrutiny due to the _______ nature of the research findings.', opts: [{ k: 'A', t: 'ambiguous' }, { k: 'B', t: 'certain' }, { k: 'C', t: 'blatant' }, { k: 'D', t: 'explicit' }] },
];

export const ALL_QUESTIONS = [...PART_A, ...PART_B];

export const ANSWER_KEY: Record<string, OptionKey> = {
  A1: 'A', A2: 'B', A3: 'A', A4: 'A', A5: 'D', A6: 'C', A7: 'C', A8: 'A', A9: 'A',
  A10: 'D', A11: 'B', A12: 'B', A13: 'B', A14: 'A', A15: 'B', A16: 'A', A17: 'B',
  A18: 'C', A19: 'A', A20: 'C', A21: 'C', A22: 'B', A23: 'C', A24: 'B', A25: 'C',
  A26: 'A', A27: 'C', A28: 'C', A29: 'C', A30: 'B', A31: 'A', A32: 'A', A33: 'B',
  A34: 'B', A35: 'A', A36: 'D',
  B1: 'B', B2: 'B', B3: 'A', B4: 'B', B5: 'C', B6: 'D', B7: 'B', B8: 'B', B9: 'B',
  B10: 'B', B11: 'A', B12: 'B', B13: 'C', B14: 'B', B15: 'B', B16: 'C', B17: 'B',
  B18: 'B', B19: 'B', B20: 'B', B21: 'D', B22: 'A', B23: 'A', B24: 'C', B25: 'B',
  B26: 'A', B27: 'B', B28: 'A', B29: 'B', B30: 'A', B31: 'B', B32: 'D', B33: 'D',
  B34: 'B', B35: 'C', B36: 'A',
};
