export const formatTime = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export const formatDate = (timestamp: number, locale = 'en-GB') =>
  new Date(timestamp).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

export const percent = (value: number, total: number) => Math.round((value / total) * 100);
