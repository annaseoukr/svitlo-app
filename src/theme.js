import { useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

const web = Platform.OS === 'web';

// Фірмовий стиль Dnipro media.
// Кольори: чорний #000000, синій #496E99, жовтий #E8DE6D, мʼятний #B7CCBA, помаранчевий #D75632, білий.
// Шрифт: Work Sans (Regular, Medium, Semibold, Bold, Black).
// У Work Sans немає кирилиці: цифри й латиниця — Work Sans, українські літери — системний шрифт телефона.
const FAMILY = web ? '"Work Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' : undefined;
export const fonts = { display: FAMILY, body: FAMILY };

const BLACK = '#000000';
const WHITE = '#FFFFFF';
const BLUE = '#496E99';
const YELLOW = '#E8DE6D';
const MINT = '#B7CCBA';
const ORANGE = '#D75632';

const light = {
  bg: WHITE, surface: WHITE, ink: BLACK, muted: 'rgba(0,0,0,0.62)', line: 'rgba(0,0,0,0.12)',
  accent: BLUE, accentInk: WHITE, accentSoft: 'rgba(73,110,153,0.14)',
  on: MINT, onText: BLACK, onSub: 'rgba(0,0,0,0.66)',
  off: BLACK, offCard: BLACK, offInk: WHITE, offText: 'rgba(255,255,255,0.74)',
  warn: ORANGE, warnSoft: 'rgba(215,86,50,0.10)', chip: 'rgba(0,0,0,0.06)', segActive: WHITE,
  tick: 'rgba(0,0,0,0.22)', now: ORANGE, yellow: YELLOW, toastBg: WHITE,
};

const dark = {
  bg: BLACK, surface: 'rgba(255,255,255,0.07)', ink: WHITE, muted: 'rgba(255,255,255,0.66)', line: 'rgba(255,255,255,0.16)',
  accent: YELLOW, accentInk: BLACK, accentSoft: 'rgba(232,222,109,0.16)',
  on: MINT, onText: BLACK, onSub: 'rgba(0,0,0,0.66)',
  off: BLACK, offCard: 'rgba(255,255,255,0.08)', offInk: WHITE, offText: 'rgba(255,255,255,0.74)',
  warn: ORANGE, warnSoft: 'rgba(215,86,50,0.18)', chip: 'rgba(255,255,255,0.10)', segActive: 'rgba(255,255,255,0.22)',
  tick: 'rgba(0,0,0,0.25)', now: ORANGE, yellow: YELLOW, toastBg: BLACK,
};

function readWeb() {
  try {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch (e) { return 'light'; }
}

export function useColors() {
  const sys = useColorScheme();
  const [w, setW] = useState(web ? readWeb() : null);
  useEffect(() => {
    if (!web) return undefined;
    const upd = () => setW(readWeb());
    let mq; let mo;
    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', upd); } catch (e) { /* */ }
    try { mo = new MutationObserver(upd); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) { /* */ }
    return () => { try { mq?.removeEventListener('change', upd); mo?.disconnect(); } catch (e) { /* */ } };
  }, []);
  const scheme = web ? w : sys === 'dark' ? 'dark' : 'light';
  return scheme === 'dark' ? dark : light;
}
