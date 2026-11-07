// Сповіщення на телефоні. Нагадування телефон планує сам, без сервера:
// вони працюють навіть без інтернету, якщо графік уже завантажено.
import { Linking, Platform } from 'react-native';
import { OPERATORS, norm } from './data';
import { addDays, fmtMin, kyivNow } from './time';

const native = Platform.OS !== 'web';
let N = null;
if (native) {
  N = require('expo-notifications');
  N.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export const notificationsAvailable = native;

// Як приходять нагадування — обирає людина. Звук один, нейтральний (assets/sounds/notify.wav);
// екстрені відключення мають власний, інший звук (alarm.wav), і його не змінити.
export const MODES = [
  { id: 'sound', label: 'Звук і вібрація', hint: 'Рекомендовано: точно не пропустите' },
  { id: 'vibrate', label: 'Лише вібрація', hint: 'Без звуку, телефон вібрує' },
  { id: 'screen', label: 'Лише на екрані', hint: 'Без звуку й вібрації' },
];
const NOTIFY = 'notify.wav';
const ALARM = 'alarm.wav';
const LEGACY = ['reminders', 'remind-default', 'remind-signal', 'remind-bell'];

// На Android звук і вібрацію задає канал сповіщень, і змінити їх потім не можна,
// тому для кожного способу — свій канал.
const channelFor = (mode) => `remind-${MODES.some((m) => m.id === mode) ? mode : 'sound'}`;

// Дата за Києвом + хвилини від початку доби → момент часу.
function kyivToDate(iso, minutes) {
  const [y, m, d] = iso.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d) + minutes * 60000;
  const p = kyivNow(new Date(guess));
  const [py, pm, pd] = p.date.split('-').map(Number);
  const shown = Date.UTC(py, pm - 1, pd) + p.minutes * 60000;
  return new Date(guess - (shown - guess));
}

let channelsReady = false;
async function ensureReady() {
  if (!N) return false;
  try {
    if (!channelsReady && Platform.OS === 'android') {
      for (const id of LEGACY) { try { await N.deleteNotificationChannelAsync(id); } catch (e) { /* немає — і добре */ } }
      await N.setNotificationChannelAsync('remind-sound', {
        name: 'Нагадування: звук і вібрація', importance: N.AndroidImportance.HIGH,
        sound: NOTIFY, enableVibrate: true, vibrationPattern: [0, 250, 150, 250],
      });
      await N.setNotificationChannelAsync('remind-vibrate', {
        name: 'Нагадування: лише вібрація', importance: N.AndroidImportance.HIGH,
        sound: null, enableVibrate: true, vibrationPattern: [0, 250, 150, 250],
      });
      await N.setNotificationChannelAsync('remind-screen', {
        name: 'Нагадування: лише на екрані', importance: N.AndroidImportance.HIGH,
        sound: null, enableVibrate: false, vibrationPattern: null,
      });
      await N.setNotificationChannelAsync('emergency', {
        name: 'Екстрені відключення', importance: N.AndroidImportance.MAX,
        sound: ALARM, enableVibrate: true, vibrationPattern: [0, 500, 250, 500, 250, 500],
      });
      channelsReady = true;
    }
    let { status } = await N.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await N.requestPermissionsAsync());
    return status === 'granted';
  } catch (e) {
    return false;
  }
}

function content(title, body, mode) {
  return { title, body, sound: (mode || 'sound') === 'sound' ? NOTIFY : false };
}

export async function scheduleReminders(settings, data) {
  if (!N || !settings?.onboarded || !data) return;
  try {
    await N.cancelAllScheduledNotificationsAsync();
    if (!settings.remind && !settings.remindOn) return;
    if (!(await ensureReady())) return;
    const op = OPERATORS[settings.operator];
    const days = data.operators?.[settings.operator]?.days || {};
    const today = kyivNow().date;
    const now = Date.now();
    const demo = data.demo ? ' (демо-графік)' : '';
    const channelId = channelFor(settings.notifyMode);
    const at = async (date, minutes, title, body) => {
      const when = kyivToDate(date, minutes);
      if (when.getTime() <= now + 30000) return;
      await N.scheduleNotificationAsync({
        content: content(title, body, settings.notifyMode),
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: when, channelId },
      });
    };
    for (const date of [today, addDays(today, 1)]) {
      const day = days[date];
      if (!day || day.status === 'cancelled') continue;
      const next = days[addDays(date, 1)];
      const nextStartsAtMidnight = norm(next?.queues?.[settings.queue])[0]?.s === 0;
      const prevIv = norm(days[addDays(date, -1)]?.queues?.[settings.queue]);
      const prevEndsAtMidnight = prevIv.length > 0 && prevIv[prevIv.length - 1].e === 1440;
      for (const iv of norm(day.queues?.[settings.queue])) {
        // перед вимкненням (якщо світла не було вже з учорашнього вечора — не нагадуємо)
        if (settings.remind && !(iv.s === 0 && prevEndsAtMidnight)) {
          await at(date, iv.s - settings.remind, `Через ${settings.remind} хв відключення`,
            `Черга ${settings.queue} · ${op.short} · ${iv.from}–${iv.to}${demo}`);
        }
        // перед увімкненням (якщо відключення не триває далі через північ)
        if (settings.remindOn && !(iv.e === 1440 && nextStartsAtMidnight)) {
          await at(date, iv.e - settings.remindOn, `Через ${settings.remindOn} хв увімкнуть світло`,
            `Черга ${settings.queue} · ${op.short} · за графіком о ${fmtMin(iv.e)}${demo}`);
        }
      }
    }
  } catch (e) { /* не вдалося запланувати — застосунок працює далі */ }
}

// Перевірка: сповіщення обраним способом — через 3 секунди.
export async function sendTest(title, body, mode) {
  if (!N) return false;
  if (!(await ensureReady())) return false;
  try {
    await N.scheduleNotificationAsync({
      content: content(title, body, mode),
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: channelFor(mode) },
    });
    return true;
  } catch (e) {
    return false;
  }
}

// Екстрене відключення: гучний окремий канал. Показуємо один раз на кожне повідомлення.
const shownAlerts = new Set();
export async function notifyEmergency(alert) {
  if (!N || !alert || shownAlerts.has(alert.id)) return;
  shownAlerts.add(alert.id);
  if (!(await ensureReady())) return;
  try {
    await N.scheduleNotificationAsync({
      content: { title: alert.title, body: alert.text, sound: ALARM, priority: N.AndroidNotificationPriority?.MAX },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: 'emergency' },
    });
  } catch (e) { /* ігноруємо */ }
}

// Системні налаштування сповіщень застосунку — там людина регулює гучність і звук.
export function openNotificationSettings() {
  try { Linking.openSettings(); } catch (e) { /* ігноруємо */ }
}
