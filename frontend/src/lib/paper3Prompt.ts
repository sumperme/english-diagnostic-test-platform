/** Strip Paper III speaking UI boilerplate from prompts shown in Answer Review. */

const LEADING_CLICK =
  /^\s*Click the play button below\.?\s*/i;
const SPEAK_ALLOWANCE =
  /\n*\s*You may speak for up to \d+\s*minutes?\.?\s*/gi;
const IMMEDIATE_AFTER_QUESTION =
  /\s*Immediately after the (?:question|speech) finishes, the recording of your response will start automatically\.?\s*/gi;
const IMMEDIATE_AFTER_PREP =
  /\s*Immediately after the preparation time, the recording of your response will start automatically\.?\s*/gi;
/** New copy variants that still belong in the quiz UI, not the report. */
const AFTER_PROMPT_COUNTDOWN =
  /\s*(?:Recording will then start automatically after a short countdown\.?|After the prompt finishes, a short countdown will run, then recording starts automatically\.?|The recording will start after the prompt\.?)\s*/gi;
const AFTER_PREP_COUNTDOWN =
  /\s*(?:Recording will then start automatically after a short countdown\.?|After preparation, a short countdown will run, then recording starts automatically\.?|The recording will start after the prompt\.?)\s*/gi;

export function stripSpeakingUiBoilerplate(prompt: string): string {
  let text = String(prompt ?? '');
  text = text.replace(LEADING_CLICK, '');
  text = text.replace(IMMEDIATE_AFTER_QUESTION, ' ');
  text = text.replace(IMMEDIATE_AFTER_PREP, ' ');
  text = text.replace(AFTER_PROMPT_COUNTDOWN, ' ');
  text = text.replace(AFTER_PREP_COUNTDOWN, ' ');
  text = text.replace(SPEAK_ALLOWANCE, '\n');
  return text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}
