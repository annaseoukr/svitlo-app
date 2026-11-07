import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './src/components';
import { OPERATORS, loadSchedule, norm } from './src/data';
import { AllScreen, HelpScreen, MyScreen, NewsScreen, Onboarding, SettingsScreen } from './src/screens';
import { notificationsAvailable, scheduleReminders, sendTest } from './src/reminders';
import { load, remove, save } from './src/storage';
import { useColors } from './src/theme';
import { addDays, fmtDate, kyivNow } from './src/time';

const DEFAULTS = { operator: 'cek', queue: '1.1', notifyChanges: true, notifyEmergency: true, remind: 15, onboarded: false };
const KEY = 'svitlo.settings.v1';

const TABS = [
  { id: 'my', label: 'Мій графік' },
  { id: 'all', label: 'Усі черги' },
  { id: 'news', label: 'Новини' },
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
  const [alertOn, setAlertOn] = useState(false);
  const [help, setHelp] = useState(null);
  const [now, setNow] = useState(kyivNow());

  useEffect(() => {
    load(KEY).then((s) => {
      const merged = { ...DEFAULTS, ...(s || {}) };
      if (merged.remind > 30) merged.remind = 30; // раніше був варіант «за 1 год»
      setSettings(merged);
    });
    loadSchedule().then(setData);
    const t = setInterval(() => setNow(kyivNow()), 30000);
    return () => clearInterval(t);
  }, []);

  // Нагадування перед відключенням перепланувати, коли змінилися черга, налаштування чи графік.
  useEffect(() => { scheduleReminders(settings, data); }, [settings, data]);

  // На телефоні — справжнє сповіщення, у вебверсії — картка всередині застосунку.
  const notify = (t) => {
    if (!notificationsAvailable) { setToast(t); return; }
    sendTest(t.title, t.body).then((ok) => { if (!ok) setToast(t); });
  };

  const update = useCallback((s) => { setSettings(s); save(KEY, s); }, []);

  const preview = (kind) => {
    const op = OPERATORS[settings.operator].short;
    const tomorrow = addDays(now.date, 1);
    const days = data?.operators?.[settings.operator]?.days || {};
    if (kind === 'schedule') {
      const iv = norm(days[tomorrow]?.queues?.[settings.queue]);
      notify({ title: `${op} оновив графік на ${fmtDate(tomorrow)}`, body: `Черга ${settings.queue}: ${iv.length ? iv.map((i) => `${i.from}–${i.to}`).join(', ') : 'без відключень'}` });
    } else {
      const iv = norm(days[now.date]?.queues?.[settings.queue]);
      const next = iv.find((i) => i.s > now.minutes) || iv[0];
      const m = settings.remind || 15;
      notify({ title: `Через ${m} хв відключення`, body: next ? `Черга ${settings.queue} · ${op} · ${next.from}–${next.to}` : `Черга ${settings.queue} · ${op}` });
    }
  };

  const alert = alertOn ? {
    title: 'Екстрені відключення',
    text: `${OPERATORS[settings?.operator || 'cek'].short} застосовує екстрені відключення. Графіки погодинних відключень зараз можуть не діяти.`,
    time: `Сьогодні о ${String(Math.floor(now.minutes / 60)).padStart(2, '0')}:${String(now.minutes % 60).padStart(2, '0')}`,
  } : null;

  const toggleAlert = () => {
    if (!alertOn) notify({ title: 'Екстрені відключення · ЦЕК', body: 'Графіки зараз можуть не діяти. Деталі в застосунку.' });
    setAlertOn(!alertOn);
    if (!alertOn) setTab('my');
  };

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
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <T c={c} display style={{ fontSize: 22, lineHeight: 28, fontWeight: '900' }}>Світло</T>
            <T c={c} style={{ fontSize: 13, color: c.muted }}>Dnipro media</T>
          </View>
          {data?.demo ? (
            <View style={{ backgroundColor: c.yellow, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <T c={c} style={{ fontSize: 12, lineHeight: 16, color: '#000000', fontWeight: '600' }}>Демо-графіки</T>
            </View>
          ) : null}
        </View>

        <View style={{ flex: 1 }}>
          {help ? <HelpScreen c={c} topic={help} onBack={() => setHelp(null)} /> : null}
          {!help && tab === 'my' ? <MyScreen c={c} data={data} settings={settings} now={now} alert={alert} onChangeQueue={() => setTab('settings')} /> : null}
          {!help && tab === 'all' ? <AllScreen c={c} data={data} settings={settings} now={now} /> : null}
          {!help && tab === 'news' ? <NewsScreen c={c} /> : null}
          {!help && tab === 'settings' ? (
            <SettingsScreen c={c} settings={settings} onChange={update} onPreview={preview} alertOn={alertOn} onToggleAlert={toggleAlert} onHelp={setHelp}
              onReset={() => { remove(KEY); setSettings({ ...DEFAULTS }); setTab('my'); }} />
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.bg, paddingBottom: insets.bottom }} accessibilityRole="tablist">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <Pressable key={t.id} onPress={() => { setHelp(null); setTab(t.id); }} accessibilityRole="tab" accessibilityState={{ selected: active }}
                style={{ flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 2 }}>
                <View style={{ width: 28, height: 4, borderRadius: 2, backgroundColor: active ? c.accent : 'transparent' }} />
                <T c={c} style={{ fontSize: 12, lineHeight: 16, textAlign: 'center', fontWeight: active ? '700' : '500', color: active ? c.accent : c.muted }}>{t.label}</T>
              </Pressable>
            );
          })}
        </View>
      </View>
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
