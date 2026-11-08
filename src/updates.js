// Автооновлення: коли ми публікуємо нову версію (зміни в екранах і логіці), застосунок завантажує її сам
// під час запуску чи повернення в застосунок і одразу перезапускається з новою версією.
// Нові звуки, дозволи чи модулі телефона (нативні зміни) все одно потребують нової збірки.
import { Platform } from 'react-native';

let busy = false;
export async function applyUpdateIfAny() {
  if (Platform.OS === 'web' || busy || __DEV__) return;
  busy = true;
  try {
    const Updates = require('expo-updates');
    if (!Updates.isEnabled) return;
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return;
    const res = await Updates.fetchUpdateAsync();
    if (res.isNew) await Updates.reloadAsync();
  } catch (e) {
    /* немає інтернету чи сервер оновлень недоступний — спробуємо наступного разу */
  } finally {
    busy = false;
  }
}
