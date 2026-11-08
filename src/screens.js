import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { BrandCross, Btn, Card, ExtLink, Label, Legend, QueueGrid, Segmented, Strip, T, ToggleRow } from './components';
import { CHECK_URLS, OPERATORS, QUEUES, SITE, SITE_NEWS, loadNews, norm, statusNow } from './data';
import { notificationsAvailable, openNotificationSettings } from './reminders';
import { addDays, fmtDate, fmtDuration, fmtUpdated, weekday } from './time';

const OP_OPTIONS = [
  { value: 'cek', label: 'ЦЕК' },
  { value: 'dtek', label: 'ДТЕК' },
];

const REMIND_OPTIONS = [
  { value: 0, label: 'Ні' },
  { value: 5, label: '5 хв' },
  { value: 10, label: '10 хв' },
  { value: 15, label: '15 хв' },
  { value: 30, label: '30 хв' },
];

const OP_FULL = {
  cek: 'Центральна енергетична компанія',
  dtek: 'ДТЕК Дніпровські електромережі',
};

function Screen({ c, children }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
      {children}
    </ScrollView>
  );
}

// Велика кнопка «Я не знаю…»
function UnsureButton({ c, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ minHeight: 56, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: c.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, opacity: pressed ? 0.7 : 1 })}
    >
      <T c={c} style={{ color: c.accent, fontWeight: '700', textAlign: 'center' }}>{label}</T>
    </Pressable>
  );
}

// ---------------- Як дізнатися постачальника й чергу ----------------
function CheckLink({ c, op, primary }) {
  return (
    <ExtLink href={CHECK_URLS[op]} style={{ backgroundColor: primary ? c.accent : c.chip, borderRadius: 14, minHeight: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
      <T c={c} style={{ color: primary ? c.accentInk : c.ink, fontWeight: '700', textAlign: 'center' }}>Перевірити на сайті {OPERATORS[op].short}</T>
    </ExtLink>
  );
}

export function HelpScreen({ c, topic, operator = 'cek', onBack }) {
  const isOperator = topic === 'operator';
  const first = isOperator ? 'cek' : operator;
  const second = first === 'cek' ? 'dtek' : 'cek';
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 16, flexGrow: 1 }}>
      <Pressable onPress={onBack} accessibilityRole="button" style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
        <T c={c} style={{ color: c.accent, fontWeight: '600' }}>‹ Назад</T>
      </Pressable>
      <T c={c} display style={{ fontSize: 24, lineHeight: 30 }}>
        {isOperator ? 'Як дізнатися свого постачальника' : 'Як дізнатися свою чергу'}
      </T>
      <T c={c} style={{ color: c.muted }}>
        {isOperator
          ? 'Подивіться рахунок за світло або договір: там вказано ЦЕК чи ДТЕК. Або введіть свою адресу на сайті оператора — якщо будинок у його мережі, сайт покаже чергу.'
          : `Введіть свою адресу на офіційному сайті ${OPERATORS[operator].short} — він покаже номер черги, наприклад 3.2. Потім поверніться й оберіть її.`}
      </T>
      <CheckLink c={c} op={first} primary />
      <CheckLink c={c} op={second} />
      <View style={{ flex: 1 }} />
      <Btn c={c} kind="secondary" label="Повернутися" onPress={onBack} />
    </ScrollView>
  );
}

// ---------------- Швидка зміна черги ----------------
export function QueuePicker({ c, visible, settings, onPick, onClose }) {
  const [op, setOp] = useState(settings?.operator || 'cek');
  const [help, setHelp] = useState(false);
  useEffect(() => { if (visible) { setOp(settings?.operator || 'cek'); setHelp(false); } }, [visible]);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Закрити" />
        <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' }}>
          {help ? (
            <HelpScreen c={c} topic="queue" operator={op} onBack={() => setHelp(false)} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 28, gap: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T c={c} display style={{ fontSize: 22, lineHeight: 28 }}>Моя черга</T>
                <Pressable onPress={onClose} accessibilityRole="button" style={{ padding: 6 }}>
                  <T c={c} style={{ color: c.accent, fontWeight: '600' }}>Закрити</T>
                </Pressable>
              </View>
              <Segmented c={c} options={[{ value: 'cek', label: 'ЦЕК' }, { value: 'dtek', label: 'ДТЕК' }]} value={op} onChange={setOp} />
              <QueueGrid c={c} queues={QUEUES} value={op === settings?.operator ? settings?.queue : null} onChange={(q) => onPick(op, q)} />
              <UnsureButton c={c} label="Я не знаю свою чергу" onPress={() => setHelp(true)} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ---------------- Перший запуск ----------------
function Intro({ c, onStart }) {
  const item = (title, text) => (
    <View style={{ gap: 1 }}>
      <T c={c} style={{ fontWeight: '700', fontSize: 15, lineHeight: 20 }}>{title}</T>
      <T c={c} style={{ color: c.muted, fontSize: 14, lineHeight: 19 }}>{text}</T>
    </View>
  );
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 14, flexGrow: 1 }}>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <BrandCross size={25} color={c.yellow} />
          <T c={c} display style={{ fontSize: 28, lineHeight: 34, fontWeight: '900' }}>Світло</T>
        </View>
        <T c={c} style={{ fontSize: 16, lineHeight: 21 }}>Графіки відключень для Дніпра від Dnipro media</T>
      </View>
      <View style={{ backgroundColor: c.on, borderRadius: 20, padding: 16, gap: 10 }}>
        <T c={c} style={{ fontWeight: '700', fontSize: 15, color: c.onText }}>Як це працює</T>
        {[
          ['Оберіть свою чергу', 'Побачите, коли сьогодні й завтра буде світло, а коли — відключення.'],
          ['Дізнавайтеся першими', 'Надішлемо сповіщення, щойно ЦЕК чи ДТЕК опублікує або змінить графік.'],
          ['Не пропустіть відключення', 'Нагадаємо заздалегідь — за 5, 10, 15 чи 30 хвилин.'],
        ].map(([t, d]) => (
          <View key={t} style={{ gap: 1 }}>
            <T c={c} style={{ fontWeight: '700', fontSize: 15, lineHeight: 20, color: c.onText }}>{t}</T>
            <T c={c} style={{ fontSize: 14, lineHeight: 19, color: c.onSub }}>{d}</T>
          </View>
        ))}
      </View>
      {item('Дані з офіційних джерел', 'Графіки беремо з каналів ЦЕК і ДТЕК, редакція Dnipro media перевіряє їх.')}
      {item('Без реєстрації', 'Не просимо імені, телефону чи адреси. Налаштування зберігаються лише на вашому телефоні.')}
      <View style={{ flex: 1 }} />
      <Btn c={c} label="Почати" onPress={onStart} />
    </ScrollView>
  );
}

export function Onboarding({ c, initial, onDone }) {
  const [step, setStep] = useState(-1); // -1 — вступ
  const [help, setHelp] = useState(null); // 'operator' | 'queue'
  const [s, setS] = useState(initial);
  const total = 3;

  if (step === -1) return <Intro c={c} onStart={() => setStep(0)} />;
  if (help) return <HelpScreen c={c} topic={help} operator={s.operator} onBack={() => setHelp(null)} />;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20, flexGrow: 1 }}>
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Крок ${step + 1} з ${total}`}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? c.accent : c.line }} />
        ))}
      </View>

      {step === 0 ? (
        <View style={{ gap: 14 }}>
          <T c={c} display style={{ fontSize: 22, lineHeight: 28 }}>Хто постачає вам світло?</T>
          <T c={c} style={{ color: c.muted }}>Оператора видно в рахунку за електроенергію або в договорі.</T>
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
                <T c={c} style={{ color: c.muted, fontSize: 15 }}>{OP_FULL[op]}</T>
              </Pressable>
            );
          })}
          <UnsureButton c={c} label="Я не знаю свого постачальника" onPress={() => setHelp('operator')} />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: 14 }}>
          <T c={c} display style={{ fontSize: 22, lineHeight: 28 }}>Ваша черга</T>
          <T c={c} style={{ color: c.muted }}>Оберіть чергу {OPERATORS[s.operator].short}. Її можна змінити будь-коли в налаштуваннях.</T>
          <QueueGrid c={c} queues={QUEUES} value={s.queue} onChange={(q) => setS({ ...s, queue: q })} />
          <UnsureButton c={c} label="Я не знаю свою чергу" onPress={() => setHelp('queue')} />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: 14 }}>
          <T c={c} display style={{ fontSize: 22, lineHeight: 28 }}>Сповіщення</T>
          <T c={c} style={{ color: c.muted }}>Надсилатимемо лише те, що стосується черги {s.queue}, зі стандартним звуком сповіщення.</T>
          <Card c={c} style={{ paddingVertical: 6 }}>
            <ToggleRow c={c} label="Новий графік і зміни" hint="Щойно оператор опублікує або змінить графік" value={s.notifyChanges} onChange={(v) => setS({ ...s, notifyChanges: v })} />
            <ToggleRow c={c} label="Екстрені відключення" hint="Коли графіки перестають діяти" value={s.notifyEmergency} onChange={(v) => setS({ ...s, notifyEmergency: v })} />
          </Card>
          <T c={c} style={{ fontWeight: '600' }}>Нагадувати перед відключенням</T>
          <Segmented c={c} options={REMIND_OPTIONS} value={s.remind} onChange={(v) => setS({ ...s, remind: v })} />
          <T c={c} style={{ fontWeight: '600' }}>Нагадувати перед увімкненням світла</T>
          <Segmented c={c} options={REMIND_OPTIONS} value={s.remindOn || 0} onChange={(v) => setS({ ...s, remindOn: v })} />
        </View>
      ) : null}

      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn c={c} kind="secondary" label="Назад" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />
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
function StatusCard({ c, st, op, emergency }) {
  let title; let line; let extra; let dark = false;
  if (emergency) {
    // Під час екстрених відключень графіки не діють — не обіцяємо світло за графіком.
    return (
      <View style={{ backgroundColor: c.warn, borderRadius: 22, padding: 20, gap: 6 }} accessibilityRole="summary">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' }} />
          <T c={c} style={{ color: '#FFFFFF', fontSize: 14 }}>Зараз</T>
        </View>
        <T c={c} display style={{ color: '#FFFFFF', fontSize: 30, lineHeight: 36, fontWeight: '900' }}>Екстрені відключення</T>
        <T c={c} style={{ color: '#FFFFFF', fontSize: 18, lineHeight: 24, fontWeight: '600' }}>Графіки {op} зараз не діють</T>
      </View>
    );
  }
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
    line = `Графік зʼявиться тут, щойно ${op} його опублікує`;
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
        <T c={c} style={{ fontWeight: '700' }}>Графік ще не опублікували</T>
        <T c={c} style={{ color: c.muted }}>Стежте за оновленнями: графік зʼявиться тут, щойно {op} його опублікує.</T>
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
  // Сьогодні показуємо лише те, що ще попереду; минулих відключень у списку немає.
  const shown = nowMin == null ? iv : iv.filter((i) => i.e > nowMin);
  return (
    <Card c={c} style={{ gap: 14 }}>
      <Strip c={c} intervals={iv} nowMin={nowMin} />
      <Legend c={c} />
      {!iv.length ? (
        <>
          <View style={{ height: 1, backgroundColor: c.line }} />
          <T c={c} style={{ fontWeight: '600' }}>Відключень не заплановано</T>
        </>
      ) : shown.length ? (
        <>
          <View style={{ height: 1, backgroundColor: c.line }} />
          <View style={{ gap: 2 }}>
            {nowMin != null ? <Label c={c}>Далі за графіком</Label> : null}
            {shown.map((i, k) => {
              const active = nowMin != null && nowMin >= i.s && nowMin < i.e;
              return (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                  <T c={c} display style={{ fontSize: 20, lineHeight: 26, fontVariant: ['tabular-nums'] }}>{i.from}–{i.to}</T>
                  <T c={c} style={{ color: active ? c.now : c.muted, fontWeight: active ? '700' : '400', fontSize: 15 }}>
                    {active ? 'триває' : fmtDuration(i.e - i.s)}
                  </T>
                </View>
              );
            })}
            {nowMin == null ? <T c={c} style={{ color: c.muted, fontSize: 14, marginTop: 4 }}>Разом без світла: {fmtDuration(total)}</T> : null}
          </View>
        </>
      ) : null}
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

export function AlertBanner({ c, alert }) {
  if (!alert) return null;
  return (
    <View style={{ backgroundColor: c.warnSoft, borderRadius: 18, padding: 16, gap: 6, borderWidth: 1, borderColor: c.warn }} accessibilityRole="alert">
      <T c={c} style={{ color: c.warn, fontWeight: '700', fontSize: 14, letterSpacing: 0.4, textTransform: 'uppercase' }}>
        {alert.title}
      </T>
      <T c={c} style={{ fontWeight: '600' }}>{alert.text}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <T c={c} style={{ color: c.muted, fontSize: 14 }}>{alert.at ? `${fmtDate(alert.at.slice(0, 10))}, ${alert.at.slice(11, 16)}` : ''}</T>
        {alert.url ? (
          <ExtLink href={alert.url}>
            <T c={c} style={{ color: c.warn, fontWeight: '700' }}>Читати новину ›</T>
          </ExtLink>
        ) : null}
      </View>
    </View>
  );
}

export function MyScreen({ c, data, settings, now, alerts = [], onChangeQueue }) {
  const [which, setWhich] = useState('today');
  const op = OPERATORS[settings.operator];
  const days = data?.operators?.[settings.operator]?.days || {};
  const today = now.date;
  const tomorrow = addDays(today, 1);
  const st = statusNow(days[today], days[tomorrow], settings.queue, now.minutes);
  const showDate = which === 'today' ? today : tomorrow;
  // Екстрені відключення (з новини плагіна або повідомлення редакції) змінюють головний статус.
  const emergency = alerts.find((a) => (a.kind || 'emergency') === 'emergency') || null;

  return (
    <Screen c={c}>
      {alerts.map((a) => <AlertBanner key={a.id} c={c} alert={a} />)}
      <Pressable onPress={onChangeQueue} accessibilityRole="button" accessibilityLabel="Змінити чергу"
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Label c={c}>{op.long}</Label>
          <T c={c} display style={{ fontSize: 24, lineHeight: 30 }}>Черга {settings.queue}</T>
        </View>
        <T c={c} style={{ color: c.accent, fontWeight: '600' }}>Змінити</T>
      </Pressable>

      <StatusCard c={c} st={st} op={op.short} emergency={emergency} />

      <Segmented c={c} value={which} onChange={setWhich} options={[
        { value: 'today', label: 'Сьогодні', sub: fmtDate(today) },
        { value: 'tomorrow', label: 'Завтра', sub: fmtDate(tomorrow) },
      ]} />
      <T c={c} style={{ color: c.muted, marginTop: -6 }}>{weekday(showDate)}, {fmtDate(showDate)}</T>
      <DayBlock c={c} day={days[showDate]} queue={settings.queue} nowMin={which === 'today' ? now.minutes : null} op={op.short} today={today} />

      <ExtLink href={CHECK_URLS[settings.operator]}>
        <Card c={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T c={c} style={{ fontWeight: '700' }}>Перевірити свою чергу</T>
            <T c={c} style={{ color: c.muted, fontSize: 14 }}>За адресою на офіційному сайті {op.short}</T>
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
        <Card c={c} style={{ gap: 4 }}><T c={c} style={{ fontWeight: '700' }}>Графік на {fmtDate(date)} ще не опублікували</T><T c={c} style={{ color: c.muted }}>Стежте за оновленнями.</T></Card>
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
            Перевірте підключення до інтернету й спробуйте ще раз.
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
      {!state.loading ? (
        <ExtLink href={SITE_NEWS} style={{ backgroundColor: c.chip, borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center' }}>
          <T c={c} style={{ fontWeight: '700' }}>Усі новини Дніпра на Dnipro media ›</T>
        </ExtLink>
      ) : null}
    </Screen>
  );
}

// ---------------- Налаштування ----------------
export function SettingsScreen({ c, settings, onChange, onReset, onPreview, onChangeQueue }) {
  const set = (patch) => onChange({ ...settings, ...patch });
  return (
    <Screen c={c}>
      <T c={c} display style={{ fontSize: 24, lineHeight: 30 }}>Налаштування</T>

      <View style={{ gap: 10 }}>
        <Label c={c}>Мій графік</Label>
        <Pressable onPress={onChangeQueue} accessibilityRole="button" accessibilityLabel="Змінити чергу">
          <Card c={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T c={c} style={{ color: c.muted, fontSize: 14 }}>{OPERATORS[settings.operator].long}</T>
              <T c={c} display style={{ fontSize: 22, lineHeight: 28 }}>Черга {settings.queue}</T>
            </View>
            <T c={c} style={{ color: c.accent, fontWeight: '700' }}>Змінити</T>
          </Card>
        </Pressable>
      </View>

      <View style={{ gap: 10 }}>
        <Label c={c}>Сповіщення</Label>
        <Card c={c} style={{ paddingVertical: 6 }}>
          <ToggleRow c={c} label="Новий графік і зміни" hint={`Для черги ${settings.queue}`} value={settings.notifyChanges} onChange={(v) => set({ notifyChanges: v })} />
          <View style={{ height: 1, backgroundColor: c.line }} />
          <ToggleRow c={c} label="Екстрені відключення" hint="Окремий гучніший сигнал і повідомлення на головному екрані" value={settings.notifyEmergency} onChange={(v) => set({ notifyEmergency: v })} />
        </Card>
        <T c={c} style={{ fontWeight: '600' }}>Нагадувати перед відключенням</T>
        <Segmented c={c} options={REMIND_OPTIONS} value={settings.remind} onChange={(v) => set({ remind: v })} />
        <T c={c} style={{ fontWeight: '600' }}>Нагадувати перед увімкненням світла</T>
        <Segmented c={c} options={REMIND_OPTIONS} value={settings.remindOn || 0} onChange={(v) => set({ remindOn: v })} />
        <Btn c={c} label="Перевірити сповіщення" onPress={onPreview} />
        <T c={c} style={{ color: c.muted, fontSize: 14, lineHeight: 19 }}>
          Сповіщення приходять зі звуком і вібрацією. Гучність регулюють кнопки гучності телефона.
        </T>
        {notificationsAvailable && Platform.OS === 'android' ? (
          <Btn c={c} kind="secondary" label="Налаштування сповіщень телефона" onPress={openNotificationSettings} />
        ) : null}
      </View>

      <View style={{ gap: 10 }}>
        <Label c={c}>Про застосунок</Label>
        <Card c={c} style={{ gap: 10 }}>
          <T c={c}>Застосунок Dnipro media. Графіки беремо з офіційних каналів ЦЕК і ДТЕК, редакція перевіряє дані.</T>
          <T c={c} style={{ color: c.muted, fontSize: 14 }}>
            Застосунок не просить імені, телефону чи адреси й не визначає місцезнаходження. Щоб надсилати сповіщення, він передає на сайт Dnipro media лише анонімний код сповіщень, оператора й чергу.
          </T>
          <ExtLink href={SITE}>
            <T c={c} style={{ color: c.accent, fontWeight: '600' }}>dnipro.media ›</T>
          </ExtLink>
        </Card>
        <Btn c={c} kind="secondary" label="Почати налаштування спочатку" onPress={onReset} />
      </View>
    </Screen>
  );
}
