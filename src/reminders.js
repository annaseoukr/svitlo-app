// Сповіщення на телефоні.
//  - Нагадування перед відключенням і увімкненням телефон планує сам (працюють і без інтернету).
//  - Про новий графік і екстрені відключення сповіщає сайт (push через сервіс Expo), навіть коли застосунок закритий.
//  - Звичайні сповіщення: один нейтральний звук і вібрація. Екстрені — окремий гучніший звук, змінити не можна.
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { OPERATORS, SITE_API, norm } from './data';
import { load, save } from './storage';
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

const REMIND = 'svitlo-remind';
const NOTIFY = 'notify.wav';
const ALARM = 'alarm.wav';
const LEGACY = ['reminders', 'remind-default', 'remind-signal', 'remind-bell', 'remind-sound', 'remind-vibrate', 'remind-screen'];
const PUSH_KEY = 'svitlo.push.v1';

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
async function ensureChannels() {
  if (!N || channelsReady || Platform.OS !== 'android') return;
  for (const id of LEGACY) { try { await N.deleteNotificationChannelAsync(id); } catch (e) { /* немає — і добре */ } }
  await N.setNotificationChannelAsync(REMIND, {
    name: 'Графіки й нагадування', importance: N.AndroidImportance.HIGH,
    sound: NOTIFY, enableVibrate: true, vibrationPattern: [0, 250, 150, 250],
  });
  await N.setNotificationChannelAsync('emergency', {
    name: 'Екстрені відключення', importance: N.AndroidImportance.MAX,
    sound: ALARM, enableVibrate: true, vibrationPattern: [0, 500, 250, 500, 250, 500],
  });
  channelsReady = true;
}

async function ensureReady() {
  if (!N) return false;
  try {
    await ensureChannels();
    let { status } = await N.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await N.requestPermissionsAsync());
    return status === 'granted';
  } catch (e) {
    return false;
  }
}

const content = (title, body) => ({ title, body, sound: NOTIFY });

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
    const at = async (date, minutes, title, body) => {
      const when = kyivToDate(date, minutes);
      if (when.getTime() <= now + 30000) return;
      await N.scheduleNotificationAsync({
        content: content(title, body),
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: when, channelId: REMIND },
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
            `Черга ${settings.queue} · ${op.short} · ${iv.from}–${iv.to}`);
        }
        // перед увімкненням (якщо відключення не триває далі через північ)
        if (settings.remindOn && !(iv.e === 1440 && nextStartsAtMidnight)) {
          await at(date, iv.e - settings.remindOn, `Через ${settings.remindOn} хв увімкнуть світло`,
            `Черга ${settings.queue} · ${op.short} · за графіком о ${fmtMin(iv.e)}`);
        }
      }
    }
  } catch (e) { /* не вдалося запланувати — застосунок працює далі */ }
}

// Перевірка сповіщень — через 3 секунди.
export async function sendTest(title, body) {
  if (!N) return false;
  if (!(await ensureReady())) return false;
  try {
    await N.scheduleNotificationAsync({
      content: content(title, body),
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: REMIND },
    });
    return true;
  } catch (e) {
    return false;
  }
}

// Екстрене відключення, яке застосунок побачив сам (запасний шлях до push). Один раз на кожне повідомлення.
export async function notifyEmergency(alert) {
  if (!N || !alert) return;
  const seen = (await load('svitlo.alerts.seen')) || [];
  if (seen.includes(alert.id)) return;
  await save('svitlo.alerts.seen', [...seen.slice(-30), alert.id]);
  if (!(await ensureReady())) return;
  try {
    await N.scheduleNotificationAsync({
      content: { title: alert.title, body: alert.text, sound: ALARM, priority: N.AndroidNotificationPriority?.MAX },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: 'emergency' },
    });
  } catch (e) { /* ігноруємо */ }
}

// Повідомити сайт, куди й про що надсилати push: код сповіщень, оператор, черга. Жодних особистих даних.
export async function registerPush(settings) {
  if (!N || !settings?.onboarded) return;
  try {
    if (!(await ensureReady())) return;
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await N.getExpoPushTokenAsync({ projectId });
    const payload = {
      token, operator: settings.operator, queue: settings.queue,
      changes: settings.notifyChanges ? 1 : 0, emergency: settings.notifyEmergency ? 1 : 0, platform: Platform.OS,
    };
    const last = await load(PUSH_KEY);
    const day = new Date().toISOString().slice(0, 10);
    if (last && last.day === day && JSON.stringify(last.payload) === JSON.stringify(payload)) return;
    const r = await fetch(`${SITE_API}/device`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (r.ok) await save(PUSH_KEY, { day, payload });
  } catch (e) { /* немає Firebase чи мережі — спробуємо наступного разу */ }
}

// Системні налаштування сповіщень застосунку — там людина регулює гучність.
export function openNotificationSettings() {
  try { Linking.openSettings(); } catch (e) { /* ігноруємо */ }
}
