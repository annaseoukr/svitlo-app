// Нагадування перед відключенням. Телефон планує їх сам, без сервера:
// працюють навіть без інтернету, якщо графік уже завантажено.
import { Platform } from 'react-native';
import { OPERATORS, norm } from './data';
import { addDays, kyivNow } from './time';

const native = Platform.OS !== 'web';
let N = null;
if (native) {
  N = require('expo-notifications');
  N.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export const notificationsAvailable = native;

// Дата за Києвом + хвилини від початку доби → момент часу.
function kyivToDate(iso, minutes) {
  const [y, m, d] = iso.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d) + minutes * 60000;
  const p = kyivNow(new Date(guess));
  const [py, pm, pd] = p.date.split('-').map(Number);
  const shown = Date.UTC(py, pm - 1, pd) + p.minutes * 60000;
  return new Date(guess - (shown - guess));
}

async function ensureReady() {
  if (!N) return false;
  try {
    await N.setNotificationChannelAsync('reminders', {
      name: 'Нагадування перед відключенням',
      importance: N.AndroidImportance.HIGH,
    });
    let { status } = await N.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await N.requestPermissionsAsync());
    return status === 'granted';
  } catch (e) {
    return false;
  }
}

export async function scheduleReminders(settings, data) {
  if (!N || !settings?.onboarded || !data) return;
  try {
    await N.cancelAllScheduledNotificationsAsync();
    if (!settings.remind) return;
    if (!(await ensureReady())) return;
    const op = OPERATORS[settings.operator];
    const days = data.operators?.[settings.operator]?.days || {};
    const today = kyivNow().date;
    const now = Date.now();
    for (const date of [today, addDays(today, 1)]) {
      const day = days[date];
      if (!day || day.status === 'cancelled') continue;
      for (const iv of norm(day.queues?.[settings.queue])) {
        const when = kyivToDate(date, iv.s - settings.remind);
        if (when.getTime() <= now + 30000) continue;
        await N.scheduleNotificationAsync({
          content: {
            title: `Через ${settings.remind} хв відключення`,
            body: `Черга ${settings.queue} · ${op.short} · ${iv.from}–${iv.to}${data.demo ? ' (демо-графік)' : ''}`,
            sound: 'default',
          },
          trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'reminders' },
        });
      }
    }
  } catch (e) { /* не вдалося запланувати — застосунок працює далі */ }
}

// Тестове сповіщення на екран телефона через 3 секунди.
export async function sendTest(title, body) {
  if (!N) return false;
  if (!(await ensureReady())) return false;
  try {
    await N.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: 'reminders' },
    });
    return true;
  } catch (e) {
    return false;
  }
}
