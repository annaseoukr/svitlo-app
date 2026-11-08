import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Animated, Platform, Pressable, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandCross, T } from './src/components';
import { OPERATORS, loadSchedule, norm } from './src/data';
import { AllScreen, MyScreen, NewsScreen, Onboarding, QueuePicker, SettingsScreen } from './src/screens';
import { registerBackground } from './src/background';
import { applyUpdateIfAny } from './src/updates';
import { notificationsAvailable, notifyEmergency, registerPush, scheduleReminders, sendTest } from './src/reminders';
import { load, remove, save } from './src/storage';
import { useColors } from './src/theme';
import { addDays, fmtDate, kyivNow } from './src/time';

const DEFAULTS = { operator: 'cek', queue: '1.1', notifyChanges: true, notifyEmergency: true, remind: 15, remindOn: 0, onboarded: false };
const KEY = 'svitlo.settings.v1';

const TABS = [
  { id: 'my', label: 'Мій графік' },
  { id: 'all', label: 'Усі черги' },
  { id: 'news', label: 'Новини Дніпра' },
  { id: 'settings', label: 'Налаштування' },
];

const ZERO = { top: 0, bottom: 0, left: 0, right: 0 };
// У вебверсії відступи від країв екрана додає сама сторінка.
const useInsets = Platform.OS === 'web' ? () => ZERO : useSafeAreaInsets;

function Toast({ c, toast, onHide }) {
  const insets = useInsets();
  const y = useRef(new Animated.Value(-160)).current;
  useEffect(() => {
    if (!toast) return undefined;
    Animated.timing(y, { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
    const t = setTimeout(() => {
      Animated.timing(y, { toValue: -160, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start(onHide);
    }, 4500);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <Animated.View style={{ position: 'absolute', left: 10, right: 10, top: insets.top + 8, transform: [{ translateY: y }], zIndex: 20 }} accessibilityLiveRegion="polite">
      <Pressable onPress={onHide} style={{ backgroundColor: c.toastBg, borderRadius: 18, padding: 14, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: c.line, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#000000', borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
          <T c={c} display style={{ color: c.yellow, fontSize: 14, lineHeight: 18, fontWeight: '900' }}>DM</T>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T c={c} style={{ fontSize: 12, lineHeight: 16, color: c.muted }}>Світло · Dnipro media · зараз</T>
          <T c={c} style={{ fontWeight: '700', fontSize: 15, lineHeight: 20 }}>{toast.title}</T>
          <T c={c} style={{ fontSize: 14, lineHeight: 19 }}>{toast.body}</T>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Main() {
  const c = useColors();
  const insets = useInsets();
  const [settings, setSettings] = useState(null);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('my');
  const [toast, setToast] = useState(null);
  const [picker, setPicker] = useState(false);
  const [now, setNow] = useState(kyivNow());
  const [net, setNet] = useState({ offline: false, fetchedAt: null, loaded: false });

  const refresh = useCallback(() => {
    loadSchedule().then((res) => {
      if (res.data) setData(res.data);
      setNet({ offline: res.offline, fetchedAt: res.fetchedAt, loaded: true });
    });
  }, []);

  useEffect(() => {
    load(KEY).then((s) => {
      const merged = { ...DEFAULTS, ...(s || {}) };
      if (merged.remind > 30) merged.remind = 30; // раніше був варіант «за 1 год»
      setSettings(merged);
    });
    refresh();
    applyUpdateIfAny(); // нова версія застосунку завантажується сама, без перевстановлення
    const t = setInterval(() => setNow(kyivNow()), 30000);
    const r = setInterval(refresh, 5 * 60000); // оновлюємо графік кожні 5 хв
    // і щоразу, коли людина повертається в застосунок
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') { setNow(kyivNow()); refresh(); applyUpdateIfAny(); } });
    return () => { clearInterval(t); clearInterval(r); sub.remove(); };
  }, []);

  // Нагадування перед відключенням перепланувати, коли змінилися черга, налаштування чи графік.
  useEffect(() => { scheduleReminders(settings, data); }, [settings, data]);

  // Сайт має знати, куди й про що надсилати сповіщення; фонове оновлення графіка — для нагадувань.
  useEffect(() => { if (settings?.onboarded) { registerPush(settings); registerBackground(); } }, [settings]);

  // Екстрені відключення приходять у даних (alerts): банер і статус на головному екрані.
  // Сповіщення надсилає сайт; якщо push ще не дійшов, застосунок покаже його сам — один раз.
  const alerts = (data?.alerts || []).filter((a) => a.operator === settings?.operator);
  const alertKey = alerts.map((a) => a.id).join(',');
  useEffect(() => {
    if (settings?.notifyEmergency && settings?.onboarded) alerts.forEach((a) => notifyEmergency(a));
  }, [alertKey, settings?.notifyEmergency]);

  const update = useCallback((s) => { setSettings(s); save(KEY, s); }, []);

  // Перевірка: так виглядатимуть нагадування.
  const preview = () => {
    const op = OPERATORS[settings.operator].short;
    const m = settings.remind || 15;
    const t = { title: `Через ${m} хв відключення`, body: `Так виглядатимуть нагадування · черга ${settings.queue} · ${op}` };
    if (!notificationsAvailable) { setToast(t); return; }
    sendTest(t.title, t.body).then((ok) => { if (!ok) setToast(t); });
  };

  const pick = (operator, queue) => { update({ ...settings, operator, queue }); setPicker(false); };

  const root = { flex: 1, backgroundColor: c.bg };
  const frame = { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' };

  if (!settings) return <View style={root} />;

  if (!settings.onboarded) {
    return (
      <View style={[root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={frame}><Onboarding c={c} initial={settings} onDone={update} /></View>
      </View>
    );
  }

  return (
    <View style={root}>
      <View style={[frame, { paddingTop: insets.top }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ alignSelf: 'center' }}><BrandCross size={20} color={c.yellow} /></View>
            <T c={c} display style={{ fontSize: 22, lineHeight: 28, fontWeight: '900' }}>Світло</T>
            <T c={c} style={{ fontSize: 13, color: c.muted }}>Dnipro media</T>
          </View>
          {net.offline && !data?.demo ? (
            <View style={{ backgroundColor: c.chip, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <T c={c} style={{ fontSize: 12, lineHeight: 16, fontWeight: '600' }}>
                {net.fetchedAt ? `Без інтернету · дані на ${new Date(net.fetchedAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}` : 'Немає інтернету'}
              </T>
            </View>
          ) : null}
          {data?.demo ? (
            <View style={{ backgroundColor: c.yellow, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <T c={c} style={{ fontSize: 12, lineHeight: 16, color: '#000000', fontWeight: '600' }}>Демо-графіки</T>
            </View>
          ) : null}
        </View>

        <View style={{ flex: 1 }}>
          {tab === 'my' ? <MyScreen c={c} data={data} settings={settings} now={now} alerts={alerts} onChangeQueue={() => setPicker(true)} /> : null}
          {tab === 'all' ? <AllScreen c={c} data={data} settings={settings} now={now} /> : null}
          {tab === 'news' ? <NewsScreen c={c} /> : null}
          {tab === 'settings' ? (
            <SettingsScreen c={c} settings={settings} onChange={update} onPreview={preview} onChangeQueue={() => setPicker(true)}
              onReset={() => { remove(KEY); setSettings({ ...DEFAULTS }); setTab('my'); }} />
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.bg, paddingBottom: insets.bottom }} accessibilityRole="tablist">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <Pressable key={t.id} onPress={() => setTab(t.id)} accessibilityRole="tab" accessibilityState={{ selected: active }}
                style={{ flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 2 }}>
                <View style={{ width: 28, height: 4, borderRadius: 2, backgroundColor: active ? (t.id === 'news' ? c.warn : c.accent) : 'transparent' }} />
                <T c={c} style={{ fontSize: 12, lineHeight: 16, textAlign: 'center', fontWeight: active || t.id === 'news' ? '700' : '500', color: t.id === 'news' ? c.warn : active ? c.accent : c.muted }}>{t.label}</T>
              </Pressable>
            );
          })}
        </View>
      </View>
      <QueuePicker c={c} visible={picker} settings={settings} onPick={pick} onClose={() => setPicker(false)} />
      <Toast c={c} toast={toast} onHide={() => setToast(null)} />
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}
