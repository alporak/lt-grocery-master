// Product detail + price history — 4 variations

// ─── A. Full chart + range selector + store breakdown below
function ProductA_Mobile() {
  return (
    <Phone>
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon kind="close" size={14} />
          <div style={{ flex: 1, fontSize: 11, color: WF.sub, textAlign: 'center' }}>Product</div>
          <Icon kind="heart" size={14} color={WF.sub} />
        </div>
        <ImgPlaceholder h={110} label="sūris džiugas" style={{ marginTop: 12 }} />
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Sūris Džiugas, 40%, 200g</div>
          <div style={{ fontSize: 10, color: WF.sub }}>Rokiškio pieno gamyba · hard cheese</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: WF.mono }}>€3.40</div>
          <div style={{ fontSize: 10, color: WF.sub }}>cheapest @ Rimi</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 10, fontFamily: WF.mono, color: WF.sub }}>−4% vs avg</div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4 }}>Price · 90 days</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['1M','3M','6M','1Y'].map((r, i) => (
              <span key={r} style={{ fontSize: 9, padding: '2px 6px', border: `1px solid ${i===1?WF.ink:WF.hair}`, background: i===1?WF.ink:'#fff', color: i===1?'#fff':WF.sub, fontFamily: WF.mono }}>{r}</span>
            ))}
          </div>
        </div>
        <svg viewBox="0 0 260 100" width="100%" height="100">
          <g stroke={WF.hair} strokeWidth="0.5">
            <line x1="0" y1="20" x2="260" y2="20" /><line x1="0" y1="50" x2="260" y2="50" /><line x1="0" y1="80" x2="260" y2="80" />
          </g>
          <polyline points="0,55 30,52 60,50 80,48 110,40 130,44 160,38 190,42 220,36 260,30" fill="none" stroke={WF.sub} strokeWidth="1" strokeDasharray="2 2"/>
          <polyline points="0,65 30,60 60,58 80,56 110,48 130,52 160,44 190,46 220,42 260,34" fill="none" stroke={WF.ink} strokeWidth="1.4"/>
          <circle cx="260" cy="34" r="3" fill={WF.ink}/>
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: WF.sub, fontFamily: WF.mono, marginTop: 4 }}>
          <span>feb</span><span>mar</span><span>apr</span>
        </div>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4, marginBottom: 6 }}>By store</div>
        {[['RI','Rimi','3.40',true],['IK','IKI','3.55'],['BA','Barbora','3.49'],['PR','PROMO','—']].map(([m,n,p,ch]) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${WF.hair}` }}>
            <StoreMark label={m} size={18} filled={ch} />
            <div style={{ flex: 1, fontSize: 11 }}>{n}</div>
            <div style={{ fontFamily: WF.mono, fontSize: 12, color: p === '—' ? WF.mute : WF.ink, fontWeight: ch ? 700 : 400 }}>{p === '—' ? '—' : '€'+p}</div>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: 52, left: 0, right: 0, padding: '10px 14px', borderTop: `1px solid ${WF.hair}`, background: '#fff' }}>
        <AdBanner small style={{ marginBottom: 8 }} headline="Rokikių sūrių akcija" sub="Rimi −€0.30 iki sekmadienio" />
        <Btn primary block>+ Add to list</Btn>
      </div>
      <MobileNav active="search" />
    </Phone>
  );
}

function ProductA_Desktop() {
  return (
    <Browser url="grocery.local/p/suris-dziugas-200g">
      <div style={{ display: 'flex', height: '100%' }}>
        <SideNav active="search" />
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr', overflow: 'hidden' }}>
          <div style={{ padding: '28px 24px', borderRight: `1px solid ${WF.hair}` }}>
            <ImgPlaceholder h={200} label="sūris džiugas" />
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.4 }}>Rokiškio pieno gamyba</div>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.2, marginTop: 4 }}>Sūris Džiugas, 40%</div>
              <div style={{ fontSize: 12, color: WF.sub }}>200g · hard cheese · LT</div>
            </div>
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 10, color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.4 }}>Cheapest now</div>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: WF.mono }}>€3.40</div>
              <div style={{ fontSize: 11, color: WF.sub }}>at Rimi · €17.00/kg</div>
            </div>
            <Btn primary block style={{ marginTop: 16 }}>+ Add to list</Btn>
            <Btn block style={{ marginTop: 8 }}>⌂ Watch price</Btn>
            <AdSideRail style={{ marginTop: 16 }} />
          </div>

          <div style={{ padding: '28px 36px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Price history</div>
              <div style={{ fontSize: 11, color: WF.sub }}>90 days · 4 stores</div>
              <div style={{ flex: 1 }} />
              {['1M','3M','6M','1Y','All'].map((r, i) => (
                <span key={r} style={{ fontSize: 10, padding: '3px 8px', border: `1px solid ${i===1?WF.ink:WF.hair}`, background: i===1?WF.ink:'#fff', color: i===1?'#fff':WF.sub, fontFamily: WF.mono }}>{r}</span>
              ))}
            </div>
            <svg viewBox="0 0 800 220" width="100%" height="220" style={{ marginTop: 16 }}>
              <g stroke={WF.hair} strokeWidth="0.6">
                {Array.from({ length: 5 }).map((_, i) => <line key={i} x1="40" y1={30 + i*40} x2="790" y2={30 + i*40} />)}
                {Array.from({ length: 7 }).map((_, i) => <line key={`v${i}`} x1={40 + i*125} y1="20" x2={40 + i*125} y2="200" strokeDasharray="2 4" />)}
              </g>
              <g fontFamily="monospace" fontSize="9" fill={WF.sub}>
                <text x="10" y="34">€4.0</text><text x="10" y="74">€3.7</text><text x="10" y="114">€3.4</text><text x="10" y="154">€3.1</text><text x="10" y="194">€2.8</text>
              </g>
              {/* lines */}
              <polyline points="40,120 120,118 200,110 280,108 360,100 440,110 520,90 600,95 680,88 760,82" fill="none" stroke={WF.ink} strokeWidth="2" />
              <polyline points="40,105 120,108 200,100 280,95 360,92 440,100 520,85 600,90 680,85 760,78" fill="none" stroke={WF.sub} strokeWidth="1" strokeDasharray="4 3" />
              <polyline points="40,135 120,130 200,125 280,120 360,115 440,120 520,110 600,115 680,105 760,100" fill="none" stroke={WF.sub} strokeWidth="1" strokeDasharray="1 3" />
              <circle cx="760" cy="82" r="4" fill={WF.ink} />
              <text x="770" y="78" fontFamily="Helvetica" fontSize="11" fontWeight="600">€3.40</text>
              <g fontFamily="Helvetica" fontSize="10" fill={WF.sub}>
                <text x="40" y="216">jan 22</text><text x="200" y="216">feb 14</text><text x="400" y="216">mar 7</text><text x="600" y="216">mar 30</text><text x="740" y="216">apr 22</text>
              </g>
            </svg>
            <div style={{ display: 'flex', gap: 18, fontSize: 11, marginTop: 14 }}>
              {[['Rimi', 'solid', WF.ink],['IKI','dashed', WF.sub],['Barbora','dotted', WF.sub]].map(([n, s, c]) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 18, borderTop: `2px ${s} ${c}`, display: 'inline-block' }} />{n}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 26 }}>
              {[['All-time low','€3.20','Rimi · mar 14'],['All-time high','€3.89','PROMO · dec 4'],['90d avg','€3.56',''],['Volatility','low','stable']].map(([l,v,s]) => (
                <div key={l} style={{ border: `1px solid ${WF.hair}`, padding: 12 }}>
                  <div style={{ fontSize: 10, color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.4 }}>{l}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontFamily: WF.mono }}>{v}</div>
                  {s && <div style={{ fontSize: 10, color: WF.sub }}>{s}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Browser>
  );
}

// ─── B. Sparkline-per-store, compact
function ProductB_Mobile() {
  const mkPts = (seed) => Array.from({ length: 20 }).map((_, i) => `${i * 6},${20 - Math.sin(i * 0.5 + seed) * 5 - i * 0.2}`).join(' ');
  return (
    <Phone>
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Sūris Džiugas 200g</div>
        <div style={{ fontSize: 10, color: WF.sub }}>Rokiškio · 40% hard cheese</div>
      </div>
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4, marginBottom: 8 }}>Per-store trend · 90d</div>
        {[['Rimi','RI','3.40', 1, true],['IKI','IK','3.55', 2],['Barbora','BA','3.49', 3],['PROMO','PR','—', 0]].map(([n, m, p, seed, cheap]) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${WF.hair}` }}>
            <StoreMark label={m} size={20} filled={cheap} />
            <div style={{ width: 64 }}>
              <div style={{ fontSize: 12, fontWeight: cheap ? 600 : 400 }}>{n}</div>
            </div>
            <div style={{ flex: 1 }}>
              {seed ? (
                <svg viewBox="0 0 120 22" width="100%" height="22">
                  <polyline points={mkPts(seed)} fill="none" stroke={cheap ? WF.ink : WF.sub} strokeWidth="1.2" />
                </svg>
              ) : (
                <div style={{ height: 22, background: `repeating-linear-gradient(45deg, ${WF.hair} 0 3px, transparent 3px 6px)` }} />
              )}
            </div>
            <div style={{ fontFamily: WF.mono, fontSize: 12, fontWeight: cheap ? 700 : 400, color: p === '—' ? WF.mute : WF.ink }}>
              {p === '—' ? '—' : '€'+p}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4, marginBottom: 6 }}>Alt. products</div>
        {['Sūris Dvaro 180g','Sūris Grünland 250g','Sūris Rokiškio 300g'].map((n, i) => (
          <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 11 }}>
            <span>{n}</span>
            <span style={{ fontFamily: WF.mono, color: WF.sub }}>€{[2.99, 4.20, 2.89][i]}</span>
          </div>
        ))}
      </div>
      <MobileNav active="search" />
    </Phone>
  );
}

function ProductB_Desktop() {
  const mkPts = (seed, w, h) => Array.from({ length: 30 }).map((_, i) => `${(i * w) / 29},${h * 0.6 - Math.sin(i * 0.35 + seed) * h * 0.2 - i * 0.15}`).join(' ');
  return (
    <Browser url="grocery.local/p/suris-dziugas-200g">
      <TopBar active="search" />
      <div style={{ padding: '28px 40px', overflow: 'hidden', height: 'calc(100% - 48px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Box w={56} h={56} r={2} bg={WF.chip} />
          <div>
            <div style={{ fontSize: 10, color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.4 }}>Rokiškio pieno gamyba</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>Sūris Džiugas 40%, 200g</div>
            <div style={{ fontSize: 11, color: WF.sub }}>€17.00/kg · hard cheese · LT</div>
          </div>
          <div style={{ flex: 1 }} />
          <Btn>Watch</Btn><Btn primary>+ Add to list</Btn>
        </div>

        <div style={{ border: `1px solid ${WF.line}`, marginTop: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 110px 100px 100px', background: WF.paper, borderBottom: `1px solid ${WF.line}`, padding: '10px 14px', fontSize: 10, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4 }}>
            <div>store</div><div>90-day trend</div><div style={{ textAlign: 'right' }}>today</div><div style={{ textAlign: 'right' }}>90d low</div><div style={{ textAlign: 'right' }}>vs avg</div>
          </div>
          {[
            ['Rimi','RI',1,'3.40','3.20','−4%', true],
            ['IKI','IK',2,'3.55','3.30','+1%'],
            ['Barbora','BA',3,'3.49','3.29','−2%'],
            ['PROMO C&C','PR',0,'—','—','—'],
          ].map(([n, m, seed, p, lo, vs, cheap], i) => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 110px 100px 100px', padding: '14px 14px', borderBottom: i < 3 ? `1px solid ${WF.hair}` : 'none', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <StoreMark label={m} size={22} filled={cheap} />
                <span style={{ fontSize: 12, fontWeight: cheap ? 600 : 400 }}>{n}</span>
              </div>
              {seed ? (
                <svg viewBox="0 0 400 40" width="100%" height="40">
                  <polyline points={mkPts(seed, 400, 40)} fill="none" stroke={cheap ? WF.ink : WF.sub} strokeWidth={cheap ? 1.5 : 1} />
                </svg>
              ) : (
                <div style={{ height: 40, background: `repeating-linear-gradient(45deg, ${WF.hair} 0 4px, transparent 4px 8px)` }} />
              )}
              <div style={{ textAlign: 'right', fontFamily: WF.mono, fontSize: 14, fontWeight: cheap ? 700 : 500, color: p === '—' ? WF.mute : WF.ink }}>{p === '—' ? '—' : '€'+p}</div>
              <div style={{ textAlign: 'right', fontFamily: WF.mono, fontSize: 12, color: WF.sub }}>{lo === '—' ? '—' : '€'+lo}</div>
              <div style={{ textAlign: 'right', fontFamily: WF.mono, fontSize: 12, color: WF.sub }}>{vs}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 22 }}>
          <div style={{ border: `1px solid ${WF.hair}`, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 10 }}>Recent events</div>
            {[['apr 14','Rimi dropped €3.55 → €3.40'],['mar 28','Barbora: new low €3.29'],['mar 12','IKI flash promo (€2.99, 2 days)']].map(([d, e]) => (
              <div key={d} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: `1px solid ${WF.hair}`, fontSize: 11 }}>
                <span style={{ fontFamily: WF.mono, color: WF.sub, width: 50 }}>{d}</span>
                <span>{e}</span>
              </div>
            ))}
          </div>
          <div style={{ border: `1px solid ${WF.hair}`, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 10 }}>Similar products</div>
            {[['Sūris Dvaro 180g','€2.99'],['Sūris Grünland 250g','€4.20'],['Sūris Rokiškio 300g','€2.89']].map(([n, p]) => (
              <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${WF.hair}`, fontSize: 12 }}>
                <span>{n}</span><span style={{ fontFamily: WF.mono, color: WF.sub }}>{p}</span>
              </div>
            ))}
            <AdSponsoredRow style={{ marginTop: 10 }} />
          </div>
        </div>
      </div>
    </Browser>
  );
}

// ─── C. Timeline / stock-market-y vibe
function ProductC_Mobile() {
  return (
    <Phone bg={WF.paper}>
      <div style={{ padding: '14px 16px 0', fontFamily: WF.mono }}>
        <div style={{ fontSize: 9, color: WF.sub, letterSpacing: 1, textTransform: 'uppercase' }}>SURDZG-200 · LT</div>
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, fontFamily: WF.font }}>Sūris Džiugas</div>
      </div>
      <div style={{ padding: '10px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: WF.mono }}>3.40</div>
          <div style={{ fontSize: 12, color: WF.sub, fontFamily: WF.mono }}>EUR</div>
          <div style={{ fontSize: 11, color: WF.ink, fontFamily: WF.mono, marginLeft: 'auto' }}>▼ 0.15  −4.2%</div>
        </div>
        <div style={{ fontSize: 9, color: WF.sub, fontFamily: WF.mono, marginTop: 2 }}>apr 22 · 14:02 · scraped from rimi.lt</div>
      </div>

      <svg viewBox="0 0 260 130" width="100%" height="130" style={{ marginTop: 10 }}>
        <g stroke={WF.hair} strokeWidth="0.5">
          {Array.from({ length: 5 }).map((_, i) => <line key={i} x1="0" y1={i*28+10} x2="260" y2={i*28+10} />)}
        </g>
        {/* candles */}
        {Array.from({ length: 18 }).map((_, i) => {
          const o = 60 + Math.sin(i) * 10 + (i%3 ? -5 : 5);
          const c = o + (i%2 ? -6 : 4);
          const h = Math.min(o, c) - 5;
          const l = Math.max(o, c) + 6;
          const x = i * 14 + 8;
          const green = c < o;
          return (
            <g key={i}>
              <line x1={x} y1={h} x2={x} y2={l} stroke={WF.ink} strokeWidth="0.6" />
              <rect x={x-4} y={Math.min(o,c)} width="8" height={Math.abs(c-o) || 2} fill={green ? WF.ink : '#fff'} stroke={WF.ink} strokeWidth="0.8" />
            </g>
          );
        })}
      </svg>

      <div style={{ padding: '8px 16px 0', fontFamily: WF.mono, fontSize: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: WF.sub }}>
          <span>90d high</span><span>3.89 · dec 4</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: WF.sub }}>
          <span>90d low</span><span>3.20 · mar 14</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: WF.sub }}>
          <span>avg</span><span>3.56</span>
        </div>
      </div>

      <div style={{ padding: '14px 16px 0', fontFamily: WF.mono, fontSize: 10 }}>
        <div style={{ color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>feed</div>
        {['apr 22 · RI −0.15 → 3.40','apr 14 · RI −0.10 → 3.55','mar 28 · BA new low 3.29','mar 12 · IK promo 2.99'].map((e) => (
          <div key={e} style={{ padding: '3px 0', borderBottom: `1px dashed ${WF.line}` }}>{e}</div>
        ))}
      </div>
      <MobileNav active="search" />
    </Phone>
  );
}

function ProductC_Desktop() {
  return (
    <Browser url="grocery.local/p/suris-dziugas-200g" bg={WF.paper}>
      <TopBar active="search" />
      <div style={{ padding: '24px 36px', overflow: 'hidden', height: 'calc(100% - 48px)', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
        <div>
          <div style={{ fontFamily: WF.mono, fontSize: 10, color: WF.sub, letterSpacing: 1, textTransform: 'uppercase' }}>SURDZG-200 · Rokiškio · LT</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 2 }}>Sūris Džiugas 40%, 200g</div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 10 }}>
            <div style={{ fontSize: 48, fontWeight: 700, fontFamily: WF.mono, letterSpacing: -1 }}>3.40</div>
            <div style={{ fontSize: 14, color: WF.sub, fontFamily: WF.mono }}>EUR</div>
            <div style={{ fontSize: 14, color: WF.ink, fontFamily: WF.mono, marginLeft: 'auto' }}>▼ 0.15 · −4.2%</div>
          </div>
          <div style={{ fontSize: 10, color: WF.sub, fontFamily: WF.mono, marginTop: 2 }}>apr 22 14:02 · last scrape · 4 sources tracked</div>

          <div style={{ marginTop: 18, background: '#fff', border: `1px solid ${WF.hair}`, padding: 18 }}>
            <svg viewBox="0 0 800 280" width="100%" height="280">
              <g stroke={WF.hair} strokeWidth="0.5">
                {Array.from({ length: 7 }).map((_, i) => <line key={i} x1="40" y1={i*40+20} x2="780" y2={i*40+20} />)}
              </g>
              <g fontFamily="monospace" fontSize="9" fill={WF.sub}>
                <text x="5" y="24">3.90</text><text x="5" y="104">3.60</text><text x="5" y="184">3.30</text><text x="5" y="264">3.00</text>
              </g>
              {Array.from({ length: 52 }).map((_, i) => {
                const base = 140 + Math.sin(i * 0.3) * 30 + Math.cos(i * 0.1) * 15 - i * 0.8;
                const o = base + (i % 4) * 3;
                const c = base + ((i+1) % 5) * -2;
                const h = Math.min(o, c) - (6 + (i%3)*3);
                const l = Math.max(o, c) + (5 + (i%4)*2);
                const x = i * 14 + 50;
                const green = c < o;
                return (
                  <g key={i}>
                    <line x1={x} y1={h} x2={x} y2={l} stroke={WF.ink} strokeWidth="0.8" />
                    <rect x={x-4} y={Math.min(o,c)} width="8" height={Math.max(Math.abs(c-o), 2)} fill={green ? WF.ink : '#fff'} stroke={WF.ink} strokeWidth="1" />
                  </g>
                );
              })}
              <g fontFamily="Helvetica" fontSize="10" fill={WF.sub}>
                <text x="50" y="275">jan 22</text><text x="220" y="275">feb 14</text><text x="400" y="275">mar 7</text><text x="580" y="275">mar 30</text><text x="720" y="275">apr 22</text>
              </g>
            </svg>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 18, fontFamily: WF.mono, fontSize: 11 }}>
            {[['OPEN','3.55'],['HIGH','3.89'],['LOW','3.20'],['AVG','3.56']].map(([l, v]) => (
              <div key={l} style={{ border: `1px solid ${WF.hair}`, padding: 12, background: '#fff' }}>
                <div style={{ color: WF.sub }}>{l}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontFamily: WF.mono, fontSize: 11 }}>
          <div style={{ color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>price feed</div>
          {[
            ['apr 22 14:02','RI','−0.15','3.40'],
            ['apr 21 08:00','RI','0.00','3.55'],
            ['apr 14 14:00','RI','−0.10','3.55'],
            ['apr 08 08:00','IK','+0.05','3.55'],
            ['apr 02 14:00','BA','−0.06','3.49'],
            ['mar 28 08:00','BA','−0.20','3.29'],
            ['mar 14 14:00','RI','−0.25','3.20'],
            ['mar 12 10:00','IK','PROMO','2.99'],
            ['mar 05 08:00','BA','+0.10','3.55'],
            ['feb 24 14:00','RI','+0.05','3.55'],
            ['feb 14 08:00','IK','−0.10','3.50'],
            ['feb 08 14:00','RI','0.00','3.50'],
            ['feb 01 08:00','BA','+0.15','3.45'],
            ['jan 22 14:00','RI','0.00','3.50'],
          ].map(([d, s, delta, p]) => (
            <div key={d} style={{ display: 'grid', gridTemplateColumns: '84px 22px 44px 44px', padding: '4px 0', borderBottom: `1px dashed ${WF.line}`, color: WF.ink }}>
              <span style={{ color: WF.sub }}>{d}</span>
              <span>{s}</span>
              <span style={{ color: WF.sub }}>{delta}</span>
              <span style={{ textAlign: 'right' }}>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </Browser>
  );
}

// ─── D. Alert-focused — watchlist & drop targets
function ProductD_Mobile() {
  return (
    <Phone>
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon kind="close" size={13} />
          <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: WF.sub }}>Watching · 1 of 8</div>
          <Icon kind="bell" size={13} />
        </div>
        <ImgPlaceholder h={80} label="sūris džiugas" style={{ marginTop: 12 }} />
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Sūris Džiugas 200g</div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: WF.mono, marginTop: 4 }}>€3.40</div>
          <div style={{ fontSize: 10, color: WF.sub }}>Rimi · cheapest · was €3.55</div>
        </div>

        <div style={{ marginTop: 16, border: `1px solid ${WF.ink}`, padding: 12 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4 }}>Alert when below</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <div style={{ flex: 1, height: 32, background: WF.paper, border: `1px solid ${WF.line}`, display: 'flex', alignItems: 'center', padding: '0 10px', fontFamily: WF.mono, fontSize: 16, fontWeight: 600 }}>€3.20</div>
            <Btn>Edit</Btn>
          </div>
          {/* thin chart with line */}
          <svg viewBox="0 0 260 50" width="100%" height="50" style={{ marginTop: 8 }}>
            <line x1="0" y1="18" x2="260" y2="18" stroke={WF.accent} strokeDasharray="3 3" />
            <text x="4" y="14" fontFamily="monospace" fontSize="8" fill={WF.accent}>target 3.20</text>
            <polyline points="0,32 30,30 60,28 90,26 120,22 150,25 180,23 210,21 240,19 260,20" fill="none" stroke={WF.ink} strokeWidth="1.3" />
            <circle cx="260" cy="20" r="3" fill={WF.ink} />
          </svg>
          <div style={{ fontSize: 10, color: WF.sub, marginTop: 4 }}>€0.20 above target · last hit mar 14</div>
        </div>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4, marginBottom: 6 }}>History</div>
        {[['apr 22','−€0.15 at Rimi','notified'],['mar 14','reached €3.20','notified'],['mar 12','−€0.56 at IKI (promo)','notified']].map(([d,e,t]) => (
          <div key={d+e} style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: `1px solid ${WF.hair}`, fontSize: 11 }}>
            <span style={{ fontFamily: WF.mono, color: WF.sub, width: 52 }}>{d}</span>
            <span style={{ flex: 1 }}>{e}</span>
            <span style={{ fontFamily: WF.mono, color: WF.sub, fontSize: 9 }}>{t}</span>
          </div>
        ))}
      </div>
      <MobileNav active="list" />
    </Phone>
  );
}

function ProductD_Desktop() {
  return (
    <Browser url="grocery.local/watch">
      <div style={{ display: 'flex', height: '100%' }}>
        <SideNav active="list" />
        <div style={{ flex: 1, padding: '26px 32px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>Watchlist</div>
            <div style={{ fontSize: 12, color: WF.sub }}>8 items · 3 below target · 1 at all-time low</div>
            <div style={{ flex: 1 }} />
            <Btn>+ Watch new item</Btn>
          </div>

          <div style={{ marginTop: 20, border: `1px solid ${WF.line}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 80px 80px 2fr 120px', background: WF.paper, padding: '10px 14px', fontSize: 10, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4, borderBottom: `1px solid ${WF.line}` }}>
              <div>item</div><div style={{ textAlign: 'right' }}>now</div><div style={{ textAlign: 'right' }}>target</div><div style={{ textAlign: 'right' }}>Δ</div><div>30d trend</div><div style={{ textAlign: 'right' }}>status</div>
            </div>
            {[
              ['Sūris Džiugas 200g','3.40','3.20','+0.20',1, 'watching'],
              ['Sviestas 200g','2.49','2.30','+0.19',2, 'watching'],
              ['Alyvuogių aliejus 500ml','5.80','5.50','+0.30',3, 'watching'],
              ['Šokoladas Rūta','1.20','1.50','−0.30',4, 'TARGET HIT', true],
              ['Kava Paulig 250g','6.10','5.50','+0.60',5, 'watching'],
              ['Kiaušiniai ×10','2.49','2.00','+0.49',6, 'watching'],
              ['Rokiškio pienas 1L','0.99','0.90','+0.09',7, 'watching'],
              ['Vištiena 500g','3.90','3.50','+0.40',8, 'TARGET HIT', true],
            ].map(([n, p, t, d, seed, status, hit], i) => (
              <div key={n} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 80px 80px 2fr 120px', padding: '12px 14px', borderBottom: i < 7 ? `1px solid ${WF.hair}` : 'none', alignItems: 'center', background: hit ? WF.accentSoft : 'transparent' }}>
                <div style={{ fontSize: 12 }}>{n}</div>
                <div style={{ textAlign: 'right', fontFamily: WF.mono, fontSize: 13, fontWeight: 600 }}>€{p}</div>
                <div style={{ textAlign: 'right', fontFamily: WF.mono, fontSize: 11, color: WF.sub }}>€{t}</div>
                <div style={{ textAlign: 'right', fontFamily: WF.mono, fontSize: 11, color: hit ? WF.accent : WF.sub }}>{d}</div>
                <svg viewBox="0 0 200 22" width="100%" height="22">
                  <polyline
                    points={Array.from({ length: 20 }).map((_, k) => `${k * 10},${14 - Math.sin(k * 0.4 + seed) * 4 - (hit ? k * 0.3 : 0)}`).join(' ')}
                    fill="none" stroke={hit ? WF.accent : WF.ink} strokeWidth="1.2"
                  />
                </svg>
                <div style={{ textAlign: 'right', fontFamily: WF.mono, fontSize: 9, color: hit ? WF.accent : WF.sub, fontWeight: hit ? 700 : 400 }}>{status}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, padding: 14, border: `1px dashed ${WF.line}`, fontSize: 12, color: WF.sub, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon kind="info" size={14} color={WF.sub} />
            Alerts delivered via Telegram bot or email. Next scrape: 16:00.
          </div>
          <AdLeaderboard style={{ marginTop: 14 }} />
        </div>
      </div>
    </Browser>
  );
}

Object.assign(window, {
  ProductA_Mobile, ProductA_Desktop, ProductB_Mobile, ProductB_Desktop,
  ProductC_Mobile, ProductC_Desktop, ProductD_Mobile, ProductD_Desktop,
});
