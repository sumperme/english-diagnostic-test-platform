// Paper III (Speaking & Writing) content for seed generation.
// Source: Client_Feedback/Paper3_Ver5/

export const TEST3 = {
  name: 'Paper III — Speaking & Writing',
  description:
    'Diagnose speaking and writing competence at CEFR C1/C2. Part A: eight speaking tasks with prompt audio and one-shot recording. Part B: summary/response and argumentative essay (40 minutes).',
  timeLimitSeconds: 3600,
};

/** @type {Array<{ n: number; key: string; name: string; short: string; skill: string; maxSeconds: number; prepSeconds: number; hasAudio: boolean; overlay?: object; prompt: string; instructions: string }>} */
export const SPEAKING = [
  {
    n: 1,
    key: 'describingExperience',
    name: 'Describing Personal Experience with Reason',
    short: 'Experience',
    skill: 'Describing Personal Experience with Reason',
    maxSeconds: 60,
    prepSeconds: 0,
    hasAudio: true,
    prompt:
      "Click the play button below. You will hear a Human Resources Officer ask you a question. Immediately after the question finishes, the recording of your response will start automatically.\n\nYou may speak for up to 1 minute.",
    instructions: 'Listen once, then speak for up to 1 minute. Recording starts automatically when the audio ends.',
  },
  {
    n: 2,
    key: 'futureScenario',
    name: 'Describing Future Scenario and Speculation',
    short: 'Future',
    skill: 'Describing Future Scenario and Speculation',
    maxSeconds: 60,
    prepSeconds: 0,
    hasAudio: true,
    prompt:
      'Click the play button below. You will hear a teacher ask you to share your view about the future. Immediately after the speech finishes, the recording of your response will start automatically.\n\nYou may speak for up to 1 minute.',
    instructions: 'Listen once, then speak for up to 1 minute.',
  },
  {
    n: 3,
    key: 'explainingProcess',
    name: 'Explaining a Process',
    short: 'Process',
    skill: 'Explaining a Process',
    maxSeconds: 60,
    prepSeconds: 0,
    hasAudio: true,
    prompt:
      'Click the play button below. You will hear a teacher ask you to share your experience. Immediately after the speech finishes, the recording of your response will start automatically.\n\nYou may speak for up to 1 minute.',
    instructions: 'Listen once, then speak for up to 1 minute.',
  },
  {
    n: 4,
    key: 'abstractConcept',
    name: 'Explaining an Abstract Concept',
    short: 'Abstract',
    skill: 'Explaining an Abstract Concept',
    maxSeconds: 60,
    prepSeconds: 0,
    hasAudio: true,
    prompt:
      'Click the play button below. You will hear a teacher ask you to share your view about an abstract idea. Immediately after the speech finishes, the recording of your response will start automatically.\n\nYou may speak for up to 1 minute.',
    instructions: 'Listen once, then speak for up to 1 minute.',
  },
  {
    n: 5,
    key: 'explainingOpinion',
    name: 'Explaining an Opinion or a Decision',
    short: 'Opinion',
    skill: 'Explaining an Opinion or a Decision',
    maxSeconds: 60,
    prepSeconds: 0,
    hasAudio: true,
    prompt:
      'Click the play button below. You will hear a friend talk about her view about social media. Immediately after the speech finishes, the recording of your response will start automatically.\n\nYou may speak for up to 1 minute.',
    instructions: 'Listen once, then speak for up to 1 minute.',
  },
  {
    n: 6,
    key: 'comparingOptions',
    name: 'Comparing and Evaluating Options',
    short: 'Compare',
    skill: 'Comparing and Evaluating Options',
    maxSeconds: 60,
    prepSeconds: 0,
    hasAudio: true,
    overlay: {
      type: 'list',
      items: [
        'More public transport lines',
        'Higher parking fees in busy areas',
        'More bicycle lanes and pedestrian zones',
        'Encouraging car-sharing or limiting car numbers in the city centre',
      ],
    },
    prompt:
      'Click the play button below. You will hear a teacher ask you to compare some options and share your view. Immediately after the speech finishes, the recording of your response will start automatically.\n\nYou may speak for up to 1 minute.',
    instructions: 'Listen once (options appear on screen), then speak for up to 1 minute.',
  },
  {
    n: 7,
    key: 'interpretingData',
    name: 'Interpreting Data or a Short Text',
    short: 'Data',
    skill: 'Interpreting Data or a Short Text',
    maxSeconds: 60,
    prepSeconds: 0,
    hasAudio: true,
    overlay: {
      type: 'table',
      headers: ['Age group', 'Recycling regularly (%)'],
      rows: [
        ['18–29', '45%'],
        ['30–44', '55%'],
        ['45–59', '70%'],
        ['60 and above', '80%'],
      ],
    },
    prompt:
      'Click the play button below. You will hear a teacher ask you to compare some options and share your view. Immediately after the speech finishes, the recording of your response will start automatically.\n\nYou may speak for up to 1 minute.',
    instructions: 'Listen once (table appears on screen), then speak for up to 1 minute.',
  },
  {
    n: 8,
    key: 'persuadingEvent',
    name: 'Persuading Others to Take Part in an Event',
    short: 'Persuade',
    skill: 'Persuading Others to Take Part in an Event',
    maxSeconds: 120,
    prepSeconds: 120,
    hasAudio: false,
    prompt:
      'You and a friend have to organise a community clean-up day in your neighbourhood to encourage more environmentally friendly behaviour. You now have two minutes to prepare a short speech. After that, you will have two minutes to deliver your speech directly to the people in your community, trying to persuade them to take part in this event. In your speech, explain why the clean-up day is important, how it will benefit the neighbourhood, and what will happen during the event. You can also mention how people can join, and use strong, clear messages to encourage them to participate.\n\nImmediately after the preparation time, the recording of your response will start automatically.\n\nYou may speak for up to 2 minutes.',
    instructions: '2 minutes preparation (countdown), then speak for up to 2 minutes. Recording starts automatically.',
  },
];

export const WRITING_PASSAGE = {
  title: 'AI in university teaching and learning',
  text: `In recent years, many universities have begun to integrate artificial intelligence (AI) into teaching and learning, and this trend is accelerating. Supporters of AI in education argue that it can transform the student experience in several important ways. First, AI tools can provide personalised feedback at scale. For example, writing assistants and learning platforms can quickly highlight common language errors, suggest improvements in structure, or point out gaps in understanding. This allows students to receive immediate, targeted support instead of waiting for a teacher's comments, which can be particularly helpful in large classes where individual attention is limited.

Second, AI can support flexible learning. Intelligent tutoring systems and adaptive online courses can adjust the level of difficulty based on a student's performance, offering easier tasks when they struggle and more demanding tasks when they succeed. As a result, students can move at their own pace, review difficult concepts repeatedly, and access materials at any time and from any location. This flexibility can be especially valuable for working students, parents, or those with disabilities, who may find it hard to follow rigid schedules in traditional classroom settings.

A third advantage is that AI can help teachers manage their workload. Automated quizzes and grading tools can reduce the time spent on routine assessment, giving instructors more time to design engaging learning activities, provide high-quality feedback on complex tasks, or support students who need extra help. In some cases, AI can also help identify patterns in student performance, such as topics that many students find challenging, so that teachers can adjust their teaching more quickly and effectively.

However, critics warn that the expanding use of AI in university teaching also carries serious risks. One concern is the potential loss of human interaction. If students rely mainly on AI systems for explanations and feedback, they may miss out on the richer, more nuanced discussions that happen in real classrooms with teachers and peers. These interactions often help students develop critical thinking, communication skills and the ability to work with others—skills that are difficult to cultivate through automated tools alone.

Another worry is inequality. Access to advanced AI tools may depend on resources, such as having a powerful computer, stable internet connection or paid subscriptions. Students from less privileged backgrounds might therefore be left behind. In addition, over-reliance on AI could reduce students' willingness to think independently. When answers and suggestions are always available, some students may be tempted to accept them without reflection, which could weaken their ability to question, analyse and create their own ideas.

For these reasons, some people argue that AI should be used carefully and moderately in universities. They believe that the best approach is to combine AI tools with strong human teaching, rather than allowing technology to dominate the learning environment.`,
};

/** @type {Array<{ n: number; key: string; name: string; short: string; skill: string; wordMin: number; wordMax: number; prompt: string; guidelines: string; hasPassage: boolean }>} */
export const WRITING = [
  {
    n: 9,
    key: 'summaryResponse',
    name: 'Summary Writing and Responses',
    short: 'Summary',
    skill: 'Summary Writing and Responses',
    wordMin: 100,
    wordMax: 150,
    hasPassage: true,
    prompt:
      "Read the text. In about 100-150 words, summarise the writer's main ideas and give your reaction.",
    guidelines:
      'Do not copy sentences from the text. First, briefly summarise the main points in your own words. Then give your reaction, supported by reasons and, if possible, examples. Use a clear, logical structure and appropriate formal or semi-formal register.',
  },
  {
    n: 10,
    key: 'argumentativeEssay',
    name: 'Argumentative Essay',
    short: 'Essay',
    skill: 'Argumentative Essay',
    wordMin: 200,
    wordMax: 300,
    hasPassage: false,
    prompt:
      "Many universities are increasing the use of online learning. Do you think this is a positive or negative development for students' education? Write a short essay discussing your opinion and giving reasons and examples to support your view.",
    guidelines:
      'Write about 200–300 words. Use a clear structure (introduction, main body, conclusion). State your position and support it with reasons and examples. Aim for formal, academic style English.',
  },
];

/** Qualitative bands for Paper III (no numeric /N grid in client materials). */
export const CONVERSION_BANDS = {
  speaking: [
    { min: 0, max: 0, bandKey: 'b1b2', cefr: 'B1/B2', ielts: '~4.0–6.0', toefl: '~40–75 / 120' },
    { min: 1, max: 1, bandKey: 'c1', cefr: 'C1', ielts: '~7.0–8.0', toefl: '~90–105 / 120' },
    { min: 2, max: 2, bandKey: 'c2', cefr: 'C2', ielts: '~8.0–9.0', toefl: '~105–120 / 120' },
  ],
  writing: [
    { min: 0, max: 0, bandKey: 'b1b2', cefr: 'B1/B2', ielts: '~4.0–6.0', toefl: '~40–75 / 120' },
    { min: 1, max: 1, bandKey: 'c1', cefr: 'C1', ielts: '~7.0–8.0', toefl: '~90–105 / 120' },
    { min: 2, max: 2, bandKey: 'c2', cefr: 'C2', ielts: '~8.0–9.0', toefl: '~105–120 / 120' },
  ],
};
