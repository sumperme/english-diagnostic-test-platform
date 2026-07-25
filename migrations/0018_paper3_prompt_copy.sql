-- Paper III speaking prompt copy: describe short countdown before recording
-- (quiz UI). Answer Review strips Click/speak-time boilerplate at display time.

UPDATE questions SET
  prompt_text = 'Click the play button below. You will hear a Human Resources Officer ask you a question. After the prompt finishes, a short countdown will run, then recording starts automatically.

You may speak for up to 1 minute.',
  explanation = '{"responseType":"speaking","maxSeconds":60,"prepSeconds":0,"overlay":null,"instructions":"Listen once. After a short countdown, speak for up to 1 minute. Recording starts automatically when the countdown ends."}'
WHERE question_code = '03-01-01-001-01';

UPDATE questions SET
  prompt_text = 'Click the play button below. You will hear a teacher ask you to share your view about the future. After the prompt finishes, a short countdown will run, then recording starts automatically.

You may speak for up to 1 minute.',
  explanation = '{"responseType":"speaking","maxSeconds":60,"prepSeconds":0,"overlay":null,"instructions":"Listen once. After a short countdown, speak for up to 1 minute."}'
WHERE question_code = '03-01-02-002-01';

UPDATE questions SET
  prompt_text = 'Click the play button below. You will hear a teacher ask you to share your experience. After the prompt finishes, a short countdown will run, then recording starts automatically.

You may speak for up to 1 minute.',
  explanation = '{"responseType":"speaking","maxSeconds":60,"prepSeconds":0,"overlay":null,"instructions":"Listen once. After a short countdown, speak for up to 1 minute."}'
WHERE question_code = '03-01-03-003-01';

UPDATE questions SET
  prompt_text = 'Click the play button below. You will hear a teacher ask you to share your view about an abstract idea. After the prompt finishes, a short countdown will run, then recording starts automatically.

You may speak for up to 1 minute.',
  explanation = '{"responseType":"speaking","maxSeconds":60,"prepSeconds":0,"overlay":null,"instructions":"Listen once. After a short countdown, speak for up to 1 minute."}'
WHERE question_code = '03-01-04-004-01';

UPDATE questions SET
  prompt_text = 'Click the play button below. You will hear a friend talk about her view about social media. After the prompt finishes, a short countdown will run, then recording starts automatically.

You may speak for up to 1 minute.',
  explanation = '{"responseType":"speaking","maxSeconds":60,"prepSeconds":0,"overlay":null,"instructions":"Listen once. After a short countdown, speak for up to 1 minute."}'
WHERE question_code = '03-01-05-005-01';

UPDATE questions SET
  prompt_text = 'Click the play button below. You will hear a teacher ask you to compare some options and share your view. After the prompt finishes, a short countdown will run, then recording starts automatically.

You may speak for up to 1 minute.',
  explanation = '{"responseType":"speaking","maxSeconds":60,"prepSeconds":0,"overlay":{"type":"list","items":["More public transport lines","Higher parking fees in busy areas","More bicycle lanes and pedestrian zones","Encouraging car-sharing or limiting car numbers in the city centre"]},"instructions":"Listen once (options appear on screen). After a short countdown, speak for up to 1 minute."}'
WHERE question_code = '03-01-06-006-01';

UPDATE questions SET
  prompt_text = 'Click the play button below. You will hear a teacher ask you to compare some options and share your view. After the prompt finishes, a short countdown will run, then recording starts automatically.

You may speak for up to 1 minute.',
  explanation = '{"responseType":"speaking","maxSeconds":60,"prepSeconds":0,"overlay":{"type":"table","headers":["Age group","Recycling regularly (%)"],"rows":[["18–29","45%"],["30–44","55%"],["45–59","70%"],["60 and above","80%"]]},"instructions":"Listen once (table appears on screen). After a short countdown, speak for up to 1 minute."}'
WHERE question_code = '03-01-07-007-01';

UPDATE questions SET
  prompt_text = 'You and a friend have to organise a community clean-up day in your neighbourhood to encourage more environmentally friendly behaviour. You now have two minutes to prepare a short speech. After that, you will have two minutes to deliver your speech directly to the people in your community, trying to persuade them to take part in this event. In your speech, explain why the clean-up day is important, how it will benefit the neighbourhood, and what will happen during the event. You can also mention how people can join, and use strong, clear messages to encourage them to participate.

After preparation, a short countdown will run, then recording starts automatically.

You may speak for up to 2 minutes.',
  explanation = '{"responseType":"speaking","maxSeconds":120,"prepSeconds":120,"overlay":null,"instructions":"2 minutes preparation (countdown). In the last 3 seconds a speaking countdown appears, then speak for up to 2 minutes. Recording starts automatically."}'
WHERE question_code = '03-01-08-008-01';
