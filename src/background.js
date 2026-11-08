// Фонове оновлення графіка: телефон приблизно раз на пів години (коли дозволить система)
// завантажує свіжий графік і переплановує нагадування — навіть якщо застосунок не відкривали.
import { Platform } from 'react-native';
import { loadSchedule } from './data';
import { scheduleReminders } from './reminders';
import { load } from './storage';

export const TASK = 'svitlo-refresh';
const native = Platform.OS !== 'web';

if (native) {
  const TaskManager = require('expo-task-manager');
  const BackgroundTask = require('expo-background-task');
  // Задачу треба оголосити одразу під час запуску коду застосунку (не всередині екрана).
  TaskManager.defineTask(TASK, async () => {
    try {
      const settings = await load('svitlo.settings.v1');
      const res = await loadSchedule();
      if (settings?.onboarded && res.data && !res.offline) await scheduleReminders(settings, res.data);
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (e) {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

let registered = false;
export async function registerBackground() {
  if (!native || registered) return;
  registered = true;
  try {
    const TaskManager = require('expo-task-manager');
    const BackgroundTask = require('expo-background-task');
    if (!(await TaskManager.isTaskRegisteredAsync(TASK))) {
      await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 30 });
    }
  } catch (e) { /* фонові задачі недоступні — нагадування оновляться, коли людина відкриє застосунок */ }
}
