// Search / browse products — 4 variations

// ─── A. Filter rail + compact grid (desktop-native)
function SearchA_Mobile() {
  return (
    <Phone>
      <div style={{ padding: '14px 14px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${WF.line}`, padding: '7px 10px' }}>
          <Icon kind="search" size={13} color={WF.sub} />
          <span style={{ flex: 1, fontSize: 12 }}>pienas</span>
          <span style={{ fontSize: 10, color: WF.sub, fontFamily: WF.mono }}>48 results</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, overflow: 'hidden' }}>
          <Chip active>All stores</Chip><Chip>Rimi</Chip><Chip>IKI</Chip><Chip>Barbora</Chip>
        </div>
      </div>
      <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ border: `1px solid ${WF.hair}`, padding: 8 }}>
            <ImgPlaceholder h={64} label="product" />
            <div style={{ fontSize: 11, marginTop: 6, fontWeight: 500 }}>{['Pienas 2.5% 1L','Pienas Rokiškio','Pienas, ekolog.','Pienas be lakt.','Pienas 3.5% 1L','Pienas Dobilas'][i]}</div>
            <div style={{ fontSize: 9, color: WF.sub }}>{['Rimi','IKI','Rimi','Barbora','IKI','PROMO'][i]}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: WF.mono }}>€{[0.99, 1.15, 1.79, 1.49, 1.25, 0.89][i]}</span>
              <Box w={18} h={18} r={2} style={{ border: `1px solid ${WF.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon kind="plus" size={10} />
              </Box>
            </div>
          </div>
        ))}
      </div>
      <MobileNav active="search" />
    </Phone>
  );
}

function SearchA_Desktop() {
  return (
    <Browser url="grocery.local/search?q=pienas">
      <div style={{ display: 'flex', height: '100%' }}>
        <SideNav active="search" />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* filters */}
          <div style={{ width: 200, borderRight: `1px solid ${WF.hair}`, padding: '22px 18px', fontSize: 11 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4, marginBottom: 8 }}>Stores</div>
            {['Rimi', 'IKI', 'Barbora', 'PROMO C&C'].map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <Box w={12} h={12} r={1} bg={i < 3 ? WF.ink : '#fff'} style={{ border: `1px solid ${WF.line}` }} />
                {s}
              </div>
            ))}
            <div style={{ height: 18 }} />
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4, marginBottom: 8 }}>Category</div>
            {['Dairy', 'Bakery', 'Produce', 'Meat', 'Pantry', 'Beverages'].map((c) => (
              <div key={c} style={{ padding: '4px 0', color: c === 'Dairy' ? WF.ink : WF.sub, fontWeight: c === 'Dairy' ? 600 : 400 }}>{c}</div>
            ))}
            <div style={{ height: 18 }} />
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4, marginBottom: 8 }}>Price</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ flex: 1, height: 22, border: `1px solid ${WF.line}`, fontFamily: WF.mono, fontSize: 10, display: 'flex', alignItems: 'center', padding: '0 6px' }}>€0</div>
              <span style={{ fontSize: 10, color: WF.sub }}>—</span>
              <div style={{ flex: 1, height: 22, border: `1px solid ${WF.line}`, fontFamily: WF.mono, fontSize: 10, display: 'flex', alignItems: 'center', padding: '0 6px' }}>€5</div>
            </div>
            <div style={{ height: 18 }} />
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4, marginBottom: 8 }}>Attributes</div>
            {['Organic', 'Lactose-free', 'LT origin', 'Promo now'].map((a) => (
              <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <Box w={12} h={12} r={1} style={{ border: `1px solid ${WF.line}` }} />
                {a}
              </div>
            ))}
          </div>

          {/* grid */}
          <div style={{ flex: 1, padding: '22px 28px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 32, border: `1px solid ${WF.line}`, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 8 }}>
                <Icon kind="search" size={14} color={WF.sub} />
                <span style={{ fontSize: 12 }}>pienas</span>
              </div>
              <div style={{ fontSize: 11, color: WF.sub, fontFamily: WF.mono }}>48 results</div>
              <div style={{ fontSize: 11 }}>Sort: <b>price ↑</b></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} style={{ border: `1px solid ${WF.hair}`, padding: 10 }}>
                  <ImgPlaceholder h={90} label="milk" />
                  <div style={{ fontSize: 11, marginTop: 8, fontWeight: 500 }}>{['Pienas 2.5% 1L','Rokiškio 2.5%','Ekologiškas 1L','Be laktozės','Pienas 3.5%','Dobilas 1L','UHT 0.5L','Avių pienas','Ožkų 1L','A2 1L','Kefyras','Pasukos'][i]}</div>
                  <div style={{ fontSize: 9, color: WF.sub, marginTop: 2 }}>{['Rimi','IKI','Rimi','Barbora','IKI','PROMO','Rimi','IKI','Barbora','Rimi','IKI','PROMO'][i]}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: WF.mono }}>€{(0.89 + i * 0.11).toFixed(2)}</span>
                    <Box w={22} h={22} r={2} style={{ border: `1px solid ${WF.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon kind="plus" size={11} />
                    </Box>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Browser>
  );
}

// ─── B. Category-first (visual browse)
function SearchB_Mobile() {
  return (
    <Phone>
      <div style={{ padding: '14px 14px 0' }}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Browse</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${WF.line}`, padding: '7px 10px', marginTop: 10 }}>
          <Icon kind="search" size={13} color={WF.sub} />
          <span style={{ flex: 1, fontSize: 12, color: WF.mute }}>products, brands, stores…</span>
        </div>
      </div>
      <div style={{ padding: '14px 14px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {['Dairy · 84', 'Bakery · 62', 'Produce · 120', 'Meat · 48', 'Pantry · 210', 'Beverages · 95', 'Frozen · 58', 'Snacks · 72'].map((c, i) => (
          <div key={c} style={{ border: `1px solid ${WF.hair}`, padding: 12, aspectRatio: '1 / 1', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <ImgPlaceholder h={50} label="" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{c.split(' · ')[0]}</div>
              <div style={{ fontSize: 9, color: WF.sub, fontFamily: WF.mono }}>{c.split(' · ')[1]} items</div>
            </div>
          </div>
        ))}
      </div>
      <MobileNav active="search" />
    </Phone>
  );
}

function SearchB_Desktop() {
  return (
    <Browser url="grocery.local/browse">
      <TopBar active="search" />
      <div style={{ padding: '28px 40px', overflow: 'hidden', height: 'calc(100% - 48px)' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>Browse categories</div>
        <div style={{ fontSize: 12, color: WF.sub, marginTop: 4 }}>412 items tracked across 4 chains</div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <div style={{ flex: 1, height: 36, border: `1px solid ${WF.line}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
            <Icon kind="search" size={14} color={WF.sub} />
            <span style={{ fontSize: 12, color: WF.mute }}>Search products, brands, stores…</span>
          </div>
          <Btn>Filters</Btn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 22 }}>
          {[
            ['Dairy', 84, 'milk · yoghurt · cheese'],
            ['Bakery', 62, 'bread · pastries'],
            ['Produce', 120, 'fruit · veg · herbs'],
            ['Meat & fish', 48, 'chicken · pork · salmon'],
            ['Pantry', 210, 'pasta · oils · canned'],
            ['Beverages', 95, 'water · juice · coffee'],
            ['Frozen', 58, 'peas · pizza · ice cream'],
            ['Snacks', 72, 'cookies · chips · nuts'],
          ].map(([n, c, sub]) => (
            <div key={n} style={{ border: `1px solid ${WF.hair}` }}>
              <ImgPlaceholder h={120} label={n.toLowerCase()} style={{ borderWidth: '0 0 1px' }} />
              <div style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{n}</div>
                  <div style={{ fontSize: 10, color: WF.sub, fontFamily: WF.mono }}>{c}</div>
                </div>
                <div style={{ fontSize: 11, color: WF.sub, marginTop: 4 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Browser>
  );
}

// ─── C. Command-bar / keyboard-first search
function SearchC_Mobile() {
  return (
    <Phone>
      <div style={{ padding: '14px 14px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1.5px solid ${WF.ink}`, padding: '10px 12px' }}>
          <Icon kind="search" size={13} />
          <span style={{ flex: 1, fontSize: 13, fontFamily: WF.mono }}>sūr_</span>
          <span style={{ fontSize: 9, color: WF.sub, fontFamily: WF.mono }}>↵</span>
        </div>
        <div style={{ fontSize: 9, color: WF.sub, fontFamily: WF.mono, marginTop: 6, letterSpacing: 0.3 }}>
          try: <span style={{ color: WF.ink }}>duona &lt; 2€</span> · <span style={{ color: WF.ink }}>sviestas lact-free</span>
        </div>
      </div>

      <div style={{ padding: '16px 14px 0' }}>
        <div style={{ fontSize: 9, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4, marginBottom: 6 }}>Suggestions</div>
        {[
          ['Sūris Džiugas 200g', 'Rimi · €3.40'],
          ['Sūris Rokiškio', 'IKI · €2.89'],
          ['Sūris Grünland', 'Barbora · €4.20'],
          ['Sūrelis Karums', 'Rimi · €0.55'],
        ].map(([n, s]) => (
          <div key={n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 6px', borderBottom: `1px solid ${WF.hair}` }}>
            <div>
              <div style={{ fontSize: 12 }}><u style={{ textDecoration: 'none', background: WF.accentSoft }}>sūr</u>{n.slice(3)}</div>
              <div style={{ fontSize: 10, color: WF.sub, fontFamily: WF.mono }}>{s}</div>
            </div>
            <Icon kind="arrow" size={12} color={WF.mute} />
          </div>
        ))}

        <div style={{ fontSize: 9, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4, margin: '14px 0 6px' }}>Recent</div>
        {['pienas', 'duona juoda', 'obuoliai'].map((r) => (
          <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', fontSize: 11, color: WF.sub }}>
            <Icon kind="cal" size={11} color={WF.mute} />{r}
          </div>
        ))}
        <AdBanner small style={{ marginTop: 12 }} />
      </div>

      {/* fake keyboard */}
      <div style={{ position: 'absolute', bottom: 52, left: 0, right: 0, background: WF.paper, padding: 6, borderTop: `1px solid ${WF.hair}` }}>
        {['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: 3, justifyContent: 'center', marginBottom: 3 }}>
            {row.split('').map((k) => (
              <div key={k} style={{ flex: 1, height: 22, background: '#fff', border: `1px solid ${WF.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{k}</div>
            ))}
          </div>
        ))}
      </div>
      <MobileNav active="search" />
    </Phone>
  );
}

function SearchC_Desktop() {
  return (
    <Browser url="grocery.local/">
      <div style={{ display: 'flex', height: '100%' }}>
        <SideNav active="search" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '80px 40px' }}>
          <div style={{ width: 560, border: `1px solid ${WF.ink}`, background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.08)' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${WF.hair}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Icon kind="search" size={16} color={WF.sub} />
              <span style={{ flex: 1, fontSize: 16, fontFamily: WF.mono }}>sūris &lt; 5€<span style={{ background: WF.ink, width: 1.5, height: 16, display: 'inline-block', marginLeft: 2, verticalAlign: 'middle' }} /></span>
              <span style={{ fontSize: 10, color: WF.sub, fontFamily: WF.mono, background: WF.chip, padding: '2px 6px' }}>ESC</span>
            </div>

            <div style={{ padding: '10px 0' }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.5, padding: '0 20px 6px' }}>Matching products · 14</div>
              {[
                ['Sūris Džiugas 200g', 'Rimi', '3.40', true],
                ['Sūris Rokiškio 300g', 'IKI', '2.89'],
                ['Sūris Grünland 250g', 'Barbora', '4.20'],
                ['Sūrelis Karums 40g', 'Rimi', '0.55'],
              ].map(([n, s, p, sel], i) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', background: sel ? WF.accentSoft : 'transparent', gap: 12, borderLeft: sel ? `2px solid ${WF.accent}` : '2px solid transparent' }}>
                  <Box w={22} h={22} r={2} bg={WF.chip} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{n}</div>
                    <div style={{ fontSize: 10, color: WF.sub }}>{s}</div>
                  </div>
                  <div style={{ fontFamily: WF.mono, fontSize: 13, fontWeight: 600 }}>€{p}</div>
                  <span style={{ fontSize: 9, color: WF.sub, fontFamily: WF.mono, background: sel ? '#fff' : WF.chip, padding: '2px 5px' }}>↵</span>
                </div>
              ))}

              <div style={{ fontSize: 9, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.5, padding: '14px 20px 6px' }}>Actions</div>
              {['Add "sūris" to list', 'Compare all matches across stores', 'Watch price →'].map((a) => (
                <div key={a} style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <Box w={16} h={16} r={2} style={{ border: `1px solid ${WF.line}` }} />
                  {a}
                </div>
              ))}
            </div>

            <div style={{ borderTop: `1px solid ${WF.hair}`, padding: '8px 20px', display: 'flex', gap: 16, fontSize: 10, color: WF.sub, fontFamily: WF.mono }}>
              <span>↑↓ navigate</span><span>↵ select</span><span>⌘K open</span><span style={{ marginLeft: 'auto' }}>4 / 4 stores</span>
            </div>
          </div>
        </div>
      </div>
    </Browser>
  );
}

// ─── D. Split-compare — search + inline per-store columns
function SearchD_Mobile() {
  return (
    <Phone>
      <div style={{ padding: '14px 14px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${WF.line}`, padding: '7px 10px' }}>
          <Icon kind="search" size={13} color={WF.sub} />
          <span style={{ flex: 1, fontSize: 12 }}>duona juoda</span>
        </div>
        <div style={{ fontSize: 10, color: WF.sub, marginTop: 8 }}>7 matches · compare inline</div>
      </div>

      <div style={{ padding: '10px 14px 0' }}>
        {[
          ['Duona juoda Vilniaus', '500g'],
          ['Duona Palangos', '400g'],
          ['Duona ruginė, sėklota', '600g'],
        ].map(([n, w], i) => (
          <div key={n} style={{ border: `1px solid ${WF.hair}`, padding: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ImgPlaceholder w={44} h={44} label="" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{n}</div>
                <div style={{ fontSize: 10, color: WF.sub }}>{w}</div>
              </div>
              <Box w={22} h={22} r={2} style={{ border: `1px solid ${WF.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon kind="plus" size={11} />
              </Box>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginTop: 10 }}>
              {[['RI', '1.29', true], ['IK', '1.35'], ['BA', '1.49'], ['PR', '—']].map(([m, p, cheap]) => (
                <div key={m} style={{ border: `1px solid ${cheap ? WF.ink : WF.hair}`, padding: '5px 4px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: WF.sub, fontWeight: 600 }}>{m}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, fontFamily: WF.mono }}>{p === '—' ? '—' : '€' + p}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <MobileNav active="search" />
    </Phone>
  );
}

function SearchD_Desktop() {
  return (
    <Browser url="grocery.local/search">
      <div style={{ display: 'flex', height: '100%' }}>
        <SideNav active="search" />
        <div style={{ flex: 1, padding: '22px 28px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            <div style={{ flex: 1, height: 34, border: `1px solid ${WF.line}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
              <Icon kind="search" size={14} color={WF.sub} />
              <span style={{ fontSize: 12 }}>duona</span>
            </div>
            <Btn>Filters · 2</Btn>
            <Btn>Sort · cheapest</Btn>
          </div>

          <div style={{ border: `1px solid ${WF.hair}` }}>
            {/* header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1fr 1fr 90px', padding: '10px 14px', borderBottom: `1px solid ${WF.hair}`, background: WF.paper, fontSize: 10, textTransform: 'uppercase', color: WF.sub, letterSpacing: 0.4 }}>
              <div>Product</div>
              <div style={{ textAlign: 'center' }}>Rimi</div>
              <div style={{ textAlign: 'center' }}>IKI</div>
              <div style={{ textAlign: 'center' }}>Barbora</div>
              <div style={{ textAlign: 'center' }}>PROMO</div>
              <div />
            </div>

            {[
              ['Duona juoda Vilniaus 500g', ['1.29', '1.35', '1.49', '—'], 0],
              ['Duona Palangos 400g', ['1.45', '1.39', '1.50', '1.25'], 3],
              ['Duona ruginė, sėklota 600g', ['1.89', '1.95', '2.10', '1.75'], 3],
              ['Duona balta, pjaustyta 500g', ['0.99', '1.05', '1.15', '0.95'], 3],
              ['Duona be glit. 400g', ['2.49', '—', '2.65', '—'], 0],
              ['Duona kvietinė, apk. 600g', ['1.49', '1.55', '1.65', '1.40'], 3],
            ].map(([n, prices, cheap], i) => (
              <React.Fragment key={i}>
                {i === 3 && (
                  <div style={{ borderBottom: `1px solid ${WF.hair}` }}><AdSponsoredRow style={{ border: 'none' }} /></div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1fr 1fr 90px', padding: '12px 14px', borderBottom: i < 5 ? `1px solid ${WF.hair}` : 'none', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Box w={28} h={28} r={2} bg={WF.chip} />
                    <div style={{ fontSize: 12 }}>{n}</div>
                  </div>
                  {prices.map((p, j) => (
                    <div key={j} style={{ textAlign: 'center', fontFamily: WF.mono, fontSize: 12, fontWeight: j === cheap ? 700 : 400, color: p === '—' ? WF.mute : WF.ink, position: 'relative' }}>
                      {p === '—' ? '—' : '€' + p}
                      {j === cheap && <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: -8, width: 20, height: 2, background: WF.ink }} />}
                    </div>
                  ))}
                  <div style={{ textAlign: 'right' }}>
                    <Btn small>+ add</Btn>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </Browser>
  );
}

Object.assign(window, {
  SearchA_Mobile, SearchA_Desktop, SearchB_Mobile, SearchB_Desktop,
  SearchC_Mobile, SearchC_Desktop, SearchD_Mobile, SearchD_Desktop,
});
