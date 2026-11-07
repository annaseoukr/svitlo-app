import { Linking, Platform, Pressable, Switch, Text, View } from 'react-native';
import { fonts } from './theme';

export function T({ c, style, display, children, ...rest }) {
  return (
    <Text style={[{ color: c.ink, fontFamily: display ? fonts.display : fonts.body, fontWeight: display ? '700' : '400', fontSize: 16, lineHeight: 22 }, style]} {...rest}>
      {children}
    </Text>
  );
}

// Посилання назовні: у вебверсії — справжнє <a>, у застосунку — відкриває браузер.
export function ExtLink({ href, style, children, accessibilityLabel }) {
  if (Platform.OS === 'web') {
    return (
      <Pressable href={href} hrefAttrs={{ target: '_blank', rel: 'noopener' }} style={style} accessibilityRole="link" accessibilityLabel={accessibilityLabel}>
        {children}
      </Pressable>
    );
  }
  return (
    <Pressable onPress={() => Linking.openURL(href)} style={style} accessibilityRole="link" accessibilityLabel={accessibilityLabel}>
      {children}
    </Pressable>
  );
}

export function Card({ c, style, children }) {
  return (
    <View style={[{ backgroundColor: c.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: c.line }, style]}>
      {children}
    </View>
  );
}

export function Btn({ c, label, onPress, kind = 'primary', style }) {
  const primary = kind === 'primary';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [{
        minHeight: 52, borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
        backgroundColor: primary ? c.accent : c.chip, opacity: pressed ? 0.8 : 1,
      }, style]}
    >
      <T c={c} style={{ color: primary ? c.accentInk : c.ink, fontWeight: '600', textAlign: 'center' }}>{label}</T>
    </Pressable>
  );
}

// Перемикач варіантів (Сьогодні / Завтра, ЦЕК / ДТЕК)
export function Segmented({ c, options, value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.chip, borderRadius: 14, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{ flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: active ? c.segActive : 'transparent' }}
          >
            <T c={c} style={{ fontSize: 15, fontWeight: active ? '700' : '500', color: active ? c.ink : c.muted, textAlign: 'center' }}>{o.label}</T>
            {o.sub ? <T c={c} style={{ fontSize: 12, lineHeight: 16, color: c.muted }}>{o.sub}</T> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// Сітка черг 1.1 … 6.2
export function QueueGrid({ c, queues, value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {queues.map((q) => {
        const active = q === value;
        return (
          <Pressable
            key={q}
            onPress={() => onChange(q)}
            accessibilityRole="button"
            accessibilityLabel={`Черга ${q}`}
            accessibilityState={{ selected: active }}
            style={{ width: '31%', flexGrow: 1, minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.accent : c.surface, borderWidth: 1, borderColor: active ? c.accent : c.line }}
          >
            <T c={c} display style={{ fontSize: 20, lineHeight: 26, color: active ? c.accentInk : c.ink }}>{q}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({ c, label, hint, value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T c={c} style={{ fontWeight: '600' }}>{label}</T>
        {hint ? <T c={c} style={{ fontSize: 14, lineHeight: 19, color: c.muted }}>{hint}</T> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.accent, false: c.line }} thumbColor="#FFFFFF" activeThumbColor="#FFFFFF" accessibilityLabel={label} />
    </View>
  );
}

export function Label({ c, children }) {
  return <T c={c} style={{ fontSize: 13, lineHeight: 18, letterSpacing: 0.6, textTransform: 'uppercase', color: c.muted, fontWeight: '600' }}>{children}</T>;
}

// Смуга доби 00:00–24:00: зелене — світло є, темне — відключення, помаранчева риска — зараз.
export function Strip({ c, intervals, nowMin, height = 30, labels = true, radius = 8 }) {
  return (
    <View>
      <View style={{ height, borderRadius: radius, backgroundColor: c.on, overflow: 'hidden' }}>
        {intervals.map((iv, k) => (
          <View key={k} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(iv.s / 1440) * 100}%`, width: `${((iv.e - iv.s) / 1440) * 100}%`, backgroundColor: c.off }} />
        ))}
        {[6, 12, 18].map((h) => (
          <View key={h} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(h / 24) * 100}%`, width: 1, backgroundColor: c.tick }} />
        ))}
        {nowMin != null ? (
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${(nowMin / 1440) * 100}%`, width: 3, marginLeft: -1, backgroundColor: c.now }} />
        ) : null}
      </View>
      {labels ? (
        <View style={{ height: 18, marginTop: 4 }}>
          {[0, 6, 12, 18, 24].map((h) => (
            <T key={h} c={c} style={[{ position: 'absolute', fontSize: 12, lineHeight: 16, color: c.muted, width: 40, fontVariant: ['tabular-nums'] },
              h === 0 ? { left: 0 } : h === 24 ? { right: 0, textAlign: 'right' } : { left: `${(h / 24) * 100}%`, marginLeft: -20, textAlign: 'center' }]}
            >
              {String(h).padStart(2, '0')}:00
            </T>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function Legend({ c }) {
  const item = (color, text) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color }} />
      <T c={c} style={{ fontSize: 13, lineHeight: 18, color: c.muted }}>{text}</T>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      {item(c.on, 'Світло є')}
      {item(c.off, 'Відключення')}
      {item(c.now, 'Зараз')}
    </View>
  );
}

// Фірмовий хрестик Dnipro media: сітка 5×5 з вирізаним центром (пропорції з логотипа).
const CROSS = [[0, 2], [1, 1], [1, 2], [1, 3], [2, 0], [2, 1], [2, 3], [2, 4], [3, 1], [3, 2], [3, 3], [4, 2]];
export function BrandCross({ size = 25, color = '#E8DE6D' }) {
  const u = Math.round(size / 5);
  return (
    <View style={{ width: u * 5, height: u * 5 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {CROSS.map(([r, col]) => (
        <View key={`${r}-${col}`} style={{ position: 'absolute', left: col * u, top: r * u, width: u, height: u, backgroundColor: color }} />
      ))}
    </View>
  );
}
