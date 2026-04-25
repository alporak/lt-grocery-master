// Dashboard / Home variations
// 4 directions, each shown as a mobile phone + desktop browser pair.

// ─── A. Basket-first: the big number is today's basket total
function DashA_Mobile() {
  return (
    <Phone>
      <div style={{ padding: '14px 18px 0' }}>
        <div style={{ fontSize: 10, color: WF.sub, letterSpacing: 0.4, textTransform: 'uppercase' }}>Your basket at</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
          <StoreMark label="RI" filled size={20} />
          <div style={{ fontWeight: 600, fontSize: 14 }}>Rimi</div>
          <div style={{ fontSize: 10, color: WF.sub, marginLeft: 'auto' }}>cheapest today</div>
        </div>
        <div style={{ fontSize: 40, fontWeight: 600, marginTop: 10, letterSpacing: -1 }}>€38.42</div>
        <div style={{ fontSize: 11, color: WF.sub }}>saves €4.18 vs. most expensive</div>

        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          {['IKI +€1.20', 'Barbora +€2.05', 'PROMO +€4.18'].map((t, i) => (
            <div key={i} style={{ flex: 1, border: `1px solid ${WF.hair}`, padding: '7px 8px', fontSize: 10 }}>
              {t.split(' ')[0]}<br/><span style={{ color: WF.sub }}>{t.split(' ').slice(1).join(' ')}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 18px 0' }}>
        <Rule />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 8px' }}>
          <div style={{ fontSize: 11, fontWeight: 600 }}>List · 12 items</div>
          <div style={{ fontSize: 10, color: WF.accent }}>Edit</div>
        </div>
        {['Duona, juoda', 'Pienas 2.5%', 'Obuoliai 1kg', 'Kiaušiniai M ×10'].map((n, i) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: `1px solid ${WF.hair}` }}>
            <Box w={10} h={10} r={1} style={{ border: `1px solid ${WF.line}` }} />
            <div style={{ flex: 1, fontSize: 12 }}>{n}</div>
            <div style={{ fontSize: 11, color: WF.sub, fontFamily: WF.mono }}>€{(1.2 + i * 0.6).toFixed(2)}</div>
          </div>
        ))}
        <AdBanner small style={{ marginTop: 12 }} />
      </div>
      <MobileNav active="home" />
    </Phone>
  );
}

function DashA_Desktop() {
  return (
    <Browser url="grocery.local/">
      <div style={{ display: 'flex', height: '100%' }}>
        <SideNav active="home" />
        <div style={{ flex: 1, padding: '28px 36px', overflow: 'hidden' }}>
          <div style={{ fontSize: 11, color: WF.sub, letterSpacing: 0.4, textTransform: 'uppercase' }}>Your basket today</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 54, fontWeight: 600, letterSpacing: -1.2 }}>€38.42</div>
              <div style={{ fontSize: 12, color: WF.sub, marginTop: -4 }}>at <b style={{ color: WF.ink }}>Rimi</b> · 12 items · you save €4.18</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 26 }}>
            {[['RI','Rimi','38.42','—'],['IK','IKI','39.62','+1.20'],['BA','Barbora','40.47','+2.05'],['PR','PROMO','42.60','+4.18']].map(([m,n,p,d],i) => (
              <div key={n} style={{ border: `1px solid ${i===0?WF.ink:WF.hair}`, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <StoreMark label={m} size={20} filled={i===0} /><span style={{ fontSize: 12, fontWeight: 500 }}>{n}</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 600, fontFamily: WF.mono }}>€{p}</div>
                <div style={{ fontSize: 10, color: WF.sub, marginTop: 2 }}>{d === '—' ? 'cheapest' : d + ' more'}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 24, marginTop: 28 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Shopping list</div>
              <div style={{ border: `1px solid ${WF.hair}` }}>
                {['Duona, juoda 600g', 'Pienas 2.5% 1L', 'Obuoliai, raudoni 1kg', 'Kiaušiniai M ×10', 'Sūris, Džiugas 200g', 'Vištiena fileta 500g'].map((n, i) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: i < 5 ? `1px solid ${WF.hair}` : 'none' }}>
                    <Box w={11} h={11} r={1} style={{ border: `1px solid ${WF.line}` }} />
                    <div style={{ flex: 1, fontSize: 12 }}>{n}</div>
                    <StoreMark label="RI" size={16} />
                    <div style={{ fontSize: 12, color: WF.sub, fontFamily: WF.mono, width: 52, textAlign: 'right' }}>€{(1.2 + i * 0.7).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Price drops</div>
              <div style={{ border: `1px solid ${WF.hair}` }}>
                {[['Sviestas 200g', '-18%', '€2.49'], ['Alyvuogių aliejus', '-12%', '€5.80'], ['Šokoladas Rūta', '-25%', '€1.20']].map(([n, d, p]) => (
                  <div key={n} style={{ padding: '10px 12px', borderBottom: `1px solid ${WF.hair}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>{n}</span><span style={{ fontFamily: WF.mono }}>{p}</span>
                    </div>
                    <div style={{ fontSize: 10, color: WF.sub, marginTop: 2 }}>vs last week · {d}</div>
                  </div>
                ))}
              </div>
              <AdSideRail style={{ marginTop: 16 }} />
            </div>
          </div>
        </div>
      </div>
    </Browser>
  );
}

// ─── B. Receipt metaphor — tall receipt ticker as hero
function DashB_Mobile() {
  return (
    <Phone bg={WF.paper}>
      <div style={{ padding: '16px 18px 12px', borderBottom: `1px dashed ${WF.line}` }}>
        <div style={{ fontFamily: WF.mono, fontSize: 9, letterSpacing: 1, color: WF.sub }}>—— WEEKLY RECEIPT ——</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: WF.sub, fontFamily: WF.mono }}>
          <span>wk 17 · apr 2026</span><span>12 items</span>
        </div>
      </div>

      <div style={{ padding: '12px 18px', fontFamily: WF.mono, fontSize: 11 }}>
        {[['duona juoda', '1.29'],['pienas 2.5%', '0.99'],['obuoliai 1kg', '1.69'],['kiaušiniai ×10', '2.49'],['sūris 200g', '3.40'],['vištiena', '4.20'],['bananai 1kg', '1.45'],['makaronai', '1.15'],['kava mal.', '5.99'],['jogurtas ×4', '2.80'],['salotos', '1.30'],['vanduo 5L', '0.89']].map(([n,p],i)=>(
            <div key={n} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
              <span style={{ flex: 1, color: WF.ink }}>{n}</span>
              <span>€{p}</span>
            </div>
          ))}
      </div>

      <div style={{ borderTop: `1px dashed ${WF.line}`, padding: '10px 18px', fontFamily: WF.mono }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
          <span>TOTAL · RIMI</span><span>€27.64</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: WF.sub, marginTop: 4 }}>
          <span>iki</span><span>€29.10</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: WF.sub }}>
          <span>barbora</span><span>€30.22</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: WF.sub }}>
          <span>promo c&amp;c</span><span>€31.80</span>
        </div>
      </div>

      <div style={{ padding: '10px 18px', borderTop: `1px dashed ${WF.line}`, fontFamily: WF.mono, fontSize: 9, color: WF.sub, textAlign: 'center', letterSpacing: 0.5 }}>
        scan ↓ to open list ↓
      </div>
      <AdBanner small style={{ margin: '0 14px 10px', borderStyle: 'dashed' }} headline="Kuponas: Maxima −15%" sub="prisegk prie kortelės · galioja iki sek." />
      <MobileNav active="home" />
    </Phone>
  );
}

function DashB_Desktop() {
  return (
    <Browser url="grocery.local/">
      <div style={{ display: 'flex', height: '100%' }}>
        <SideNav active="home" />
        <div style={{ flex: 1, padding: 36, display: 'grid', gridTemplateColumns: '260px 1fr', gap: 32, overflow: 'hidden' }}>
          {/* left: receipt column */}
          <div style={{ background: WF.paper, border: `1px solid ${WF.hair}`, padding: '20px 22px', fontFamily: WF.mono, fontSize: 11 }}>
            <div style={{ fontSize: 9, letterSpacing: 1.5, color: WF.sub, textAlign: 'center' }}>— WEEKLY RECEIPT —</div>
            <div style={{ fontSize: 9, color: WF.sub, textAlign: 'center', marginTop: 4 }}>wk 17 · apr 22 2026</div>
            <div style={{ borderBottom: `1px dashed ${WF.line}`, margin: '14px 0' }} />
            {['duona juoda 1.29','pienas 2.5% 0.99','obuoliai 1kg 1.69','kiaušiniai ×10 2.49','sūris dž. 3.40','vištiena 4.20','bananai 1.45','makaronai 1.15','kava mal. 5.99','jogurtas ×4 2.80','salotos 1.30','vanduo 5L 0.89'].map((l) => {
              const parts = l.split(' ');
              const p = parts.pop();
              return (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span>{parts.join(' ')}</span><span>€{p}</span>
                </div>
              );
            })}
            <div style={{ borderTop: `1px dashed ${WF.line}`, margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13 }}>
              <span>TOTAL RIMI</span><span>€27.64</span>
            </div>
          </div>

          {/* right: store comparison + notes */}
          <div>
            <div style={{ fontSize: 11, color: WF.sub, letterSpacing: 0.4, textTransform: 'uppercase' }}>This week</div>
            <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1, marginTop: 6 }}>€27.64</div>
            <div style={{ fontSize: 12, color: WF.sub, marginTop: -2 }}>cheapest basket · 4 stores compared</div>

            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Same list elsewhere</div>
              {[['Rimi','27.64',100],['IKI','29.10',105],['Barbora','30.22',109],['PROMO Cash&Carry','31.80',115]].map(([n,p,pct],i)=>(
                <div key={n} style={{ padding: '10px 0', borderBottom: `1px solid ${WF.hair}`, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <StoreMark label={n.slice(0,2).toUpperCase()} size={22} filled={i===0} />
                  <div style={{ flex: 1, fontSize: 12 }}>{n}</div>
                  <div style={{ width: 160, height: 4, background: WF.hair, position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct-90}%`, background: i===0?WF.ink:WF.sub }} />
                  </div>
                  <div style={{ fontFamily: WF.mono, fontSize: 13, width: 60, textAlign: 'right' }}>€{p}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 26, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ border: `1px solid ${WF.hair}`, padding: 14 }}>
                <div style={{ fontSize: 10, color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.4 }}>Last sync</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4, fontFamily: WF.mono }}>2h ago</div>
                <div style={{ fontSize: 10, color: WF.sub }}>next: 16:00</div>
              </div>
              <div style={{ border: `1px solid ${WF.hair}`, padding: 14 }}>
                <div style={{ fontSize: 10, color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.4 }}>Watchlist</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4, fontFamily: WF.mono }}>3 drops</div>
                <div style={{ fontSize: 10, color: WF.sub }}>sviestas, aliejus, rūta</div>
              </div>
            </div>
            <AdLeaderboard style={{ marginTop: 20 }} />
          </div>
        </div>
      </div>
    </Browser>
  );
}

// ─── C. Map-first: stores on a map, basket as overlay
function DashC_Mobile() {
  return (
    <Phone>
      <div style={{ position: 'absolute', inset: '28px 0 52px', background: WF.paper }}>
        {/* fake map — road lines */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          <g stroke={WF.hair} strokeWidth="1" fill="none">
            <path d="M0 60 L260 90" /><path d="M0 140 L260 160" /><path d="M0 240 L260 220" />
            <path d="M60 0 L80 380" /><path d="M150 0 L140 380" /><path d="M220 0 L210 380" />
          </g>
          {/* pins */}
          <g fontFamily="Helvetica" fontSize="8" fontWeight="600">
            <circle cx="90" cy="110" r="11" fill="#111" /><text x="90" y="113" fill="#fff" textAnchor="middle">RI</text>
            <circle cx="170" cy="160" r="10" fill="#fff" stroke="#111" /><text x="170" y="163" textAnchor="middle">IK</text>
            <circle cx="130" cy="230" r="10" fill="#fff" stroke="#111" /><text x="130" y="233" textAnchor="middle">BA</text>
            <circle cx="60" cy="280" r="10" fill="#fff" stroke="#111" /><text x="60" y="283" textAnchor="middle">PR</text>
            <circle cx="140" cy="180" r="4" fill="#3b5bdb" />
            <circle cx="140" cy="180" r="14" fill="none" stroke="#3b5bdb" strokeOpacity="0.3" strokeWidth="2" />
          </g>
        </svg>

        {/* top card */}
        <div style={{ position: 'absolute', top: 14, left: 14, right: 14, background: '#fff', border: `1px solid ${WF.line}`, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: WF.sub }}>Nearest cheapest</div>
            <div style={{ fontSize: 10, color: WF.accent }}>Filter</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <StoreMark label="RI" filled size={26} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Rimi Gedimino pr. 9</div>
              <div style={{ fontSize: 10, color: WF.sub }}>650m · open until 23:00</div>
            </div>
            <div style={{ fontFamily: WF.mono, fontSize: 14, fontWeight: 600 }}>€38.42</div>
          </div>
        </div>

        {/* bottom sheet */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: `1px solid ${WF.line}`, padding: '10px 14px 14px' }}>
          <div style={{ width: 34, height: 3, background: WF.chip, borderRadius: 2, margin: '0 auto 10px' }} />
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>All nearby (4)</div>
          {[['IK','IKI Mindaugo', '820m', '39.62'], ['BA','Barbora Pickup', '1.1km', '40.47']].map(([m,n,d,p]) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
              <StoreMark label={m} size={18} />
              <div style={{ flex: 1, fontSize: 11 }}>{n}<div style={{ fontSize: 9, color: WF.sub }}>{d}</div></div>
              <div style={{ fontFamily: WF.mono, fontSize: 12 }}>€{p}</div>
            </div>
          ))}
          <AdSponsoredRow style={{ marginTop: 6 }} />
        </div>
      </div>
      <MobileNav active="map" />
    </Phone>
  );
}

function DashC_Desktop() {
  return (
    <Browser url="grocery.local/">
      <div style={{ display: 'flex', height: '100%' }}>
        <SideNav active="home" />
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.5fr 1fr', height: '100%' }}>
          <div style={{ position: 'relative', background: WF.paper, borderRight: `1px solid ${WF.hair}` }}>
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
              <g stroke={WF.hair} strokeWidth="1" fill="none">
                {Array.from({ length: 12 }).map((_, i) => (
                  <path key={`h${i}`} d={`M0 ${i * 50} L800 ${i * 50 + (i % 2 ? 10 : -5)}`} />
                ))}
                {Array.from({ length: 10 }).map((_, i) => (
                  <path key={`v${i}`} d={`M${i * 70} 0 L${i * 70 + (i%2?15:-10)} 600`} />
                ))}
              </g>
              <g fontFamily="Helvetica" fontSize="11" fontWeight="600">
                {[
                  ['RI', 180, 140, true],['RI', 340, 260, true],['RI', 500, 340, true],
                  ['IK', 110, 240, false],['IK', 420, 180, false],['IK', 560, 260, false],
                  ['BA', 250, 320, false],['BA', 380, 400, false],
                  ['PR', 110, 380, false],['PR', 510, 120, false],
                ].map(([l,x,y,f],i)=>(
                  <g key={i}>
                    <circle cx={x} cy={y} r="14" fill={f?'#111':'#fff'} stroke="#111" strokeWidth="1" />
                    <text x={x} y={y+4} fill={f?'#fff':'#111'} textAnchor="middle">{l}</text>
                  </g>
                ))}
                <circle cx="290" cy="220" r="6" fill="#3b5bdb" />
                <circle cx="290" cy="220" r="22" fill="none" stroke="#3b5bdb" strokeOpacity="0.3" strokeWidth="2" />
              </g>
            </svg>

            <div style={{ position: 'absolute', top: 18, left: 18, right: 18, display: 'flex', gap: 8 }}>
              <div style={{ background: '#fff', border: `1px solid ${WF.line}`, padding: '6px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon kind="search" size={12} color={WF.sub} /> Vilnius, Gedimino pr.
              </div>
              <Chip active>All stores</Chip><Chip>Open now</Chip><Chip>&lt; 1km</Chip>
            </div>
            <div style={{ position: 'absolute', bottom: 18, left: 18, background: '#fff', border: `1px solid ${WF.line}`, padding: 10, fontSize: 10, fontFamily: WF.mono, color: WF.sub }}>
              4 chains · 10 locations · ◎ = you
            </div>
          </div>

          <div style={{ padding: '24px 28px', overflow: 'auto' }}>
            <div style={{ fontSize: 11, color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.4 }}>Cheapest basket nearby</div>
            <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: -1, marginTop: 4 }}>€38.42</div>
            <div style={{ fontSize: 12, color: WF.sub, marginTop: -2 }}>Rimi · 650m · 12 items</div>
            <Btn primary style={{ marginTop: 14 }}>Get directions →</Btn>

            <AdBanner style={{ marginTop: 16 }} headline="Norfa · savaitės pasiūlymai" sub="atidaryk lankstinuką · −30% mėsa" />

            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 26, marginBottom: 10 }}>Sorted by distance</div>
            {[['RI','Rimi Gedimino', '650m', 'large · 2400m²','38.42',true],['IK','IKI Mindaugo', '820m','medium · 1100m²','39.62'],['BA','Barbora Pickup', '1.1km','pickup only','40.47'],['PR','PROMO Cash&Carry', '3.4km','wholesale','42.60']].map(([m,n,d,sz,p,cheap],i)=>(
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${WF.hair}` }}>
                <StoreMark label={m} size={26} filled={cheap} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{n}{cheap && <span style={{ fontSize: 9, marginLeft: 6, color: WF.sub, fontFamily: WF.mono }}>CHEAPEST</span>}</div>
                  <div style={{ fontSize: 10, color: WF.sub }}>{d} · {sz}</div>
                </div>
                <div style={{ fontFamily: WF.mono, fontSize: 13 }}>€{p}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Browser>
  );
}

// ─── D. Widget grid — dashboard as a spreadsheet of tiles
function DashD_Mobile() {
  return (
    <Phone>
      <div style={{ padding: '14px 14px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Labas rytas</div>
          <div style={{ fontSize: 10, color: WF.sub }}>Apr 22</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
          <div style={{ border: `1px solid ${WF.hair}`, padding: 12, gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4 }}>Basket</div>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5 }}>€38.42</div>
            <div style={{ fontSize: 10, color: WF.sub }}>12 items · cheapest at Rimi</div>
          </div>
          <div style={{ border: `1px solid ${WF.hair}`, padding: 10 }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4 }}>Saved</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginTop: 2 }}>€4.18</div>
            <div style={{ fontSize: 9, color: WF.sub }}>this week</div>
          </div>
          <div style={{ border: `1px solid ${WF.hair}`, padding: 10 }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4 }}>Watching</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginTop: 2 }}>8</div>
            <div style={{ fontSize: 9, color: WF.sub }}>3 dropped</div>
          </div>
          <div style={{ border: `1px solid ${WF.hair}`, padding: 10, gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4, marginBottom: 8 }}>Trend · basket</div>
            <svg viewBox="0 0 200 40" width="100%" height="40">
              <polyline points="0,30 25,28 50,32 75,20 100,24 125,18 150,22 175,14 200,18" fill="none" stroke={WF.ink} strokeWidth="1.2" />
              <line x1="0" y1="36" x2="200" y2="36" stroke={WF.hair} />
            </svg>
            <div style={{ fontSize: 9, color: WF.sub, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontFamily: WF.mono }}>
              <span>mar</span><span>now</span>
            </div>
          </div>
          <div style={{ border: `1px solid ${WF.hair}`, padding: 10 }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4 }}>Nearest</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>Rimi</div>
            <div style={{ fontSize: 9, color: WF.sub }}>650m</div>
          </div>
          <div style={{ border: `1px solid ${WF.hair}`, padding: 10 }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4 }}>Sync</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>2h ago</div>
            <div style={{ fontSize: 9, color: WF.sub }}>next 16:00</div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}><AdBanner small /></div>
        </div>
      </div>
      <MobileNav active="home" />
    </Phone>
  );
}

function DashD_Desktop() {
  return (
    <Browser url="grocery.local/">
      <TopBar active="home" />
      <div style={{ padding: 28, overflow: 'hidden', height: 'calc(100% - 48px)' }}>
        <div style={{ fontSize: 11, color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.4 }}>Dashboard</div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3, marginTop: 2 }}>Labas rytas — Apr 22, 2026</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 22 }}>
          {[
            { l: 'Basket', v: '€38.42', s: '12 items · Rimi', span: 2, big: true },
            { l: 'You saved', v: '€4.18', s: 'this week' },
            { l: 'Watchlist', v: '8', s: '3 price drops' },
            { l: 'Nearest', v: 'Rimi Gedimino', s: '650m · open until 23:00', span: 2 },
            { l: 'Last sync', v: '2h ago', s: '4 / 4 stores OK' },
            { l: 'Items tracked', v: '412', s: 'across 4 chains' },
          ].map((w, i) => (
            <div key={i} style={{ border: `1px solid ${WF.hair}`, padding: 14, gridColumn: `span ${w.span || 1}` }}>
              <div style={{ fontSize: 10, color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.4 }}>{w.l}</div>
              <div style={{ fontSize: w.big ? 34 : 20, fontWeight: 600, letterSpacing: -0.5, marginTop: 6 }}>{w.v}</div>
              <div style={{ fontSize: 11, color: WF.sub, marginTop: 2 }}>{w.s}</div>
            </div>
          ))}
          <div style={{ gridColumn: 'span 4' }}><AdLeaderboard /></div>
          <div style={{ border: `1px solid ${WF.hair}`, padding: 14, gridColumn: 'span 4' }}>
            <div style={{ fontSize: 10, color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Basket cost · last 12 weeks</div>
            <svg viewBox="0 0 800 80" width="100%" height="80">
              {Array.from({ length: 12 }).map((_, i) => (
                <line key={i} x1={i * 66 + 20} y1="10" x2={i * 66 + 20} y2="70" stroke={WF.hair} />
              ))}
              <polyline
                points={Array.from({ length: 12 }).map((_, i) => `${i * 66 + 20},${40 + Math.sin(i * 0.8) * 18 - i * 0.8}`).join(' ')}
                fill="none" stroke={WF.ink} strokeWidth="1.4"
              />
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: WF.sub, fontFamily: WF.mono, marginTop: 6 }}>
              <span>feb 3</span><span>feb 17</span><span>mar 3</span><span>mar 17</span><span>mar 31</span><span>apr 14</span><span>today</span>
            </div>
          </div>
        </div>
      </div>
    </Browser>
  );
}

Object.assign(window, {
  DashA_Mobile, DashA_Desktop, DashB_Mobile, DashB_Desktop,
  DashC_Mobile, DashC_Desktop, DashD_Mobile, DashD_Desktop,
});
