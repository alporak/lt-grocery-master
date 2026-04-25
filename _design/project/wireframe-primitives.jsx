// Shared low-fi wireframe primitives.
// Philosophy: Helvetica, thin 1px hairlines, lots of whitespace.
// Ink = #111. Muted = #9a9a9a. Fill = #f2f2f0. Accent = a muted blue for emphasis only.

const WF = {
  ink: '#111',
  sub: '#6b6b6b',
  mute: '#a8a8a6',
  line: '#cfcecb',
  hair: '#e4e3de',
  fill: '#f4f3ef',
  chip: '#ececea',
  paper: '#fbfaf6',
  accent: '#3b5bdb',
  accentSoft: '#e9edfb',
  pink: '#d98ba3', // hint only, used sparingly
  font: 'Helvetica, "Helvetica Neue", Arial, sans-serif',
  mono: '"SF Mono", "JetBrains Mono", Menlo, Consolas, monospace',
};

// Reset-safe artboard shell (locks typography so host styles don't leak in).
function WFFrame({ children, style, bg = '#fff' }) {
  return (
    <div style={{
      width: '100%', height: '100%', background: bg,
      color: WF.ink, fontFamily: WF.font, fontSize: 13, lineHeight: 1.3,
      boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
      ...style,
    }}>{children}</div>
  );
}

// Phone chrome: iPhone-ish rounded bezel with thin status bar.
function Phone({ children, bg = '#fff' }) {
  return (
    <div style={{
      width: '100%', height: '100%', background: '#222', padding: 10,
      boxSizing: 'border-box', borderRadius: 36, position: 'relative',
      fontFamily: WF.font,
    }}>
      <div style={{
        width: '100%', height: '100%', background: bg, borderRadius: 28,
        overflow: 'hidden', position: 'relative', color: WF.ink, fontSize: 12,
      }}>
        {/* status bar */}
        <div style={{
          height: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 18px', fontSize: 11, fontWeight: 600,
        }}>
          <span>9:41</span>
          <span style={{ width: 80, height: 18, background: '#111', borderRadius: 12 }} />
          <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <Box w={14} h={8} r={2} /><Box w={14} h={8} r={2} />
            <Box w={20} h={8} r={2} />
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

// Desktop browser chrome.
function Browser({ children, url = 'grocery.local', bg = '#fff' }) {
  return (
    <div style={{
      width: '100%', height: '100%', background: '#e9e8e3', padding: 0,
      boxSizing: 'border-box', borderRadius: 8, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', fontFamily: WF.font,
      border: `1px solid ${WF.line}`,
    }}>
      <div style={{
        height: 32, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px',
        borderBottom: `1px solid ${WF.line}`, flexShrink: 0,
      }}>
        <span style={{ width: 10, height: 10, borderRadius: 5, background: '#ddd' }} />
        <span style={{ width: 10, height: 10, borderRadius: 5, background: '#ddd' }} />
        <span style={{ width: 10, height: 10, borderRadius: 5, background: '#ddd' }} />
        <div style={{
          flex: 1, height: 18, background: '#fff', borderRadius: 4, marginLeft: 12,
          display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 10, color: WF.sub,
          fontFamily: WF.mono, border: `1px solid ${WF.hair}`,
        }}>{url}</div>
      </div>
      <div style={{ flex: 1, background: bg, overflow: 'hidden', position: 'relative', color: WF.ink }}>
        {children}
      </div>
    </div>
  );
}

// Primitives --------------------------------------------------

function Box({ w, h, r = 0, bg = WF.fill, style }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: bg, flexShrink: 0, ...style }} />;
}

// Hatched/striped placeholder for imagery.
function ImgPlaceholder({ w = '100%', h = 60, label, style }) {
  const stripe = `repeating-linear-gradient(45deg, ${WF.hair} 0 6px, transparent 6px 12px)`;
  return (
    <div style={{
      width: w, height: h, background: stripe, border: `1px solid ${WF.line}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: WF.mono, fontSize: 9, color: WF.sub, letterSpacing: 0.5,
      textTransform: 'uppercase', ...style,
    }}>{label}</div>
  );
}

// Generic rule line.
function Rule({ style }) {
  return <div style={{ height: 1, background: WF.hair, width: '100%', ...style }} />;
}

// Text placeholder bars.
function TextLine({ w = '100%', h = 6, style }) {
  return <div style={{ width: w, height: h, background: WF.chip, borderRadius: 1, ...style }} />;
}

// Button
function Btn({ children, primary, small, style, block }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: small ? '4px 10px' : '8px 14px',
      fontSize: small ? 10 : 12, fontWeight: 500,
      border: `1px solid ${primary ? WF.ink : WF.line}`,
      background: primary ? WF.ink : '#fff',
      color: primary ? '#fff' : WF.ink,
      borderRadius: 2, width: block ? '100%' : 'auto',
      boxSizing: 'border-box',
      ...style,
    }}>{children}</div>
  );
}

function Chip({ children, active, style }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', padding: '3px 9px',
      fontSize: 10, border: `1px solid ${active ? WF.ink : WF.line}`,
      background: active ? WF.ink : '#fff', color: active ? '#fff' : WF.ink,
      borderRadius: 999, whiteSpace: 'nowrap',
      ...style,
    }}>{children}</div>
  );
}

// Store mark — 1-2 letter monogram in a square.
function StoreMark({ label, size = 22, filled, style }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 3,
      border: `1px solid ${WF.ink}`, background: filled ? WF.ink : '#fff',
      color: filled ? '#fff' : WF.ink, display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 600, letterSpacing: -0.3,
      flexShrink: 0, ...style,
    }}>{label}</div>
  );
}

// Icon — simple SVG stroke icons only.
function Icon({ kind, size = 14, color = WF.ink }) {
  const p = {
    search: 'M11 11l3 3M7 12a5 5 0 100-10 5 5 0 000 10z',
    plus: 'M8 3v10M3 8h10',
    minus: 'M3 8h10',
    cart: 'M2 2h2l2 9h7l2-6H5M6 14a1 1 0 100-2 1 1 0 000 2zM12 14a1 1 0 100-2 1 1 0 000 2z',
    home: 'M2 7l6-5 6 5v7H2z',
    list: 'M3 4h10M3 8h10M3 12h7',
    bell: 'M4 11V7a4 4 0 018 0v4l1 2H3zM7 14h2',
    chart: 'M2 12l4-4 3 3 5-6M2 14h12',
    pin: 'M8 1a4 4 0 014 4c0 3-4 9-4 9S4 8 4 5a4 4 0 014-4zM8 6a1 1 0 100-2 1 1 0 000 2z',
    close: 'M3 3l10 10M13 3L3 13',
    check: 'M3 8l3 3 7-7',
    arrow: 'M3 8h10M10 5l3 3-3 3',
    filter: 'M2 4h12M4 8h8M6 12h4',
    heart: 'M8 13s-5-3-5-7a3 3 0 015-2 3 3 0 015 2c0 4-5 7-5 7z',
    user: 'M8 8a3 3 0 100-6 3 3 0 000 6zM2 14a6 6 0 0112 0',
    settings: 'M8 10a2 2 0 100-4 2 2 0 000 4zM8 2v2M8 12v2M2 8h2M12 8h2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M3.5 12.5L5 11M11 5l1.5-1.5',
    menu: 'M2 4h12M2 8h12M2 12h12',
    cal: 'M3 3h10v10H3zM3 6h10M6 2v3M10 2v3',
    globe: 'M8 1v14M1 8h14M8 1a10 6 0 010 14M8 1a10 6 0 000 14',
    trash: 'M3 4h10M6 4V2h4v2M4 4l1 10h6l1-10',
    info: 'M8 7v4M8 5v.5M8 1a7 7 0 110 14 7 7 0 010-14z',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d={p[kind] || ''} />
    </svg>
  );
}

// Mobile bottom nav ----------------------------------------------
function MobileNav({ active = 'list' }) {
  const items = [
    { k: 'home', i: 'home', l: 'Home' },
    { k: 'search', i: 'search', l: 'Search' },
    { k: 'list', i: 'list', l: 'List' },
    { k: 'map', i: 'pin', l: 'Stores' },
    { k: 'more', i: 'menu', l: 'More' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 52,
      borderTop: `1px solid ${WF.hair}`, background: '#fff',
      display: 'flex', alignItems: 'center', paddingBottom: 6,
    }}>
      {items.map((it) => (
        <div key={it.k} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 3, color: active === it.k ? WF.ink : WF.mute,
        }}>
          <Icon kind={it.i} size={16} color={active === it.k ? WF.ink : WF.mute} />
          <span style={{ fontSize: 9, fontWeight: active === it.k ? 600 : 400 }}>{it.l}</span>
        </div>
      ))}
    </div>
  );
}

// Desktop side nav.
function SideNav({ active = 'list' }) {
  const items = [
    { k: 'home', i: 'home', l: 'Home' },
    { k: 'search', i: 'search', l: 'Search' },
    { k: 'list', i: 'list', l: 'My List' },
    { k: 'map', i: 'pin', l: 'Stores' },
    { k: 'chart', i: 'chart', l: 'Trends' },
    { k: 'settings', i: 'settings', l: 'Settings' },
  ];
  return (
    <div style={{
      width: 170, borderRight: `1px solid ${WF.hair}`, padding: '20px 14px',
      display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0,
      background: WF.paper,
    }}>
      <div style={{ fontWeight: 600, fontSize: 13, letterSpacing: -0.3, marginBottom: 18, padding: '0 6px' }}>
        LT Grocery
      </div>
      {items.map((it) => (
        <div key={it.k} style={{
          display: 'flex', alignItems: 'center', gap: 9, padding: '6px 8px',
          background: active === it.k ? WF.ink : 'transparent',
          color: active === it.k ? '#fff' : WF.ink,
          fontSize: 11, fontWeight: active === it.k ? 500 : 400,
          borderRadius: 2,
        }}>
          <Icon kind={it.i} size={13} color={active === it.k ? '#fff' : WF.ink} />
          {it.l}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: 9, color: WF.mute, padding: '0 6px', lineHeight: 1.4 }}>
        4 stores<br/>last sync 2h ago
      </div>
    </div>
  );
}

// Desktop top bar (alt layout).
function TopBar({ active = 'list' }) {
  const items = ['Home', 'Search', 'My List', 'Compare', 'Stores', 'Trends'];
  return (
    <div style={{
      height: 48, borderBottom: `1px solid ${WF.hair}`, display: 'flex',
      alignItems: 'center', padding: '0 20px', gap: 22, flexShrink: 0, background: '#fff',
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: -0.3, marginRight: 12 }}>LT Grocery</div>
      {items.map((it) => {
        const isActive = it.toLowerCase().includes(active);
        return (
          <div key={it} style={{
            fontSize: 12, color: isActive ? WF.ink : WF.sub,
            fontWeight: isActive ? 600 : 400, borderBottom: isActive ? `2px solid ${WF.ink}` : 'none',
            padding: '14px 0',
          }}>{it}</div>
        );
      })}
      <div style={{ flex: 1 }} />
      <div style={{
        width: 200, height: 26, border: `1px solid ${WF.line}`, borderRadius: 2,
        display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6, color: WF.mute, fontSize: 11,
      }}>
        <Icon kind="search" size={12} color={WF.mute} />
        search groceries…
      </div>
      <Box w={26} h={26} r={13} bg={WF.chip} />
    </div>
  );
}

// Caption under an artboard (inside the card — use sparingly).
function Caption({ children }) {
  return (
    <div style={{
      position: 'absolute', top: 8, left: 8, fontFamily: WF.mono,
      fontSize: 8, color: WF.mute, letterSpacing: 0.5, textTransform: 'uppercase',
      pointerEvents: 'none', zIndex: 10,
    }}>{children}</div>
  );
}

Object.assign(window, {
  WF, WFFrame, Phone, Browser, Box, ImgPlaceholder, Rule, TextLine,
  Btn, Chip, StoreMark, Icon, MobileNav, SideNav, TopBar, Caption,
});
