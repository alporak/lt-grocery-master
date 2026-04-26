const yearEl = document.getElementById("year");
const formMessage = document.getElementById("formMessage");
const signupForm = document.querySelector(".signup-form");
const productList = document.getElementById("productList");
const productSearch = document.getElementById("productSearch");
const clearSearch = document.getElementById("clearSearch");
const storeButtons = document.querySelectorAll(".store-tabs button");
const languageButtons = document.querySelectorAll(".language-switcher button");
const cityButtons = document.querySelectorAll(".city-switcher button");

const translations = {
  en: {
    navCompare: "Compare",
    navStores: "Stores",
    navAlerts: "Alerts",
    signIn: "Sign in",
    join: "Join",
    heroEyebrow: "Built for Lithuanian grocery shoppers",
    heroTitle: "Compare prices before the basket gets expensive.",
    heroLead:
      "Krepza tracks grocery prices across Lithuanian retailers and shows the cheapest route for everyday shopping.",
    viewDemo: "View demo",
    joinWaitlist: "Join waitlist",
    liveMonitor: "Live price monitor",
    searchProduct: "Search product",
    searchPlaceholder: "Milk, eggs, bananas...",
    clear: "Clear",
    allStores: "All",
    metricRetailers: "4 retailers",
    metricRetailersText: "Ready for scraper feeds",
    metricBasket: "Basket view",
    metricBasketText: "Compare total spend",
    metricHistory: "Price history",
    metricHistoryText: "Watch real savings",
    compareEyebrow: "Product-first comparison",
    compareTitle: "One clean view for the same item across stores.",
    compareText:
      "The public website can start as a polished landing page today, then grow into the live app once your data service is ready.",
    bestToday: "Best today",
    coverageEyebrow: "Lithuania coverage",
    coverageTitle: "Designed around local retailers.",
    dealAlerts: "Deal alerts",
    dealAlertsText:
      "Follow products and get notified when price drops are worth it.",
    basketTotals: "Basket totals",
    basketTotalsText:
      "Compare the total cost of a weekly basket before choosing a store.",
    trendSignals: "Trend signals",
    trendSignalsText: "See whether a price is stable, rising, or unusually low.",
    aboutEyebrow: "About us",
    aboutTitle: "Built to make Lithuanian grocery shopping clearer.",
    aboutText:
      "Krepza is a price comparison platform for everyday groceries in Lithuania. We are building a reliable view of store prices, basket totals, and useful deal signals for shoppers in Vilnius, Kaunas, and beyond.",
    privacyEyebrow: "Privacy Policy",
    privacyTitle: "Simple, privacy-first by design.",
    privacyText:
      "Krepza only asks for the information needed to provide product updates and account access. We do not sell personal data, and future analytics will be configured to respect user privacy.",
    signinEyebrow: "Account access",
    signinTitle: "Save baskets and follow products when accounts open.",
    createAccount: "Create account",
    requestInvite: "Request invite",
    signupEyebrow: "Domain-ready launch page",
    signupTitle: "Start collecting interest while the scraper runs behind it.",
    signupText:
      "Keep this site public now, then connect the product cards to live market data when the backend is online.",
    email: "Email",
    emailPlaceholder: "you@example.com",
    footerAbout:
      "Grocery price intelligence for Lithuania. Compare stores, watch price changes, and plan smarter baskets.",
    footerProduct: "Product",
    priceComparison: "Price comparison",
    earlyAccess: "Early access",
    footerCoverage: "Coverage",
    lithuanianRetailers: "Lithuanian retailers",
    cityCoverage: "Vilnius and Kaunas",
    basketTracking: "Basket tracking",
    footerCompany: "Company",
    aboutUs: "About us",
    privacyPolicy: "Privacy Policy",
    backToTop: "Back to top",
    rights: "All rights reserved.",
    privacyFirst: "Privacy-first price comparison",
    productMilk: "Milk 2.5%, 1L",
    productEggs: "Eggs, 10 pcs",
    productBananas: "Bananas, 1kg",
    productChicken: "Chicken breast, 1kg",
    noteBest: "Best today",
    noteDown: "Down 8%",
    noteStable: "Stable",
    noteMember: "Member deal",
    noProducts: "No products found",
    noProductsText: "Try another product or store.",
    formThanks: "Thanks. You are on the Krepza launch list.",
  },
  lt: {
    navCompare: "Palyginti",
    navStores: "Parduotuvės",
    navAlerts: "Pranešimai",
    signIn: "Prisijungti",
    join: "Registruotis",
    heroEyebrow: "Sukurta Lietuvos pirkėjams",
    heroTitle: "Palyginkite kainas prieš pirkinių krepšeliui pabrangstant.",
    heroLead:
      "Krepza seka maisto prekių kainas Lietuvos parduotuvėse ir padeda rasti pigiausią kasdienių pirkinių maršrutą.",
    viewDemo: "Peržiūrėti demo",
    joinWaitlist: "Prisijungti prie sąrašo",
    liveMonitor: "Gyvas kainų stebėjimas",
    searchProduct: "Ieškoti produkto",
    searchPlaceholder: "Pienas, kiaušiniai, bananai...",
    clear: "Valyti",
    allStores: "Visos",
    metricRetailers: "4 parduotuvės",
    metricRetailersText: "Paruošta duomenų srautams",
    metricBasket: "Krepšelio vaizdas",
    metricBasketText: "Palyginkite bendrą sumą",
    metricHistory: "Kainų istorija",
    metricHistoryText: "Stebėkite tikrą sutaupymą",
    compareEyebrow: "Produktų palyginimas",
    compareTitle: "Aiškus to paties produkto vaizdas skirtingose parduotuvėse.",
    compareText:
      "Viešas puslapis gali veikti jau dabar, o vėliau išaugti į gyvą programėlę, kai duomenų paslauga bus paruošta.",
    bestToday: "Geriausia šiandien",
    coverageEyebrow: "Lietuvos aprėptis",
    coverageTitle: "Sukurta vietinėms parduotuvėms.",
    dealAlerts: "Nuolaidų pranešimai",
    dealAlertsText:
      "Sekite produktus ir gaukite pranešimus, kai kainos kritimas tikrai vertas dėmesio.",
    basketTotals: "Krepšelio suma",
    basketTotalsText:
      "Palyginkite savaitinio krepšelio kainą prieš pasirinkdami parduotuvę.",
    trendSignals: "Kainų tendencijos",
    trendSignalsText:
      "Matykite, ar kaina stabili, kyla, ar yra neįprastai žema.",
    aboutEyebrow: "Apie mus",
    aboutTitle: "Kuriame aiškesnį maisto prekių apsipirkimą Lietuvoje.",
    aboutText:
      "Krepza yra kasdienių maisto prekių kainų palyginimo platforma Lietuvoje. Kuriame patikimą parduotuvių kainų, krepšelių sumų ir naudingų nuolaidų signalų vaizdą pirkėjams Vilniuje, Kaune ir kituose miestuose.",
    privacyEyebrow: "Privatumo politika",
    privacyTitle: "Paprasta ir privatumą gerbianti sistema.",
    privacyText:
      "Krepza prašo tik tos informacijos, kurios reikia produkto naujienoms ir paskyros prieigai. Mes neparduodame asmens duomenų, o būsima analitika bus konfigūruojama gerbiant naudotojų privatumą.",
    signinEyebrow: "Paskyros prieiga",
    signinTitle:
      "Išsaugokite krepšelius ir sekite produktus, kai paskyros bus atidarytos.",
    createAccount: "Sukurti paskyrą",
    requestInvite: "Prašyti pakvietimo",
    signupEyebrow: "Domenui paruoštas puslapis",
    signupTitle: "Pradėkite rinkti susidomėjimą, kol duomenys ruošiami.",
    signupText:
      "Puslapis gali būti viešas jau dabar, o produktų kortelės vėliau prisijungs prie gyvų rinkos duomenų.",
    email: "El. paštas",
    emailPlaceholder: "jusu@pastas.lt",
    footerAbout:
      "Maisto prekių kainų analizė Lietuvai. Palyginkite parduotuves, stebėkite kainų pokyčius ir planuokite išmanesnius krepšelius.",
    footerProduct: "Produktas",
    priceComparison: "Kainų palyginimas",
    earlyAccess: "Ankstyva prieiga",
    footerCoverage: "Aprėptis",
    lithuanianRetailers: "Lietuvos parduotuvės",
    cityCoverage: "Vilnius ir Kaunas",
    basketTracking: "Krepšelio sekimas",
    footerCompany: "Įmonė",
    aboutUs: "Apie mus",
    privacyPolicy: "Privatumo politika",
    backToTop: "Į viršų",
    rights: "Visos teisės saugomos.",
    privacyFirst: "Privatumą gerbiantis kainų palyginimas",
    productMilk: "Pienas 2,5 %, 1 l",
    productEggs: "Kiaušiniai, 10 vnt.",
    productBananas: "Bananai, 1 kg",
    productChicken: "Vištienos krūtinėlė, 1 kg",
    noteBest: "Geriausia šiandien",
    noteDown: "Sumažėjo 8 %",
    noteStable: "Stabili",
    noteMember: "Nario pasiūlymas",
    noProducts: "Produktų nerasta",
    noProductsText: "Pabandykite kitą produktą arba parduotuvę.",
    formThanks: "Ačiū. Esate Krepza paleidimo sąraše.",
  },
};

const products = [
  {
    name: "Milk 2.5%, 1L",
    nameKey: "productMilk",
    store: "Maxima",
    storeKey: "maxima",
    price: 1.19,
    note: "Best today",
    noteKey: "noteBest",
    icon: "./assets/Maxima_logo.png",
    iconAlt: "Maxima logo",
  },
  {
    name: "Eggs, 10 pcs",
    nameKey: "productEggs",
    store: "Lidl",
    storeKey: "lidl",
    price: 2.09,
    note: "Down 8%",
    noteKey: "noteDown",
    icon: "./assets/lidl_logo.png",
    iconAlt: "Lidl logo",
  },
  {
    name: "Bananas, 1kg",
    nameKey: "productBananas",
    store: "Rimi",
    storeKey: "rimi",
    price: 1.39,
    note: "Stable",
    noteKey: "noteStable",
    icon: "./assets/Rimi_Baltic_Logo.png",
    iconAlt: "Rimi logo",
  },
  {
    name: "Chicken breast, 1kg",
    nameKey: "productChicken",
    store: "Iki",
    storeKey: "iki",
    price: 5.49,
    note: "Member deal",
    noteKey: "noteMember",
    icon: "C",
    iconAlt: "",
  },
];

let selectedStore = "all";
let selectedLanguage = localStorage.getItem("krepza-language") || "en";

if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-LT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function t(key) {
  return translations[selectedLanguage][key] || translations.en[key] || key;
}

function applyLanguage(language) {
  selectedLanguage = translations[language] ? language : "en";
  localStorage.setItem("krepza-language", selectedLanguage);
  document.documentElement.lang = selectedLanguage === "lt" ? "lt" : "en";

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    element.textContent = t(key);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    element.setAttribute("placeholder", t(key));
  });

  languageButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === selectedLanguage);
  });

  renderProducts();
}

function renderProducts() {
  if (!productList) return;

  const query = productSearch?.value.trim().toLowerCase() || "";
  const visibleProducts = products.filter((product) => {
    const matchesStore =
      selectedStore === "all" || product.storeKey === selectedStore;
    const localizedName = t(product.nameKey).toLowerCase();
    const matchesSearch =
      localizedName.includes(query) ||
      product.name.toLowerCase().includes(query) ||
      product.store.toLowerCase().includes(query);
    return matchesStore && matchesSearch;
  });

  productList.innerHTML = visibleProducts.length
    ? visibleProducts
        .map(
          (product) => `
            <article class="product-row">
              <span class="product-icon">${
                product.icon.endsWith(".png")
                  ? `<img src="${product.icon}" alt="${product.iconAlt}" />`
                  : product.icon
              }</span>
              <div>
                <h3>${t(product.nameKey)}</h3>
                <p>${product.store}</p>
              </div>
              <div class="product-price">
                <strong>${formatPrice(product.price)}</strong>
                <span>${t(product.noteKey)}</span>
              </div>
            </article>
          `,
        )
        .join("")
    : `<article class="product-row"><div><h3>${t("noProducts")}</h3><p>${t("noProductsText")}</p></div></article>`;
}

storeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedStore = button.dataset.store || "all";
    storeButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderProducts();
  });
});

productSearch?.addEventListener("input", renderProducts);

languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyLanguage(button.dataset.lang);
  });
});

cityButtons.forEach((button) => {
  button.addEventListener("click", () => {
    cityButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  });
});

clearSearch?.addEventListener("click", () => {
  if (!productSearch) return;
  productSearch.value = "";
  productSearch.focus();
  renderProducts();
});

signupForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!formMessage) return;
  formMessage.textContent = t("formThanks");
  signupForm.reset();
});

applyLanguage(selectedLanguage);
