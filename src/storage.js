// Налаштування людини зберігаються лише на її телефоні.
import AsyncStorage from '@react-native-async-storage/async-storage';

const memory = {};

export async function load(key) {
  try {
    const v = await AsyncStorage.getItem(key);
    if (v != null) return JSON.parse(v);
  } catch (e) { /* сховище недоступне — працюємо з памʼяттю */ }
  return memory[key] ?? null;
}

export async function save(key, value) {
  memory[key] = value;
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ігноруємо */ }
}

export async function remove(key) {
  delete memory[key];
  try { await AsyncStorage.removeItem(key); } catch (e) { /* ігноруємо */ }
}
