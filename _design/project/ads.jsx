// Non-intrusive ad placements for the wireframes.
// Ads are clearly labelled "AD · sponsored" and styled as quiet hairline
// containers with striped placeholder imagery — the same visual grammar as
// the rest of the low-fi system. Goal: revenue without disrupting the
// core "find cheapest" UX.

// Small reusable AD label badge.
function AdLabel({ style }) {
  return (
    <span style={{
      fontFamily: WF.mono, fontSize: 8, letterSpacing: 0.8,
      textTransform: 'uppercase', color: WF.sub,
      border: `1px solid ${WF.line}`, padding: '1px 5px',
      background: '#fff', ...style,
    }}>AD · sponsored</span>
  );
}

// Thin inline banner — horizontal, for mobile top/bottom or between sections.
function AdBanner({ small, headline = 'Rokiškio pieno produktai', sub = 'Nauja kolekcija Rimi parduotuvėse · sužinok daugiau →', style }) {
  return (
    <div style={{
      border: `1px solid ${WF.line}`, background: WF.paper,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: small ? '8px 10px' : '10px 12px', position: 'relative',
      ...style,
    }}>
      <div style={{
        width: small ? 28 : 36, height: small ? 28 : 36, flexShrink: 0,
        background: `repeating-linear-gradient(45deg, ${WF.hair} 0 4px, transparent 4px 8px)`,
        border: `1px solid ${WF.line}`,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: small ? 11 : 12, fontWeight: 600, letterSpacing: -0.1 }}>{headline}</div>
        <div style={{ fontSize: small ? 9 : 10, color: WF.sub, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
      </div>
      <AdLabel />
    </div>
  );
}

// Wide leaderboard — desktop header/footer slot.
function AdLeaderboard({ style }) {
  return (
    <div style={{
      border: `1px solid ${WF.line}`, background: WF.paper,
      height: 64, display: 'flex', alignItems: 'center', padding: '0 16px',
      gap: 14, position: 'relative', ...style,
    }}>
      <div style={{
        width: 40, height: 40, flexShrink: 0,
        background: `repeating-linear-gradient(45deg, ${WF.hair} 0 5px, transparent 5px 10px)`,
        border: `1px solid ${WF.line}`,
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Paulig Presidentas · −20% šią savaitę</div>
        <div style={{ fontSize: 10, color: WF.sub, marginTop: 2 }}>Akcija galioja Rimi ir IKI iki balandžio 28 · sponsored by Paulig</div>
      </div>
      <Btn small>Sužinoti →</Btn>
      <AdLabel style={{ position: 'absolute', top: 6, right: 10 }} />
    </div>
  );
}

// Native in-feed card — blends with list/grid items but labelled.
function AdNativeCard({ w, h = 130, style }) {
  return (
    <div style={{
      border: `1px dashed ${WF.line}`, background: '#fff', width: w, height: h,
      display: 'flex', flexDirection: 'column', position: 'relative',
      ...style,
    }}>
      <div style={{
        flex: 1,
        background: `repeating-linear-gradient(45deg, ${WF.hair} 0 5px, transparent 5px 10px)`,
        borderBottom: `1px dashed ${WF.line}`,
      }} />
      <div style={{ padding: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 600 }}>Maxima Deals App</div>
        <div style={{ fontSize: 9, color: WF.sub, marginTop: 1 }}>Atsisiųsk — dar daugiau nuolaidų</div>
      </div>
      <AdLabel style={{ position: 'absolute', top: 6, left: 6 }} />
    </div>
  );
}

// Side rail ad for desktop sidebars.
function AdSideRail({ style }) {
  return (
    <div style={{
      border: `1px solid ${WF.line}`, background: '#fff', padding: 14,
      position: 'relative', ...style,
    }}>
      <AdLabel style={{ position: 'absolute', top: 8, right: 8 }} />
      <div style={{
        width: '100%', height: 110,
        background: `repeating-linear-gradient(45deg, ${WF.hair} 0 5px, transparent 5px 10px)`,
        border: `1px solid ${WF.line}`, marginBottom: 10,
      }} />
      <div style={{ fontSize: 12, fontWeight: 600 }}>Švyturio alus · naujas skonis</div>
      <div style={{ fontSize: 10, color: WF.sub, marginTop: 2, lineHeight: 1.4 }}>
        Ieškok savo artimiausioje parduotuvėje. Vartoti saikingai.
      </div>
      <Btn small block style={{ marginTop: 10 }}>Sužinoti daugiau</Btn>
    </div>
  );
}

// Sponsored result row — fits into any list/table.
function AdSponsoredRow({ style }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', background: WF.paper,
      border: `1px dashed ${WF.line}`, position: 'relative', ...style,
    }}>
      <div style={{
        width: 32, height: 32, flexShrink: 0,
        background: `repeating-linear-gradient(45deg, ${WF.hair} 0 4px, transparent 4px 8px)`,
        border: `1px solid ${WF.line}`,
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 500 }}>Selgros narystė — wholesale kainos</div>
        <div style={{ fontSize: 10, color: WF.sub }}>Registruokis nemokamai · 4000+ prekių</div>
      </div>
      <AdLabel />
    </div>
  );
}

Object.assign(window, {
  AdLabel, AdBanner, AdLeaderboard, AdNativeCard, AdSideRail, AdSponsoredRow,
});
