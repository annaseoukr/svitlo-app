import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { Btn, Card, ExtLink, Label, Legend, QueueGrid, Segmented, Strip, T, ToggleRow } from './components';
import { GROUP_URL, OPERATORS, QUEUES, SITE, SITE_NEWS, loadNews, norm, statusNow } from './data';
import { notificationsAvailable } from './reminders';
import { addDays, fmtDate, fmtDuration, fmtUpdated, weekday } from './time';

const OP_OPTIONS = [
  { value: 'cek', label: 'ЦЕК' },
  { value: 'dtek', label: 'ДТЕК' },
];

const REMIND_OPTIONS = [
  { value: 0, label: 'Ні' },
  { value: 15, label: '15 хв' },
  { value: 30, label: '30 хв' },
  { value: 60, label: '1 год' },
];

function Screen({ c, children }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
      {children}
    </ScrollView>
  );
}

// ---------------- Перший запуск ----------------
export function Onboarding({ c, initial, onDone }) {
  const [step, setStep] = useState(0);
  const [s, setS] = useState(initial);
  const total = 3;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20, flexGrow: 1 }}>
      <View style={{ gap: 6 }}>
        <T c={c} display style={{ fontSize: 28, lineHeight: 34 }}>Світло</T>
        <T c={c} style={{ color: c.muted }}>Графіки відключень для Дніпра від Dnipro media</T>
      </View>

      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Крок ${step + 1} з ${total}`}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? c.accent : c.line }} />
        ))}
      </View>

      {step === 0 ? (
        <View style={{ gap: 14 }}>
          <T c={c} display style={{ fontSize: 22, lineHeight: 28 }}>Хто постачає вам світло?</T>
          <T c={c} style={{ color: c.muted }}>Назву компанії видно в рахунку за електроенергію або в особистому кабінеті.</T>
          {['cek', 'dtek'].map((op) => {
            const active = s.operator === op;
            return (
              <Pressable
                key={op}
                onPress={() => setS({ ...s, operator: op })}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{ padding: 18, borderRadius: 16, borderWidth: 2, borderColor: active ? c.accent : c.line, backgroundColor: active ? c.accentSoft : c.surface, gap: 2 }}
              >
                <T c={c} display style={{ fontSize: 20, lineHeight: 26 }}>{OPERATORS[op].short}</T>
                <T c={c} style={{ color: c.muted, fontSize: 14 }}>{op === 'cek' ? 'Більшість будинків Дніпра' : 'ДТЕК Дніпровські електромережі'}</T>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: 14 }}>
          <T c={c} display style={{ fontSize: 22, lineHeight: 28 }}>Ваша черга</T>
          <T c={c} style={{ color: c.muted }}>Оберіть чергу {OPERATORS[s.operator].short}. Її можна змінити будь-коли в налаштуваннях.</T>
          <QueueGrid c={c} queues={QUEUES} value={s.queue} onChange={(q) => setS({ ...s, queue: q })} />
          <ExtLink href={GROUP_URL} style={{ paddingVertical: 8 }}>
            <T c={c} style={{ color: c.accent, fontWeight: '600' }}>Не знаєте свою чергу? Як її дізнатися ›</T>
          </ExtLink>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: 14 }}>
          <T c={c} display style={{ fontSize: 22, lineHeight: 28 }}>Сповіщення</T>
          <T c={c} style={{ color: c.muted }}>Ми надсилатимемо лише те, що стосується черги {s.queue}.</T>
          <Card c={c} style={{ paddingVertical: 6 }}>
            <ToggleRow c={c} label="Новий графік і зміни" hint="Щойно оператор опублікує або змінить графік" value={s.notifyChanges} onChange={(v) => setS({ ...s, notifyChanges: v })} />
            <ToggleRow c={c} label="Екстрені відключення" hint="Коли графіки перестають діяти" value={s.notifyEmergency} onChange={(v) => setS({ ...s, notifyEmergency: v })} />
          </Card>
          <T c={c} style={{ fontWeight: '600' }}>Нагадувати перед відключенням</T>
          <Segmented c={c} options={REMIND_OPTIONS} value={s.remind} onChange={(v) => setS({ ...s, remind: v })} />
        </View>
      ) : null}

      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {step > 0 ? <Btn c={c} kind="secondary" label="Назад" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
        <Btn
          c={c}
          label={step < total - 1 ? 'Далі' : 'Готово'}
          onPress={() => (step < total - 1 ? setStep(step + 1) : onDone({ ...s, onboarded: true }))}
          style={{ flex: 2 }}
        />
      </View>
    </ScrollView>
  );
}

// ---------------- Мій графік ----------------
function StatusCard({ c, st, op }) {
  let title; let line; let extra; let dark = false;
  if (st.kind === 'off') {
    dark = true;
    title = 'Світла немає';
    line = `Увімкнуть о ${st.until}${st.tomorrowEnd ? ' завтра' : ''}`;
    extra = `Ще ${fmtDuration(st.left)}`;
  } else if (st.kind === 'on' && st.next) {
    title = 'Світло є';
    line = `Відключення ${st.next}–${st.nextEnd}`;
    extra = `Через ${fmtDuration(st.left)}`;
  } else if (st.kind === 'on' && st.nextTomorrow) {
    title = 'Світло є';
    line = 'Сьогодні відключень більше немає';
    extra = `Завтра з ${st.nextTomorrow}`;
  } else if (st.kind === 'on') {
    title = 'Світло є';
    line = st.tomorrowKnown ? 'Сьогодні й завтра відключень немає' : 'Сьогодні відключень більше немає';
  } else if (st.kind === 'cancelled') {
    title = 'Графіки скасовано';
    line = `${op} скасував відключення на сьогодні`;
  } else {
    title = 'Графіка ще немає';
    line = `Повідомимо, щойно ${op} опублікує графік на сьогодні`;
  }
  const mint = st.kind === 'on' || st.kind === 'cancelled';
  const bg = dark ? c.offCard : mint ? c.on : c.surface;
  const fg = dark ? c.offInk : mint ? c.onText : c.ink;
  const sub = dark ? c.offText : mint ? c.onSub : c.muted;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 22, padding: 20, gap: 6, borderWidth: dark ? 2 : 1, borderColor: dark ? c.now : mint ? c.on : c.line }} accessibilityRole="summary">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dark ? c.now : mint ? c.onText : c.muted }} />
        <T c={c} style={{ color: sub, fontSize: 14 }}>Зараз</T>
      </View>
      <T c={c} display style={{ color: fg, fontSize: 32, lineHeight: 38, fontWeight: '900' }}>{title}</T>
      <T c={c} style={{ color: fg, fontSize: 18, lineHeight: 24, fontWeight: '600' }}>{line}</T>
      {extra ? <T c={c} style={{ color: sub, fontSize: 16 }}>{extra}</T> : null}
    </View>
  );
}

function DayBlock({ c, day, queue, nowMin, op, today }) {
  if (!day) {
    return (
      <Card c={c}>
        <T c={c} style={{ color: c.muted }}>{op} ще не опублікував графік на цей день. Повідомимо, щойно він зʼявиться.</T>
      </Card>
    );
  }
  if (day.status === 'cancelled') {
    return (
      <Card c={c} style={{ gap: 8 }}>
        <T c={c} style={{ fontWeight: '700' }}>Відключення скасовано</T>
        <T c={c} style={{ color: c.muted }}>Оновлено {fmtUpdated(day.updated_at, today)}</T>
      </Card>
    );
  }
  const iv = norm(day.queues?.[queue]);
  const total = iv.reduce((a, i) => a + (i.e - i.s), 0);
  return (
    <Card c={c} style={{ gap: 14 }}>
      <Strip c={c} intervals={iv} nowMin={nowMin} />
      <Legend c={c} />
      <View style={{ height: 1, backgroundColor: c.line }} />
      {iv.length ? (
        <View style={{ gap: 2 }}>
          {iv.map((i, k) => {
            const active = nowMin != null && nowMin >= i.s && nowMin < i.e;
            const past = nowMin != null && nowMin >= i.e;
            return (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, opacity: past ? 0.5 : 1 }}>
                <T c={c} display style={{ fontSize: 20, lineHeight: 26, fontVariant: ['tabular-nums'] }}>{i.from}–{i.to}</T>
                <T c={c} style={{ color: active ? c.now : c.muted, fontWeight: active ? '700' : '400', fontSize: 15 }}>
                  {active ? 'триває' : past ? 'минуло' : fmtDuration(i.e - i.s)}
                </T>
              </View>
            );
          })}
          <T c={c} style={{ color: c.muted, fontSize: 14, marginTop: 4 }}>Разом без світла: {fmtDuration(total)}</T>
        </View>
      ) : (
        <T c={c} style={{ fontWeight: '600' }}>Відключень не заплановано</T>
      )}
      <View style={{ height: 1, backgroundColor: c.line }} />
      <View style={{ gap: 10 }}>
        <T c={c} style={{ color: c.muted, fontSize: 14 }}>Оновлено {fmtUpdated(day.updated_at, today)} · {op}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {day.news_url ? (
            <ExtLink href={day.news_url} style={{ backgroundColor: c.accentSoft, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
              <T c={c} style={{ color: c.accent, fontWeight: '600', fontSize: 15 }}>Новина на Dnipro media</T>
            </ExtLink>
          ) : null}
          {day.source_url ? (
            <ExtLink href={day.source_url} style={{ backgroundColor: c.chip, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
              <T c={c} style={{ fontWeight: '600', fontSize: 15 }}>Джерело: {op}</T>
            </ExtLink>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

export function AlertBanner({ c, alert, demo }) {
  if (!alert) return null;
  return (
    <View style={{ backgroundColor: c.warnSoft, borderRadius: 18, padding: 16, gap: 4, borderWidth: 1, borderColor: c.warn }} accessibilityRole="alert">
      <T c={c} style={{ color: c.warn, fontWeight: '700', fontSize: 14, letterSpacing: 0.4, textTransform: 'uppercase' }}>
        {alert.title}{demo ? ' · приклад' : ''}
      </T>
      <T c={c} style={{ fontWeight: '600' }}>{alert.text}</T>
      <T c={c} style={{ color: c.muted, fontSize: 14 }}>{alert.time}</T>
    </View>
  );
}

export function MyScreen({ c, data, settings, now, alert, onChangeQueue }) {
  const [which, setWhich] = useState('today');
  const op = OPERATORS[settings.operator];
  const days = data?.operators?.[settings.operator]?.days || {};
  const today = now.date;
  const tomorrow = addDays(today, 1);
  const st = statusNow(days[today], days[tomorrow], settings.queue, now.minutes);
  const showDate = which === 'today' ? today : tomorrow;

  return (
    <Screen c={c}>
      <AlertBanner c={c} alert={alert} demo={data?.demo} />
      <Pressable onPress={onChangeQueue} accessibilityRole="button" accessibilityLabel="Змінити чергу"
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Label c={c}>{op.long}</Label>
          <T c={c} display style={{ fontSize: 24, lineHeight: 30 }}>Черга {settings.queue}</T>
        </View>
        <T c={c} style={{ color: c.accent, fontWeight: '600' }}>Змінити</T>
      </Pressable>

      <StatusCard c={c} st={st} op={op.short} />

      <Segmented c={c} value={which} onChange={setWhich} options={[
        { value: 'today', label: 'Сьогодні', sub: fmtDate(today) },
        { value: 'tomorrow', label: 'Завтра', sub: fmtDate(tomorrow) },
      ]} />
      <T c={c} style={{ color: c.muted, marginTop: -6 }}>{weekday(showDate)}, {fmtDate(showDate)}</T>
      <DayBlock c={c} day={days[showDate]} queue={settings.queue} nowMin={which === 'today' ? now.minutes : null} op={op.short} today={today} />

      <ExtLink href={GROUP_URL}>
        <Card c={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T c={c} style={{ fontWeight: '700' }}>Як дізнатися свою чергу</T>
            <T c={c} style={{ color: c.muted, fontSize: 14 }}>Покрокова інструкція на Dnipro media</T>
          </View>
          <T c={c} style={{ color: c.accent, fontSize: 22 }}>›</T>
        </Card>
      </ExtLink>
    </Screen>
  );
}

// ---------------- Усі черги ----------------
export function AllScreen({ c, data, settings, now }) {
  const [opId, setOp] = useState(settings.operator);
  const [which, setWhich] = useState('today');
  const today = now.date;
  const date = which === 'today' ? today : addDays(today, 1);
  const day = data?.operators?.[opId]?.days?.[date];
  const op = OPERATORS[opId];

  return (
    <Screen c={c}>
      <T c={c} display style={{ fontSize: 24, lineHeight: 30 }}>Усі черги</T>
      <Segmented c={c} options={OP_OPTIONS} value={opId} onChange={setOp} />
      <Segmented c={c} value={which} onChange={setWhich} options={[
        { value: 'today', label: 'Сьогодні', sub: fmtDate(today) },
        { value: 'tomorrow', label: 'Завтра', sub: fmtDate(addDays(today, 1)) },
      ]} />
      {!day ? (
        <Card c={c}><T c={c} style={{ color: c.muted }}>{op.short} ще не опублікував графік на {fmtDate(date)}.</T></Card>
      ) : day.status === 'cancelled' ? (
        <Card c={c}><T c={c} style={{ fontWeight: '700' }}>Відключення на {fmtDate(date)} скасовано</T></Card>
      ) : (
        <Card c={c} style={{ gap: 4, paddingHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 4 }}>
            <View style={{ width: 44 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Strip c={c} intervals={[]} nowMin={null} height={0} />
            </View>
          </View>
          {QUEUES.map((q) => {
            const iv = norm(day.queues?.[q]);
            const mine = opId === settings.operator && q === settings.queue;
            return (
              <View key={q} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 12, backgroundColor: mine ? c.accentSoft : 'transparent' }}>
                <T c={c} display style={{ width: 44, fontSize: 16, color: mine ? c.accent : c.ink }}>{q}</T>
                <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                  <Strip c={c} intervals={iv} nowMin={which === 'today' ? now.minutes : null} height={14} labels={false} radius={4} />
                  <T c={c} style={{ fontSize: 14, lineHeight: 18, color: c.muted, fontVariant: ['tabular-nums'] }}>
                    {iv.length ? iv.map((i) => `${i.from}–${i.to}`).join(', ') : 'без відключень'}
                  </T>
                </View>
              </View>
            );
          })}
          <View style={{ paddingTop: 8 }}><Legend c={c} /></View>
          <T c={c} style={{ color: c.muted, fontSize: 14, paddingTop: 6 }}>Оновлено {fmtUpdated(day.updated_at, today)} · {op.short}</T>
        </Card>
      )}
    </Screen>
  );
}

// ---------------- Новини ----------------
export function NewsScreen({ c }) {
  const [state, setState] = useState({ loading: true, items: [], error: false });
  const load = () => {
    setState({ loading: true, items: [], error: false });
    loadNews().then((items) => setState({ loading: false, items, error: false }))
      .catch(() => setState({ loading: false, items: [], error: true }));
  };
  useEffect(load, []);

  return (
    <Screen c={c}>
      <T c={c} display style={{ fontSize: 24, lineHeight: 30 }}>Новини Дніпра</T>
      {state.loading ? <ActivityIndicator color={c.accent} style={{ paddingVertical: 24 }} /> : null}
      {state.error ? (
        <Card c={c} style={{ gap: 10 }}>
          <T c={c} style={{ fontWeight: '700' }}>Не вдалося завантажити новини</T>
          <T c={c} style={{ color: c.muted }}>
            У тестовій версії, відкритій за посиланням, браузер не пускає застосунок до сайту. У застосунку на телефоні тут буде стрічка свіжих новин Dnipro media.
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <ExtLink href={SITE_NEWS} style={{ backgroundColor: c.accent, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
              <T c={c} style={{ color: c.accentInk, fontWeight: '600' }}>Відкрити новини на сайті</T>
            </ExtLink>
            <Btn c={c} kind="secondary" label="Спробувати ще" onPress={load} style={{ minHeight: 46 }} />
          </View>
        </Card>
      ) : null}
      {state.items.map((n) => (
        <ExtLink key={n.id} href={n.link}>
          <Card c={c} style={{ flexDirection: 'row', gap: 12, padding: 12 }}>
            {n.image ? <Image source={{ uri: n.image }} style={{ width: 96, height: 72, borderRadius: 10, backgroundColor: c.chip }} /> : null}
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <T c={c} style={{ fontWeight: '600', fontSize: 15, lineHeight: 20 }} numberOfLines={3}>{n.title}</T>
              <T c={c} style={{ color: c.muted, fontSize: 13 }}>{n.date ? `${fmtDate(n.date.slice(0, 10))}, ${n.date.slice(11, 16)}` : ''}</T>
            </View>
          </Card>
        </ExtLink>
      ))}
    </Screen>
  );
}

// ---------------- Налаштування ----------------
export function SettingsScreen({ c, settings, onChange, onReset, onPreview, alertOn, onToggleAlert }) {
  const set = (patch) => onChange({ ...settings, ...patch });
  return (
    <Screen c={c}>
      <T c={c} display style={{ fontSize: 24, lineHeight: 30 }}>Налаштування</T>

      <View style={{ gap: 10 }}>
        <Label c={c}>Мій графік</Label>
        <Segmented c={c} options={OP_OPTIONS} value={settings.operator} onChange={(v) => set({ operator: v })} />
        <QueueGrid c={c} queues={QUEUES} value={settings.queue} onChange={(q) => set({ queue: q })} />
      </View>

      <View style={{ gap: 10 }}>
        <Label c={c}>Сповіщення</Label>
        <Card c={c} style={{ paddingVertical: 6 }}>
          <ToggleRow c={c} label="Новий графік і зміни" hint={`Для черги ${settings.queue}`} value={settings.notifyChanges} onChange={(v) => set({ notifyChanges: v })} />
          <View style={{ height: 1, backgroundColor: c.line }} />
          <ToggleRow c={c} label="Екстрені відключення" value={settings.notifyEmergency} onChange={(v) => set({ notifyEmergency: v })} />
        </Card>
        <T c={c} style={{ fontWeight: '600' }}>Нагадувати перед відключенням</T>
        <Segmented c={c} options={REMIND_OPTIONS} value={settings.remind} onChange={(v) => set({ remind: v })} />
        <T c={c} style={{ color: c.muted, fontSize: 14 }}>
          {notificationsAvailable
            ? 'Нагадування перед відключенням уже працюють — поки за демо-графіком. Сповіщення про новий графік і екстрені відключення запрацюють, коли підключимо справжні дані.'
            : 'У вебверсії сповіщення зʼявляються лише всередині застосунку. На телефоні вони приходять як звичайні сповіщення.'}
        </T>
      </View>

      <View style={{ gap: 10 }}>
        <Label c={c}>Подивитися, як це виглядатиме</Label>
        <Btn c={c} kind="secondary" label="Сповіщення про новий графік" onPress={() => onPreview('schedule')} />
        <Btn c={c} kind="secondary" label="Нагадування перед відключенням" onPress={() => onPreview('remind')} />
        <Btn c={c} kind="secondary" label={alertOn ? 'Прибрати приклад екстрених відключень' : 'Показати приклад екстрених відключень'} onPress={onToggleAlert} />
      </View>

      <View style={{ gap: 10 }}>
        <Label c={c}>Про застосунок</Label>
        <Card c={c} style={{ gap: 10 }}>
          <T c={c}>Застосунок Dnipro media. Графіки беремо з офіційних каналів ЦЕК і ДТЕК, редакція перевіряє дані.</T>
          <T c={c} style={{ color: c.muted, fontSize: 14 }}>
            Застосунок не просить імені, телефону чи адреси й не визначає місцезнаходження. Оператор і черга зберігаються лише на цьому телефоні.
          </T>
          <ExtLink href={SITE}>
            <T c={c} style={{ color: c.accent, fontWeight: '600' }}>dnipro.media ›</T>
          </ExtLink>
        </Card>
        <Btn c={c} kind="secondary" label="Почати налаштування спочатку" onPress={onReset} />
        <T c={c} style={{ color: c.muted, fontSize: 13, textAlign: 'center' }}>Тестова версія 0.1 · демо-графіки</T>
      </View>
    </Screen>
  );
}
