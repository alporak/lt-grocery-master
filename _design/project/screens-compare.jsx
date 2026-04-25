// Price comparison / basket comparison results — 4 variations

// ─── A. Big totals bar chart per store
function CompareA_Mobile() {
  const stores = [['Rimi','RI','27.64',100,true],['IKI','IK','29.10',105],['Barbora','BA','30.22',109],['PROMO','PR','31.80',115]];
  return (
    <Phone>
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 10, color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.4 }}>12-item basket at</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>Rimi <span style={{ color: WF.sub, fontWeight: 400, fontSize: 13 }}>is cheapest</span></div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {stores.map(([n, m, p, pct, cheap]) => (
          <div key={n} style={{ padding: '12px 0', borderBottom: `1px solid ${WF.hair}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StoreMark label={m} size={22} filled={cheap} />
              <div style={{ flex: 1, fontSize: 12, fontWeight: cheap ? 600 : 400 }}>{n}</div>
              <div style={{ fontFamily: WF.mono, fontSize: 14, fontWeight: 600 }}>€{p}</div>
            </div>
            <div style={{ height: 6, background: WF.hair, marginTop: 8, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct - 85}%`, background: cheap ? WF.ink : WF.sub }} />
            </div>
            {!cheap && <div style={{ fontSize: 10, color: WF.sub, fontFamily: WF.mono, marginTop: 4 }}>+€{(Number(p) - 27.64).toFixed(2)}</div>}
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: 52, left: 0, right: 0, padding: '12px 16px', borderTop: `1px solid ${WF.hair}`, background: '#fff' }}>
        <AdBanner small style={{ marginBottom: 10 }} headline="Kuponas: Rimi −5%" sub="pridedant prie sąskaitos" />
        <Btn primary block>Plan route at Rimi →</Btn>
      </div>
      <MobileNav active="list" />
    </Phone>
  );
}

function CompareA_Desktop() {
  const stores = [
    ['Rimi','RI','27.64',100,true,'Gedimino pr. · 650m'],
    ['IKI','IK','29.10',105,false,'Mindaugo g. · 820m'],
    ['Barbora','BA','30.22',109,false,'pickup · 1.1km'],
    ['PROMO C&C','PR','31.80',115,false,'Savanorių · 3.4km'],
  ];
  return (
    <Browser url="grocery.local/compare">
      <div style={{ display: 'flex', height: '100%' }}>
        <SideNav active="list" />
        <div style={{ flex: 1, padding: '28px 36px', overflow: 'hidden' }}>
          <div style={{ fontSize: 11, color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.4 }}>Compare basket · 12 items</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4, letterSpacing: -0.4 }}>
            Buy everything at <u style={{ textDecoration: 'none', borderBottom: `3px solid ${WF.ink}` }}>Rimi</u> for <span style={{ fontFamily: WF.mono }}>€27.64</span>
          </div>
          <div style={{ fontSize: 12, color: WF.sub, marginTop: 6 }}>or split across stops to save €1.80 more</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 28, marginTop: 28 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Single-store basket</div>
              {stores.map(([n, m, p, pct, cheap, loc]) => (
                <div key={n} style={{ padding: '14px 0', borderBottom: `1px solid ${WF.hair}`, display: 'grid', gridTemplateColumns: '38px 1.2fr 2fr 90px', gap: 14, alignItems: 'center' }}>
                  <StoreMark label={m} size={28} filled={cheap} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: cheap ? 700 : 500 }}>{n}</div>
                    <div style={{ fontSize: 10, color: WF.sub }}>{loc}</div>
                  </div>
                  <div style={{ height: 10, background: WF.hair, position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct - 85}%`, background: cheap ? WF.ink : WF.sub }} />
                    {cheap && <div style={{ position: 'absolute', right: 0, top: -16, fontSize: 9, fontFamily: WF.mono, color: WF.sub }}>cheapest</div>}
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: WF.mono, fontSize: 16, fontWeight: cheap ? 700 : 500 }}>
                    €{p}
                    <div style={{ fontSize: 9, color: WF.sub, fontWeight: 400 }}>{cheap ? '—' : `+€${(Number(p) - 27.64).toFixed(2)}`}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ border: `1px solid ${WF.ink}`, padding: 20 }}>
              <div style={{ fontSize: 10, color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.4 }}>Best split plan · 3 stops</div>
              <div style={{ fontFamily: WF.mono, fontSize: 30, fontWeight: 700, marginTop: 6 }}>€25.84</div>
              <div style={{ fontSize: 11, color: WF.sub, marginTop: 2 }}>saves €1.80 vs. cheapest single</div>

              <div style={{ marginTop: 18 }}>
                {[['RI','Rimi','4 items','8.28'],['IK','IKI','3 items','5.34'],['PR','PROMO','5 items','12.22']].map(([m,n,c,p]) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${WF.hair}` }}>
                    <StoreMark label={m} size={20} />
                    <div style={{ flex: 1, fontSize: 12 }}>{n}</div>
                    <div style={{ fontSize: 10, color: WF.sub }}>{c}</div>
                    <div style={{ fontFamily: WF.mono, fontSize: 12 }}>€{p}</div>
                  </div>
                ))}
              </div>
              <Btn primary block style={{ marginTop: 18 }}>View route →</Btn>
              <Btn block style={{ marginTop: 8 }}>Just buy at Rimi</Btn>
              <AdBanner small style={{ marginTop: 14 }} headline="Dovanų kortelė Rimi €30" sub="užsisakyk — su pristatymu nemokamai" />
            </div>
          </div>
        </div>
      </div>
    </Browser>
  );
}

// ─── B. Per-item highlight: side-by-side matrix
function CompareB_Mobile() {
  return (
    <Phone>
      <div style={{ padding: '14px 14px 0' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Per-item winners</div>
        <div style={{ fontSize: 10, color: WF.sub }}>12 items · cheapest cell highlighted</div>
      </div>
      <div style={{ padding: '10px 0 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', background: WF.paper, borderTop: `1px solid ${WF.hair}`, borderBottom: `1px solid ${WF.hair}`, padding: '6px 12px', fontSize: 9, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4 }}>
          <div>item</div><div style={{ textAlign: 'center' }}>RI</div><div style={{ textAlign: 'center' }}>IK</div><div style={{ textAlign: 'center' }}>BA</div><div style={{ textAlign: 'center' }}>PR</div>
        </div>
        {[
          ['Duona', 1.29, 1.35, 1.49, null],
          ['Pienas ×2', 1.98, 2.10, 2.18, 1.78],
          ['Obuoliai', 1.49, 1.39, 1.55, 1.45],
          ['Kiaušiniai', 2.69, 2.55, 2.49, 2.79],
          ['Sūris', 3.40, 3.55, 3.49, null],
          ['Vištiena ×2', 8.40, 8.20, 8.60, 7.80],
          ['Bananai', 1.25, 1.15, 1.29, 1.20],
          ['Makaronai', 2.30, 2.38, 2.50, 2.18],
        ].map(([n, ...prices]) => {
          const min = Math.min(...prices.filter(x => x));
          return (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', padding: '7px 12px', borderBottom: `1px solid ${WF.hair}`, fontSize: 11, alignItems: 'center' }}>
              <div>{n}</div>
              {prices.map((p, i) => (
                <div key={i} style={{ textAlign: 'center', fontFamily: WF.mono, fontSize: 10, color: !p ? WF.mute : WF.ink, fontWeight: p === min ? 700 : 400, background: p === min ? WF.ink : 'transparent', color: p === min ? '#fff' : (p ? WF.ink : WF.mute), padding: '2px 0' }}>
                  {p ? p.toFixed(2) : '—'}
                </div>
              ))}
            </div>
          );
        })}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', padding: '10px 12px', background: WF.paper, fontSize: 11, fontWeight: 700 }}>
          <div>TOTAL</div>
          {['27.64','29.10','30.22','31.80'].map((t, i) => (
            <div key={i} style={{ textAlign: 'center', fontFamily: WF.mono, color: i === 0 ? WF.ink : WF.sub }}>{t}</div>
          ))}
        </div>
      </div>
      <MobileNav active="list" />
    </Phone>
  );
}

function CompareB_Desktop() {
  const rows = [
    ['Duona juoda Vilniaus 500g', 1.29, 1.35, 1.49, null],
    ['Pienas 2.5% 1L ×2', 1.98, 2.10, 2.18, 1.78],
    ['Obuoliai, raud. 1kg', 1.49, 1.39, 1.55, 1.45],
    ['Kiaušiniai M ×10', 2.69, 2.55, 2.49, 2.79],
    ['Sūris Džiugas 200g', 3.40, 3.55, 3.49, null],
    ['Vištiena fileta 500g ×2', 8.40, 8.20, 8.60, 7.80],
    ['Bananai 1kg', 1.25, 1.15, 1.29, 1.20],
    ['Makaronai Barilla ×2', 2.30, 2.38, 2.50, 2.18],
    ['Kava malta 250g', 6.25, 6.10, 5.99, null],
    ['Jogurtas natūralus ×4', 2.95, 2.80, 2.90, null],
    ['Salotos ledinės', 1.30, 1.45, 1.55, null],
    ['Vanduo 5L ×2', 2.20, 2.10, 2.30, 1.78],
  ];
  return (
    <Browser url="grocery.local/compare">
      <div style={{ display: 'flex', height: '100%' }}>
        <SideNav active="list" />
        <div style={{ flex: 1, padding: '26px 32px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>Per-item comparison</div>
            <div style={{ fontSize: 12, color: WF.sub }}>cheapest price highlighted · missing = not stocked</div>
            <div style={{ flex: 1 }} />
            <Btn small>Hide ties</Btn><Btn small>Show per-unit €/kg</Btn>
          </div>
          <AdLeaderboard style={{ marginBottom: 14 }} />

          <div style={{ border: `1px solid ${WF.line}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1fr 80px', background: WF.paper, borderBottom: `1px solid ${WF.line}` }}>
              {['item', 'Rimi', 'IKI', 'Barbora', 'PROMO', 'win'].map((c, i) => (
                <div key={c} style={{ padding: '10px 14px', borderRight: i < 5 ? `1px solid ${WF.line}` : 'none', fontSize: 10, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4, textAlign: i > 0 && i < 5 ? 'right' : 'left' }}>{c}</div>
              ))}
            </div>
            {rows.map(([n, ...prices], r) => {
              const min = Math.min(...prices.filter(x => x));
              const winner = ['RI', 'IK', 'BA', 'PR'][prices.indexOf(min)];
              return (
                <div key={r} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1fr 80px', borderBottom: r < rows.length - 1 ? `1px solid ${WF.hair}` : 'none' }}>
                  <div style={{ padding: '10px 14px', fontSize: 12, borderRight: `1px solid ${WF.line}` }}>{n}</div>
                  {prices.map((p, i) => (
                    <div key={i} style={{ padding: '10px 14px', borderRight: `1px solid ${WF.line}`, fontFamily: WF.mono, fontSize: 12, textAlign: 'right', background: p === min ? WF.ink : 'transparent', color: p === min ? '#fff' : (p ? WF.ink : WF.mute), fontWeight: p === min ? 700 : 400 }}>
                      {p ? '€' + p.toFixed(2) : '—'}
                    </div>
                  ))}
                  <div style={{ padding: '10px 14px', textAlign: 'center' }}><StoreMark label={winner} size={18} filled /></div>
                </div>
              );
            })}
            <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1fr 80px', background: WF.paper, fontWeight: 700, fontSize: 13 }}>
              <div style={{ padding: '12px 14px', borderRight: `1px solid ${WF.line}` }}>Σ TOTAL</div>
              {['27.64','29.10','30.22','31.80'].map((t, i) => (
                <div key={i} style={{ padding: '12px 14px', borderRight: `1px solid ${WF.line}`, textAlign: 'right', fontFamily: WF.mono, color: i === 0 ? WF.ink : WF.sub }}>€{t}</div>
              ))}
              <div style={{ padding: '12px 14px', textAlign: 'center', color: WF.sub, fontSize: 10, fontFamily: WF.mono }}>8·2·1·1</div>
            </div>
          </div>
        </div>
      </div>
    </Browser>
  );
}

// ─── C. Split basket — literal bags mockup
function CompareC_Mobile() {
  return (
    <Phone>
      <div style={{ padding: '14px 14px 0' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Best split · 3 stops</div>
        <div style={{ fontSize: 10, color: WF.sub }}>total <b>€25.84</b> · saves €1.80 vs. cheapest single</div>
      </div>
      <div style={{ padding: '14px 14px 0' }}>
        {[
          ['Stop 1', 'RI', 'Rimi Gedimino', ['Duona','Pienas ×2','Sūris','Salotos'], '8.28', '650m'],
          ['Stop 2', 'IK', 'IKI Mindaugo', ['Obuoliai','Bananai','Jogurtas'], '5.34', '+170m'],
          ['Stop 3', 'PR', 'PROMO C&C', ['Vištiena ×2','Vanduo ×2','Kiauš.','Makar.','Kava'], '12.22', '+2.3km'],
        ].map(([s, m, n, items, total, dist], i) => (
          <div key={s} style={{ position: 'relative', marginBottom: 12 }}>
            {/* numbered circle */}
            <div style={{ position: 'absolute', left: -4, top: 10, width: 22, height: 22, border: `1px solid ${WF.ink}`, borderRadius: 11, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, fontFamily: WF.mono }}>
              {i+1}
            </div>
            <div style={{ marginLeft: 28, border: `1px solid ${WF.line}`, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <StoreMark label={m} size={20} filled />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{n}</div>
                  <div style={{ fontSize: 9, color: WF.sub }}>{dist}</div>
                </div>
                <div style={{ fontFamily: WF.mono, fontSize: 13, fontWeight: 600 }}>€{total}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {items.map((it) => <Chip key={it}>{it}</Chip>)}
              </div>
            </div>
          </div>
        ))}
      </div>
      <MobileNav active="list" />
    </Phone>
  );
}

function CompareC_Desktop() {
  return (
    <Browser url="grocery.local/compare/split">
      <div style={{ display: 'flex', height: '100%' }}>
        <SideNav active="list" />
        <div style={{ flex: 1, padding: '26px 32px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>Split-basket plan</div>
            <div style={{ fontSize: 12, color: WF.sub }}>3 stops · total distance 3.1 km · save €1.80</div>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 11 }}>Max stops: <b>3</b> · max detour: <b>3 km</b></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) 260px', gap: 16, marginTop: 22 }}>
            {[
              ['01','RI','Rimi Gedimino','650m',
                [['Duona juoda','1.29'],['Pienas 2.5% ×2','1.98'],['Sūris Džiugas','3.40'],['Salotos','1.30'],['Makaronai ×2','2.30']],
                '10.27','5 items'],
              ['02','IK','IKI Mindaugo','+170m',
                [['Obuoliai 1kg','1.39'],['Bananai 1kg','1.15'],['Jogurtas ×4','2.80']],
                '5.34','3 items'],
              ['03','PR','PROMO C&C','+2.3km',
                [['Vištiena fileta ×2','7.80'],['Kiaušiniai ×10','2.79'],['Kava malta','5.99'],['Vanduo 5L ×2','1.78']],
                '18.36','4 items'],
            ].map(([num, m, n, d, items, total, cnt]) => (
              <div key={num} style={{ border: `1px solid ${WF.line}`, background: '#fff', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: 14, borderBottom: `1px solid ${WF.hair}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <div style={{ fontFamily: WF.mono, fontSize: 10, fontWeight: 700, background: WF.ink, color: '#fff', padding: '2px 6px' }}>STOP {num}</div>
                    <div style={{ fontSize: 10, color: WF.sub }}>{d}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <StoreMark label={m} size={26} filled />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{n}</div>
                      <div style={{ fontSize: 10, color: WF.sub }}>{cnt}</div>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '10px 14px', flex: 1 }}>
                  {items.map(([i, p]) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11 }}>
                      <span>{i}</span><span style={{ fontFamily: WF.mono }}>€{p}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '10px 14px', borderTop: `1px solid ${WF.hair}`, background: WF.paper, display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 12 }}>
                  <span>Subtotal</span><span style={{ fontFamily: WF.mono }}>€{total}</span>
                </div>
              </div>
            ))}

            <div style={{ border: `1px solid ${WF.ink}`, padding: 20, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4 }}>Grand total</div>
              <div style={{ fontSize: 30, fontWeight: 700, fontFamily: WF.mono, marginTop: 6 }}>€25.84</div>
              <Rule style={{ margin: '14px 0' }} />
              <div style={{ fontSize: 11, color: WF.sub, display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>vs. Rimi alone</span><span style={{ color: WF.ink }}>−€1.80</span>
              </div>
              <div style={{ fontSize: 11, color: WF.sub, display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>vs. PROMO alone</span><span style={{ color: WF.ink }}>−€5.96</span>
              </div>
              <div style={{ fontSize: 11, color: WF.sub, display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>Extra distance</span><span>3.1 km</span>
              </div>
              <div style={{ flex: 1 }} />
              <Btn primary block style={{ marginTop: 14 }}>Open map route</Btn>
              <Btn block style={{ marginTop: 8 }}>Collapse to 1 stop</Btn>
            </div>
          </div>
        </div>
      </div>
    </Browser>
  );
}

// ─── D. Savings-first, with "most expensive" as anchor
function CompareD_Mobile() {
  return (
    <Phone>
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 10, color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.4 }}>You can save up to</div>
        <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: -1.2 }}>€5.96</div>
        <div style={{ fontSize: 11, color: WF.sub, marginTop: -2 }}>vs. shopping at PROMO Cash&amp;Carry</div>
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        {/* savings bars, anchored to most expensive */}
        <div style={{ fontSize: 10, color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Savings per store</div>
        {[
          ['Rimi','RI','5.96','much cheaper', 100],
          ['IKI','IK','4.50','cheaper', 75],
          ['Barbora','BA','3.38','cheaper', 57],
          ['PROMO','PR','0.00','baseline', 0],
        ].map(([n, m, s, note, pct]) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${WF.hair}` }}>
            <StoreMark label={m} size={20} filled={pct === 100} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{n}</div>
              <div style={{ height: 4, background: WF.hair, marginTop: 4, position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: WF.ink }} />
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: WF.mono, fontSize: 13, fontWeight: 600 }}>−€{s}</div>
              <div style={{ fontSize: 9, color: WF.sub }}>{note}</div>
            </div>
          </div>
        ))}

        <div style={{ marginTop: 20, padding: 14, background: WF.paper, border: `1px solid ${WF.hair}` }}>
          <div style={{ fontSize: 11, lineHeight: 1.5 }}>
            That's <b>21% off</b> an identical 12-item basket. Over a year, about <b>€310</b> saved.
          </div>
        </div>
        <AdBanner small style={{ marginTop: 10 }} />
      </div>
      <MobileNav active="list" />
    </Phone>
  );
}

function CompareD_Desktop() {
  return (
    <Browser url="grocery.local/compare">
      <div style={{ display: 'flex', height: '100%' }}>
        <SideNav active="list" />
        <div style={{ flex: 1, padding: '40px 48px', overflow: 'hidden' }}>
          <div style={{ fontSize: 11, color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.5 }}>Savings breakdown · 12-item basket</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, marginTop: 12 }}>
            <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2.5, lineHeight: 1 }}>€5.96</div>
            <div style={{ paddingBottom: 14 }}>
              <div style={{ fontSize: 13, color: WF.sub }}>max possible saving</div>
              <div style={{ fontSize: 13, color: WF.sub }}>= <b style={{ color: WF.ink }}>21%</b> off · ≈ <b style={{ color: WF.ink }}>€310/yr</b></div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 40, marginTop: 36 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 14 }}>By store (vs. most expensive)</div>
              {[
                ['Rimi','RI','5.96','cheapest overall', 100],
                ['IKI','IK','4.50','−15%', 75],
                ['Barbora','BA','3.38','−11%', 57],
                ['PROMO C&C','PR','0.00','baseline', 0],
              ].map(([n, m, s, note, pct]) => (
                <div key={n} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 2fr 120px', gap: 14, alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${WF.hair}` }}>
                  <StoreMark label={m} size={24} filled={pct === 100} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: pct === 100 ? 700 : 500 }}>{n}</div>
                    <div style={{ fontSize: 10, color: WF.sub }}>{note}</div>
                  </div>
                  <div style={{ height: 10, background: WF.hair, position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: WF.ink }} />
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: WF.mono, fontSize: 16, fontWeight: 600 }}>−€{s}</div>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 14 }}>Biggest individual savings</div>
              {[
                ['Vištiena fileta ×2', 'PR → buy here', '−€0.60'],
                ['Kava malta 250g', 'BA → buy here', '−€0.26'],
                ['Sūris Džiugas', 'RI → buy here', '−€0.15'],
                ['Obuoliai 1kg', 'IK → buy here', '−€0.10'],
              ].map(([n, s, d]) => (
                <div key={n} style={{ padding: '12px 14px', border: `1px solid ${WF.hair}`, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{n}</div>
                    <div style={{ fontSize: 10, color: WF.sub }}>{s}</div>
                  </div>
                  <div style={{ fontFamily: WF.mono, fontSize: 13, fontWeight: 600 }}>{d}</div>
                </div>
              ))}

              <Btn primary block style={{ marginTop: 14 }}>Maximize savings → split plan</Btn>
              <AdSideRail style={{ marginTop: 16 }} />
            </div>
          </div>
        </div>
      </div>
    </Browser>
  );
}

Object.assign(window, {
  CompareA_Mobile, CompareA_Desktop, CompareB_Mobile, CompareB_Desktop,
  CompareC_Mobile, CompareC_Desktop, CompareD_Mobile, CompareD_Desktop,
});
