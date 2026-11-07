// Час і дати — завжди за Києвом (Europe/Kyiv), незалежно від налаштувань телефона.
const TZ = 'Europe/Kyiv';
const pad = (n) => String(n).padStart(2, '0');

export function kyivNow(d = new Date()) {
  try {
    const f = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    const p = {};
    f.formatToParts(d).forEach((x) => { p[x.type] = x.value; });
    return { date: `${p.year}-${p.month}-${p.day}`, minutes: (Number(p.hour) % 24) * 60 + Number(p.minute) };
  } catch (e) {
    return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, minutes: d.getHours() * 60 + d.getMinutes() };
  }
}

export function addDays(iso, n) {
  const [y, m, dd] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10);
}

export const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
export const fmtMin = (m) => `${pad(Math.floor((m % 1440) / 60))}:${pad(m % 60)}`;

export function fmtDuration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} хв`;
  return m ? `${h} год ${m} хв` : `${h} год`;
}

const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const WEEKDAYS = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'];

export function fmtDate(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function weekday(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

// "2026-11-06T21:05:00+02:00" → "вчора о 21:05"
export function fmtUpdated(iso, today) {
  if (!iso) return '';
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  if (date === today) return `сьогодні о ${time}`;
  if (date === addDays(today, -1)) return `вчора о ${time}`;
  return `${fmtDate(date)} о ${time}`;
}
