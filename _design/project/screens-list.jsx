// Grocery list builder — 4 variations

// ─── A. Checkable list with per-item store assignment
function ListA_Mobile() {
  const items = [
    ['Duona juoda', 'RI', '1.29', true],
    ['Pienas 2.5% 1L', 'RI', '0.99', true],
    ['Obuoliai 1kg', 'IK', '1.39', false],
    ['Kiaušiniai ×10', 'BA', '2.49', false],
    ['Sūris Džiugas', 'RI', '3.40', false],
    ['Vištiena fileta', 'PR', '3.90', false],
    ['Bananai 1kg', 'IK', '1.15', false],
  ];
  return (
    <Phone>
      <div style={{ padding: '14px 14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>My list</div>
          <div style={{ fontSize: 10, color: WF.sub }}>7 items · 2 done</div>
        </div>
        <Chip active>Smart stores</Chip>
      </div>
      <div style={{ padding: '10px 14px 0' }}>
        {items.map(([n, s, p, done], i) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${WF.hair}` }}>
            <Box w={16} h={16} r={2} bg={done ? WF.ink : '#fff'} style={{ border: `1px solid ${WF.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {done && <Icon kind="check" size={10} color="#fff" />}
            </Box>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, textDecoration: done ? 'line-through' : 'none', color: done ? WF.mute : WF.ink }}>{n}</div>
              <div style={{ fontSize: 9, color: WF.sub, fontFamily: WF.mono }}>cheapest @ {s}</div>
            </div>
            <StoreMark label={s} size={18} />
            <div style={{ width: 44, textAlign: 'right', fontFamily: WF.mono, fontSize: 11 }}>€{p}</div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', color: WF.sub }}>
          <Box w={16} h={16} r={2} style={{ border: `1px dashed ${WF.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon kind="plus" size={10} color={WF.sub} /></Box>
          <span style={{ fontSize: 12 }}>Add item…</span>
        </div>
        <AdBanner small style={{ marginTop: 8 }} headline="Tavo sąraše: sviestas" sub="Prežero −15% Rimi → pridėk kuponą" />
      </div>
      <div style={{ position: 'absolute', bottom: 52, left: 0, right: 0, padding: '10px 14px', borderTop: `1px solid ${WF.hair}`, background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 9, color: WF.sub, textTransform: 'uppercase', letterSpacing: 0.4 }}>Total (best split)</div>
          <div style={{ fontSize: 17, fontWeight: 600, fontFamily: WF.mono }}>€14.61</div>
        </div>
        <Btn primary>Compare →</Btn>
      </div>
      <MobileNav active="list" />
    </Phone>
  );
}

function ListA_Desktop() {
  return (
    <Browser url="grocery.local/list">
      <div style={{ display: 'flex', height: '100%' }}>
        <SideNav active="list" />
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', overflow: 'hidden' }}>
          <div style={{ padding: '24px 32px', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>My list</div>
              <div style={{ fontSize: 11, color: WF.sub }}>12 items · updated 4 min ago</div>
              <div style={{ flex: 1 }} />
              <Btn small>Import</Btn><Btn small>Share</Btn>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, border: `1px solid ${WF.line}`, padding: '8px 12px' }}>
              <Icon kind="plus" size={13} color={WF.sub} />
              <span style={{ fontSize: 12, color: WF.mute }}>Add item — try "sviestas" or "2L vanduo"…</span>
            </div>

            <div style={{ marginTop: 18, border: `1px solid ${WF.hair}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 110px 90px 70px 60px', padding: '9px 14px', background: WF.paper, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: WF.sub, borderBottom: `1px solid ${WF.hair}` }}>
                <div /><div>Item</div><div>Cheapest at</div><div style={{ textAlign: 'right' }}>Price</div><div style={{ textAlign: 'right' }}>Qty</div><div />
              </div>
              {[
                ['Duona juoda Vilniaus', 'Rimi', '1.29', 1],
                ['Pienas 2.5% 1L', 'Rimi', '0.99', 2],
                ['Obuoliai, raudoni 1kg', 'IKI', '1.39', 1],
                ['Kiaušiniai M ×10', 'Barbora', '2.49', 1],
                ['Sūris Džiugas 200g', 'Rimi', '3.40', 1],
                ['Vištiena fileta 500g', 'PROMO C&C', '3.90', 2],
                ['Bananai 1kg', 'IKI', '1.15', 1],
                ['Makaronai Barilla', 'Rimi', '1.15', 2],
                ['Kava malta 250g', 'Barbora', '5.99', 1],
                ['Jogurtas ×4', 'IKI', '2.80', 1],
                ['Salotos ledinės', 'Rimi', '1.30', 1],
                ['Vanduo 5L', 'PROMO C&C', '0.89', 2],
              ].map(([n, s, p, q], i) => (
                <div key={n} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 110px 90px 70px 60px', padding: '10px 14px', borderBottom: i < 11 ? `1px solid ${WF.hair}` : 'none', alignItems: 'center', fontSize: 12 }}>
                  <Box w={14} h={14} r={2} style={{ border: `1px solid ${WF.line}` }} />
                  <div>{n}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: WF.sub }}>
                    <StoreMark label={s.slice(0, 2).toUpperCase()} size={16} /> {s}
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: WF.mono }}>€{p}</div>
                  <div style={{ textAlign: 'right', fontFamily: WF.mono, color: WF.sub }}>×{q}</div>
                  <div style={{ textAlign: 'right', color: WF.mute }}>
                    <Icon kind="trash" size={12} color={WF.mute} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderLeft: `1px solid ${WF.hair}`, padding: '24px 22px', background: WF.paper }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4 }}>Totals</div>
            <div style={{ marginTop: 12 }}>
              {[['Rimi','27.64','cheapest'],['IKI','29.10',''],['Barbora','30.22',''],['PROMO','31.80','']].map(([n, p, note], i) => (
                <div key={n} style={{ padding: '10px 0', borderBottom: `1px solid ${WF.hair}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StoreMark label={n.slice(0,2).toUpperCase()} size={20} filled={i===0} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: i===0?600:400 }}>{n}</div>
                    {note && <div style={{ fontSize: 9, color: WF.sub }}>{note}</div>}
                  </div>
                  <div style={{ fontFamily: WF.mono, fontSize: 13, fontWeight: 600 }}>€{p}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 18, padding: 14, border: `1px solid ${WF.ink}`, background: '#fff' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4 }}>Best split · 3 stops</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: WF.mono, marginTop: 4 }}>€25.84</div>
              <div style={{ fontSize: 10, color: WF.sub, marginTop: 4 }}>saves €1.80 over cheapest single</div>
              <Btn primary block style={{ marginTop: 10 }}>View split plan →</Btn>
            </div>
            <AdSideRail style={{ marginTop: 16 }} />
          </div>
        </div>
      </div>
    </Browser>
  );
}

// ─── B. Swipeable cards (mobile-first), kanban columns (desktop)
function ListB_Mobile() {
  return (
    <Phone>
      <div style={{ padding: '14px 14px 0' }}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>This week</div>
        <div style={{ fontSize: 10, color: WF.sub, marginTop: 2 }}>swipe right to check off · left to move store</div>
      </div>
      <div style={{ padding: '14px 14px 0' }}>
        {[
          ['Duona juoda', '1.29', 'RI', 'mid'],
          ['Pienas 2.5%', '0.99', 'RI', 'off'],
          ['Obuoliai', '1.39', 'IK', 'mid'],
        ].map(([n, p, s, pos], i) => (
          <div key={n} style={{ position: 'relative', marginBottom: 10, height: 62 }}>
            {/* swipe hint behind */}
            <div style={{ position: 'absolute', inset: 0, background: WF.fill, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 14px', fontSize: 10, color: WF.sub, fontFamily: WF.mono }}>
              <span>→ done</span><span>change store ←</span>
            </div>
            {/* foreground card, offset if not "centered" */}
            <div style={{
              position: 'absolute', inset: 0, background: '#fff',
              border: `1px solid ${WF.line}`, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
              transform: pos === 'off' ? 'translateX(46px)' : 'translateX(0)',
            }}>
              <Box w={28} h={28} r={2} bg={WF.chip} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{n}</div>
                <div style={{ fontSize: 10, color: WF.sub }}>cheapest @ {s}</div>
              </div>
              <div style={{ fontFamily: WF.mono, fontSize: 14, fontWeight: 600 }}>€{p}</div>
            </div>
          </div>
        ))}
        {[
          ['Kiaušiniai ×10', '2.49', 'BA'],
          ['Sūris Džiugas', '3.40', 'RI'],
          ['Bananai 1kg', '1.15', 'IK'],
        ].map(([n, p, s]) => (
          <div key={n} style={{ background: '#fff', border: `1px solid ${WF.line}`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Box w={28} h={28} r={2} bg={WF.chip} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{n}</div>
              <div style={{ fontSize: 10, color: WF.sub }}>cheapest @ {s}</div>
            </div>
            <div style={{ fontFamily: WF.mono, fontSize: 14, fontWeight: 600 }}>€{p}</div>
          </div>
        ))}
      </div>
      <MobileNav active="list" />
    </Phone>
  );
}

function ListB_Desktop() {
  return (
    <Browser url="grocery.local/list">
      <div style={{ display: 'flex', height: '100%' }}>
        <SideNav active="list" />
        <div style={{ flex: 1, padding: '24px 28px', overflow: 'hidden' }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>Shopping plan · by store</div>
          <div style={{ fontSize: 12, color: WF.sub, marginTop: 2 }}>drag items between columns to reroute</div>
          <AdLeaderboard style={{ marginTop: 14 }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 18, height: 'calc(100% - 80px)' }}>
            {[
              ['Rimi', 'RI', [['Duona juoda','1.29'],['Pienas 2.5%','0.99'],['Sūris Džiugas','3.40'],['Salotos','1.30']], '6.98'],
              ['IKI', 'IK', [['Obuoliai','1.39'],['Bananai','1.15'],['Jogurtas ×4','2.80']], '5.34'],
              ['Barbora', 'BA', [['Kiaušiniai ×10','2.49'],['Kava malta','5.99']], '8.48'],
              ['PROMO C&C', 'PR', [['Vištiena ×2','7.80'],['Vanduo 5L ×2','1.78']], '9.58'],
            ].map(([n, m, items, total]) => (
              <div key={n} style={{ border: `1px solid ${WF.hair}`, display: 'flex', flexDirection: 'column', background: WF.paper }}>
                <div style={{ padding: 14, borderBottom: `1px solid ${WF.hair}`, display: 'flex', alignItems: 'center', gap: 10, background: '#fff' }}>
                  <StoreMark label={m} size={22} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{n}</div>
                    <div style={{ fontSize: 10, color: WF.sub }}>{items.length} items</div>
                  </div>
                  <div style={{ fontFamily: WF.mono, fontSize: 13, fontWeight: 600 }}>€{total}</div>
                </div>
                <div style={{ padding: 10, flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
                  {items.map(([i, p]) => (
                    <div key={i} style={{ background: '#fff', border: `1px solid ${WF.hair}`, padding: '8px 10px', display: 'flex', alignItems: 'center', fontSize: 11 }}>
                      <div style={{ flex: 1 }}>{i}</div>
                      <div style={{ fontFamily: WF.mono }}>€{p}</div>
                    </div>
                  ))}
                  <div style={{ border: `1px dashed ${WF.line}`, padding: '8px 10px', fontSize: 10, color: WF.mute, textAlign: 'center' }}>+ drop item here</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Browser>
  );
}

// ─── C. Note-pad style
function ListC_Mobile() {
  return (
    <Phone bg={WF.paper}>
      <div style={{ padding: '18px 20px 0' }}>
        <div style={{ fontSize: 9, color: WF.sub, letterSpacing: 1, fontFamily: WF.mono, textTransform: 'uppercase' }}>— apr 22 shopping —</div>
        <div style={{ fontFamily: '"Courier New", monospace', fontSize: 14, marginTop: 14, lineHeight: 2 }}>
          {[
            ['duona juoda', true],
            ['pienas 2.5%', true],
            ['obuoliai 1kg', false],
            ['kiaušiniai ×10', false],
            ['sūris Džiugas', false],
            ['vištiena fileta', false],
            ['bananai', false],
            ['makaronai', false],
          ].map(([t, done]) => (
            <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'center', borderBottom: `1px dashed ${WF.line}`, paddingBottom: 2 }}>
              <span style={{ width: 14, height: 14, border: `1.2px solid ${WF.ink}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{done ? '✓' : ''}</span>
              <span style={{ flex: 1, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.4 : 1 }}>{t}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 6, color: WF.mute }}>
            <span style={{ width: 14, height: 14, border: `1.2px dashed ${WF.line}` }} />
            <span style={{ fontSize: 12 }}>...</span>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 52, left: 0, right: 0, background: '#fff', borderTop: `1px solid ${WF.line}`, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon kind="chart" size={13} />
        <div style={{ flex: 1, fontSize: 11 }}>Basket €14.61 · Rimi cheapest</div>
        <Btn small primary>compare</Btn>
      </div>
      <MobileNav active="list" />
    </Phone>
  );
}

function ListC_Desktop() {
  return (
    <Browser url="grocery.local/list" bg={WF.paper}>
      <div style={{ display: 'flex', height: '100%' }}>
        <SideNav active="list" />
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
          <div style={{ padding: 36, borderRight: `1px dashed ${WF.line}` }}>
            <div style={{ fontSize: 9, color: WF.sub, letterSpacing: 1.5, fontFamily: WF.mono, textTransform: 'uppercase' }}>— weekly list · apr 22 —</div>
            <div style={{ fontFamily: '"Courier New", monospace', fontSize: 14, marginTop: 20, lineHeight: 2 }}>
              {[
                ['duona juoda, 600g', true],
                ['pienas 2.5% ×2', true],
                ['obuoliai, raudoni 1kg', false],
                ['kiaušiniai M ×10', false],
                ['sūris Džiugas 200g', false],
                ['vištiena fileta ×2', false],
                ['bananai 1kg', false],
                ['makaronai Barilla ×2', false],
                ['kava malta', false],
                ['jogurtas natūralus ×4', false],
                ['salotos ledinės', false],
                ['vanduo 5L ×2', false],
              ].map(([t, done]) => (
                <div key={t} style={{ display: 'flex', gap: 14, alignItems: 'center', borderBottom: `1px dashed ${WF.line}`, paddingBottom: 4 }}>
                  <span style={{ width: 16, height: 16, border: `1.5px solid ${WF.ink}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{done ? '✓' : ''}</span>
                  <span style={{ flex: 1, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.4 : 1 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: 36 }}>
            <div style={{ fontSize: 9, color: WF.sub, letterSpacing: 1.5, fontFamily: WF.mono, textTransform: 'uppercase' }}>— price comparison —</div>
            <div style={{ fontFamily: '"Courier New", monospace', fontSize: 13, marginTop: 20 }}>
              {[
                ['rimi        ', '27.64', '*cheapest*'],
                ['iki         ', '29.10', '+1.46'],
                ['barbora     ', '30.22', '+2.58'],
                ['promo c&c   ', '31.80', '+4.16'],
                ['            ', '     ', ''],
                ['best split  ', '25.84', '3 stops'],
                ['            ', '     ', ''],
                ['saved vs max', ' 5.96', ''],
              ].map(([a, b, c], i) => (
                <div key={i} style={{ display: 'flex', gap: 16, borderBottom: `1px dashed ${WF.line}`, padding: '4px 0' }}>
                  <span style={{ flex: 1 }}>{a}</span>
                  <span style={{ width: 80, textAlign: 'right' }}>€{b}</span>
                  <span style={{ width: 90, color: WF.sub }}>{c}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 28, fontSize: 9, color: WF.sub, letterSpacing: 1.5, fontFamily: WF.mono, textTransform: 'uppercase' }}>— notes —</div>
            <div style={{ fontFamily: '"Courier New", monospace', fontSize: 13, marginTop: 10, lineHeight: 1.8, color: WF.sub }}>
              - sviestas on promo at rimi<br/>
              - jogurtas +12% since mar<br/>
              - check wk 18 for coffee
            </div>
          </div>
        </div>
      </div>
    </Browser>
  );
}

// ─── D. Table/spreadsheet style, quantity+store combos editable
function ListD_Mobile() {
  return (
    <Phone>
      <div style={{ padding: '14px 12px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>List · table view</div>
          <Chip>+ row</Chip>
        </div>
      </div>
      <div style={{ padding: '10px 0 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 40px 60px 50px', padding: '6px 12px', background: WF.paper, fontSize: 9, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4, borderTop: `1px solid ${WF.hair}`, borderBottom: `1px solid ${WF.hair}` }}>
          <div>item</div><div>qty</div><div>store</div><div style={{ textAlign: 'right' }}>€</div>
        </div>
        {[
          ['Duona juoda', '1', 'Rimi', '1.29'],
          ['Pienas 2.5%', '2', 'Rimi', '1.98'],
          ['Obuoliai 1kg', '1', 'IKI', '1.39'],
          ['Kiaušiniai ×10', '1', 'Barbora', '2.49'],
          ['Sūris Džiugas', '1', 'Rimi', '3.40'],
          ['Vištiena', '2', 'PROMO', '7.80'],
          ['Bananai', '1', 'IKI', '1.15'],
          ['Makaronai', '2', 'Rimi', '2.30'],
          ['Kava malta', '1', 'Barbora', '5.99'],
        ].map(([n, q, s, p], i) => (
          <div key={n} style={{ display: 'grid', gridTemplateColumns: '1.4fr 40px 60px 50px', padding: '8px 12px', borderBottom: `1px solid ${WF.hair}`, fontSize: 11, alignItems: 'center' }}>
            <div>{n}</div>
            <div style={{ fontFamily: WF.mono, color: WF.sub }}>×{q}</div>
            <div style={{ fontSize: 10, color: WF.sub }}>{s}</div>
            <div style={{ textAlign: 'right', fontFamily: WF.mono, fontWeight: 500 }}>€{p}</div>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 40px 60px 50px', padding: '10px 12px', background: WF.paper, fontSize: 11, fontWeight: 700 }}>
          <div>TOTAL</div><div /><div /><div style={{ textAlign: 'right', fontFamily: WF.mono }}>€27.79</div>
        </div>
      </div>
      <MobileNav active="list" />
    </Phone>
  );
}

function ListD_Desktop() {
  return (
    <Browser url="grocery.local/list">
      <TopBar active="list" />
      <div style={{ padding: '22px 32px', overflow: 'hidden', height: 'calc(100% - 48px)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>list.csv</div>
          <div style={{ fontSize: 11, color: WF.sub, fontFamily: WF.mono }}>12 rows · 4 cols · edited 4 min ago</div>
          <div style={{ flex: 1 }} />
          <Btn small>Export CSV</Btn><Btn small>Duplicate</Btn><Btn small primary>Recalc</Btn>
        </div>

        <div style={{ border: `1px solid ${WF.line}`, fontSize: 12 }}>
          {/* header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '40px 2fr 60px 140px 80px 80px 80px 80px 40px', background: WF.paper, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: WF.sub, borderBottom: `1px solid ${WF.line}` }}>
            {['#','item','qty','cheapest at','rimi','iki','barbora','promo',''].map((c, i) => (
              <div key={i} style={{ padding: '8px 10px', borderRight: i < 8 ? `1px solid ${WF.line}` : 'none', textAlign: i > 3 && i < 8 ? 'right' : 'left' }}>{c}</div>
            ))}
          </div>
          {[
            ['Duona juoda Vilniaus 500g', 1, 'Rimi', '1.29', '1.35', '1.49', null],
            ['Pienas 2.5% 1L', 2, 'Rimi', '0.99', '1.05', '1.09', '0.89'],
            ['Obuoliai 1kg', 1, 'IKI', '1.49', '1.39', '1.55', '1.45'],
            ['Kiaušiniai M ×10', 1, 'Barbora', '2.69', '2.55', '2.49', '2.79'],
            ['Sūris Džiugas 200g', 1, 'Rimi', '3.40', '3.55', '3.49', null],
            ['Vištiena fileta 500g', 2, 'PROMO', '4.20', '4.10', '4.30', '3.90'],
            ['Bananai 1kg', 1, 'IKI', '1.25', '1.15', '1.29', '1.20'],
            ['Makaronai Barilla', 2, 'Rimi', '1.15', '1.19', '1.25', '1.09'],
            ['Kava malta 250g', 1, 'Barbora', '6.25', '6.10', '5.99', null],
            ['Jogurtas natūralus ×4', 1, 'IKI', '2.95', '2.80', '2.90', null],
            ['Salotos ledinės', 1, 'Rimi', '1.30', '1.45', '1.55', null],
            ['Vanduo 5L', 2, 'PROMO', '1.10', '1.05', '1.15', '0.89'],
          ].map(([n, q, s, ri, ik, ba, pr], i) => {
            const cheapest = Math.min(...[ri, ik, ba, pr].filter(x => x).map(Number));
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 2fr 60px 140px 80px 80px 80px 80px 40px', borderBottom: i < 11 ? `1px solid ${WF.hair}` : 'none' }}>
                <div style={{ padding: '8px 10px', background: WF.paper, color: WF.sub, fontSize: 10, fontFamily: WF.mono, borderRight: `1px solid ${WF.line}` }}>{i+1}</div>
                <div style={{ padding: '8px 10px', borderRight: `1px solid ${WF.line}` }}>{n}</div>
                <div style={{ padding: '8px 10px', borderRight: `1px solid ${WF.line}`, fontFamily: WF.mono, color: WF.sub }}>×{q}</div>
                <div style={{ padding: '8px 10px', borderRight: `1px solid ${WF.line}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <StoreMark label={s.slice(0,2).toUpperCase()} size={14} /> {s}
                </div>
                {[ri, ik, ba, pr].map((p, j) => (
                  <div key={j} style={{ padding: '8px 10px', borderRight: `1px solid ${WF.line}`, textAlign: 'right', fontFamily: WF.mono, background: Number(p) === cheapest ? WF.accentSoft : 'transparent', color: p ? WF.ink : WF.mute, fontWeight: Number(p) === cheapest ? 700 : 400 }}>
                    {p ? '€' + p : '—'}
                  </div>
                ))}
                <div style={{ padding: '8px 10px', textAlign: 'center', color: WF.mute }}><Icon kind="trash" size={11} color={WF.mute} /></div>
              </div>
            );
          })}
          <div style={{ display: 'grid', gridTemplateColumns: '40px 2fr 60px 140px 80px 80px 80px 80px 40px', background: WF.paper, fontWeight: 700, fontSize: 12 }}>
            <div style={{ padding: '10px', borderRight: `1px solid ${WF.line}`, color: WF.sub }}>Σ</div>
            <div style={{ padding: '10px', borderRight: `1px solid ${WF.line}` }}>TOTAL</div>
            <div style={{ padding: '10px', borderRight: `1px solid ${WF.line}`, color: WF.sub }} />
            <div style={{ padding: '10px', borderRight: `1px solid ${WF.line}`, color: WF.sub, fontSize: 10, fontWeight: 400 }}>(split: €25.84)</div>
            <div style={{ padding: '10px', borderRight: `1px solid ${WF.line}`, textAlign: 'right', fontFamily: WF.mono }}>27.64</div>
            <div style={{ padding: '10px', borderRight: `1px solid ${WF.line}`, textAlign: 'right', fontFamily: WF.mono }}>29.10</div>
            <div style={{ padding: '10px', borderRight: `1px solid ${WF.line}`, textAlign: 'right', fontFamily: WF.mono }}>30.22</div>
            <div style={{ padding: '10px', borderRight: `1px solid ${WF.line}`, textAlign: 'right', fontFamily: WF.mono }}>31.80</div>
            <div />
          </div>
        </div>
      </div>
    </Browser>
  );
}

Object.assign(window, {
  ListA_Mobile, ListA_Desktop, ListB_Mobile, ListB_Desktop,
  ListC_Mobile, ListC_Desktop, ListD_Mobile, ListD_Desktop,
});
