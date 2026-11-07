// Дані графіків.
// Зараз — демо-дані. На наступному етапі плагін dm-outage-monitor віддаватиме той самий формат
// за адресою API_URL, і застосунок почне показувати справжні графіки без змін в екранах.
//
// Формат (для плагіна):
// {
//   "generated_at": "2026-11-07T12:00:00+02:00",
//   "operators": {
//     "cek": { "days": { "2026-11-07": {
//        "status": "schedule" | "cancelled",
//        "updated_at": "2026-11-06T21:05:00+02:00",
//        "source_url": "https://t.me/cek_info/4335",
//        "news_url": "https://www.dnipro.media/...",
//        "queues": { "1.1": [["06:00","10:00"],["18:00","22:00"]], ... }   // кінець доби — "00:00"
//     } } },
//     "dtek": { ... }
//   },
//   "alerts": [ { "id": "...", "operator": "cek", "title": "...", "text": "...", "at": "ISO" } ]
// }
import { addDays, fmtMin, kyivNow, toMin } from './time';

export const API_URL = null; // напр. 'https://www.dnipro.media/wp-json/dmom/v1/app'
export const NEWS_URL = 'https://www.dnipro.media/wp-json/wp/v2/novyny_dnipro?per_page=15&_embed=wp:featuredmedia';
export const SITE_NEWS = 'https://www.dnipro.media/novyny-dnipro/';
export const GROUP_URL = 'https://www.dnipro.media/grupa-svitla-dnipro/';
export const SITE = 'https://www.dnipro.media/';

export const OPERATORS = {
  cek: { id: 'cek', short: 'ЦЕК', long: 'ЦЕК', source: 'https://t.me/cek_info' },
  dtek: { id: 'dtek', short: 'ДТЕК', long: 'ДТЕК Дніпровські електромережі', source: 'https://t.me/dtek_ua' },
};

export const QUEUES = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];

// Інтервали черги → [{s, e, from, to}] у хвилинах; кінець "00:00" = кінець доби.
export function norm(list) {
  return (list || [])
    .map(([from, to]) => {
      const s = toMin(from);
      let e = toMin(to);
      if (e <= s) e = 1440;
      return { s, e, from, to };
    })
    .sort((a, b) => a.s - b.s);
}

export function statusNow(today, tomorrow, queue, nowMin) {
  if (!today) return { kind: 'nodata' };
  if (today.status === 'cancelled') return { kind: 'cancelled' };
  const iv = norm(today.queues?.[queue]);
  const tom = tomorrow && tomorrow.status !== 'cancelled' ? norm(tomorrow.queues?.[queue]) : null;
  const cur = iv.find((i) => nowMin >= i.s && nowMin < i.e);
  if (cur) {
    let end = cur.e;
    let tomorrowEnd = false;
    if (end === 1440 && tom && tom[0] && tom[0].s === 0) { end = 1440 + tom[0].e; tomorrowEnd = true; }
    return { kind: 'off', until: fmtMin(end % 1440 === 0 && !tomorrowEnd ? 0 : end), left: end - nowMin, tomorrowEnd };
  }
  const next = iv.find((i) => i.s > nowMin);
  if (next) return { kind: 'on', next: next.from, nextEnd: fmtMin(next.e), left: next.s - nowMin };
  if (tom && tom[0]) return { kind: 'on', nextTomorrow: tom[0].from, nextEnd: fmtMin(tom[0].e), left: 1440 - nowMin + tom[0].s };
  return { kind: 'on', none: true, tomorrowKnown: !!tomorrow };
}

// ---------- Демо-дані ----------
function genDay(op, dayIndex) {
  const queues = {};
  const shift = op === 'cek' ? 0 : 1;
  const half = op === 'dtek' ? 30 : 0;
  QUEUES.forEach((q, i) => {
    const g = Math.floor(i / 2);
    const sub = i % 2;
    const start = ((g * 2 + dayIndex * 3 + shift) % 12) * 60 + sub * 60 + half;
    const parts = [];
    [start, start + 720].forEach((base) => {
      const s = base % 1440;
      const e = s + 240;
      if (e <= 1440) parts.push([s, e]);
      else { parts.push([s, 1440]); parts.push([0, e - 1440]); }
    });
    parts.sort((a, b) => a[0] - b[0]);
    const merged = [];
    parts.forEach((p) => {
      const last = merged[merged.length - 1];
      if (last && p[0] <= last[1]) last[1] = Math.max(last[1], p[1]);
      else merged.push([...p]);
    });
    queues[q] = merged.map(([s, e]) => [fmtMin(s), fmtMin(e)]);
  });
  return queues;
}

export function demoData() {
  const { date: today, minutes } = kyivNow();
  // Як у житті: графік на завтра в демо-даних зʼявляється лише ввечері, з 20:00.
  const tomorrowPublished = minutes >= 20 * 60;
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  const day = (op, idx, updated, src) => ({
    status: 'schedule',
    updated_at: updated,
    source_url: src,
    news_url: SITE_NEWS,
    queues: genDay(op, idx),
  });
  return {
    demo: true,
    generated_at: new Date().toISOString(),
    operators: {
      cek: { days: {
        [today]: day('cek', 0, `${yesterday}T21:05:00+02:00`, OPERATORS.cek.source),
        ...(tomorrowPublished ? { [tomorrow]: day('cek', 1, `${today}T20:05:00+02:00`, OPERATORS.cek.source) } : {}),
      } },
      dtek: { days: {
        [today]: day('dtek', 0, `${yesterday}T22:10:00+02:00`, OPERATORS.dtek.source),
        ...(tomorrowPublished ? { [tomorrow]: day('dtek', 1, `${today}T20:40:00+02:00`, OPERATORS.dtek.source) } : {}),
      } },
    },
    alerts: [],
  };
}

export async function loadSchedule() {
  if (API_URL) {
    try {
      const r = await fetch(API_URL, { headers: { Accept: 'application/json' } });
      if (r.ok) return await r.json();
    } catch (e) { /* немає мережі — показуємо останні збережені */ }
  }
  return demoData();
}

const ENT = { '&#8211;': '–', '&#8212;': '—', '&#171;': '«', '&#187;': '»', '&#8217;': 'ʼ', '&#039;': 'ʼ', '&quot;': '"', '&amp;': '&', '&nbsp;': ' ', '&#8230;': '…' };
const decode = (s) => s.replace(/&#?\w+;/g, (m) => ENT[m] ?? m);

export async function loadNews() {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = setTimeout(() => ctrl?.abort(), 8000);
  try {
    const r = await fetch(NEWS_URL, { signal: ctrl?.signal });
    if (!r.ok) throw new Error(String(r.status));
    const list = await r.json();
    return list.map((p) => ({
      id: p.id,
      title: decode(p.title?.rendered || ''),
      link: p.link,
      date: p.date,
      image: p._embedded?.['wp:featuredmedia']?.[0]?.media_details?.sizes?.medium?.source_url
        || p._embedded?.['wp:featuredmedia']?.[0]?.source_url || null,
    }));
  } finally {
    clearTimeout(t);
  }
}
