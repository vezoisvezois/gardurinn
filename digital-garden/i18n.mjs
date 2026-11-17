// Everything the site says in its own voice (menus, headings, dates, plurals), in Icelandic and English.
// Your own content lives in content/ and data/; this file is only the interface around it.

export const LANGS = ['is', 'en'];
export const DEFAULT_LANG = 'is';

// Page addresses. Icelandic is the default language, so it lives at the root; English lives under /en/.
export const ROUTES = {
  is: { home: '/', garden: '/gardurinn/', notes: '/glosur/', books: '/baekur/', photos: '/myndir/', travel: '/ferdalog/', cv: '/ferilskra/', about: '/um/' },
  en: { home: '/en/', garden: '/en/garden/', notes: '/en/notes/', books: '/en/books/', photos: '/en/photos/', travel: '/en/travel/', cv: '/en/cv/', about: '/en/about/' },
};

// Addresses used before the site was bilingual. Each one gets a small page that forwards to the new address.
export const OLD_ROUTES = { garden: '/garden/', notes: '/notes/', books: '/books/', photos: '/photos/', travel: '/travel/', cv: '/cv/', about: '/about/' };

// Icelandic count words: 1, 21, 31… take the singular, except 11.
const one = (n) => n % 10 === 1 && n % 100 !== 11;
const pl = (lang, n, sg, plural) => (lang === 'is' ? (one(n) ? sg : plural) : n === 1 ? sg : plural);

const MONTHS = {
  is: ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const MONTHS_SHORT = {
  is: ['jan.', 'feb.', 'mar.', 'apr.', 'maí', 'jún.', 'júl.', 'ágú.', 'sep.', 'okt.', 'nóv.', 'des.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

export function fmtDate(lang, s) {
  if (!s) return '';
  const [y, m, d] = String(s).split('-').map(Number);
  if (!m) return String(y);
  if (!d) return `${lang === 'is' ? MONTHS.is[m - 1] : MONTHS.en[m - 1]} ${y}`;
  return lang === 'is' ? `${d}. ${MONTHS.is[m - 1]} ${y}` : `${d} ${MONTHS.en[m - 1]} ${y}`;
}
export function fmtShort(lang, s) {
  if (!s) return '';
  const [y, m] = String(s).split('-').map(Number);
  return m ? `${MONTHS_SHORT[lang][m - 1]} ${y}` : String(y);
}

// "1 year, 2 months" / "1 ár, 2 mánuðir"
export function spanText(lang, days) {
  const y = Math.floor(days / 365.25), m = Math.floor((days - y * 365.25) / 30.44);
  const Y = (n) => `${n} ${pl(lang, n, lang === 'is' ? 'ár' : 'year', lang === 'is' ? 'ár' : 'years')}`;
  const M = (n) => `${n} ${pl(lang, n, lang === 'is' ? 'mánuður' : 'month', lang === 'is' ? 'mánuðir' : 'months')}`;
  if (y) return m ? `${Y(y)}, ${M(m)}` : Y(y);
  if (m) return M(m);
  const w = Math.round(days / 7);
  if (w) return `${w} ${pl(lang, w, lang === 'is' ? 'vika' : 'week', lang === 'is' ? 'vikur' : 'weeks')}`;
  return `${days} ${pl(lang, days, lang === 'is' ? 'dagur' : 'day', lang === 'is' ? 'dagar' : 'days')}`;
}

// Short country names where the built-in Icelandic ones are long or missing.
export const COUNTRY_NAMES = {
  is: { HK: 'Hong Kong', MO: 'Makaó', 'GB-ENG': 'England', 'GB-SCT': 'Skotland', 'GB-WLS': 'Wales', 'GB-NIR': 'Norður-Írland' },
  en: {},
};
export const REGIONS = {
  is: { Americas: 'Ameríka', 'North America': 'Norður-Ameríka', 'South America': 'Suður-Ameríka', Europe: 'Evrópa', Africa: 'Afríka', Asia: 'Asía', Oceania: 'Eyjaálfa', 'Middle East': 'Mið-Austurlönd', Elsewhere: 'Annars staðar' },
  en: {},
};

export const STRINGS = {
  is: {
    langName: 'Íslenska',
    skip: 'Fara í efni',
    nav: { garden: 'Garðurinn', books: 'Bækur', photos: 'Myndir', travel: 'Ferðalög', cv: 'Ferilskrá', about: 'Um mig' },
    switchTo: 'English',
    footerTended: (name) => `Umsjón: ${name}`,
    browseGarden: 'Skoða garðinn',
    onlyIn: { en: 'Aðeins til á ensku', is: 'Aðeins til á íslensku' },
    notFoundTitle: 'Ekkert að vaxa hér',
    notFoundBody: (garden) => `Þessi síða hefur ekki verið gróðursett. Prófaðu <a href="${garden}">garðinn</a>.`,
    kind: { section: 'Hluti', page: 'Síða', home: 'Forsíða' },

    stages: {
      seedling: { label: 'Fræ', blurb: 'Hrátt og nýtt. Hugmynd sem ég var rétt að sá.' },
      budding: { label: 'Í vexti', blurb: 'Að taka á sig mynd. Búið að snyrta, en enn að vaxa.' },
      evergreen: { label: 'Sígrænt', blurb: 'Nokkuð fullbúið. Ég hlúi samt að því öðru hverju.' },
    },
    types: { essay: 'Pistill', note: 'Glósa', pattern: 'Mynstur', project: 'Verkefni' },
    typesPlural: { essay: 'Pistlar', note: 'Glósur', pattern: 'Mynstur', project: 'Verkefni' },
    planted: 'Gróðursett',
    tended: 'Síðast uppfært',
    topics: 'Efni',
    linkingHere: 'Vísa hingað',
    notPlanted: 'Ekki gróðursett enn',
    sidenote: 'Spássíugrein',

    gardenTitle: 'Garðurinn',
    gardenIntro: 'Glósur, pistlar og hálfkláraðar hugsanir sem vaxa á mismunandi hraða. Hér er ekkert nokkurn tíma alveg búið.',
    filterNotes: 'Sía glósur',
    all: 'Allt',
    anyStage: 'Öll stig',
    allTopics: 'Öll efni',
    nothingHere: 'Ekkert að vaxa hér enn.',

    recentlyTended: 'Nýlega uppfært',
    wholeGarden: 'Allur garðurinn →',
    library: 'Bókasafn',
    lifeInPictures: 'Lífið í myndum',
    atlas: 'Kortabók',
    booksRead: (n) => `${n} lesnar`,
    currentlyReading: 'les núna',

    booksTitle: 'Bækur',
    booksIntro: 'Það sem ég er að lesa, það sem ég hef lesið og bunkinn sem bíður.',
    booksStat: (read, reading, toRead) => `<strong>${read}</strong> lesnar · <strong>${reading}</strong> á náttborðinu · <strong>${toRead}</strong> bíða lestrar`,
    readingNow: 'Les núna',
    undated: 'Án dagsetningar',
    antiLibrary: 'Bíða lestrar',
    antiLibraryBlurb: 'Bækur sem mig langar að lesa einhvern tíma.',
    coverOf: (t) => `Kápa: ${t}`,
    outOf5: (r) => `${r} af 5`,
    readMyNotes: 'Lesa glósurnar mínar →',
    finished: 'Kláruð',
    booksPreview: (read, reading) => `${read} bækur lesnar, ${reading} í lestri.`,

    photosTitle: 'Myndir',
    photosIntro: 'Augnablik úr lífi mínu, nokkurn veginn í tímaröð.',
    openPhoto: 'Opna mynd',
    photoViewer: 'Myndaskoðari',
    close: 'Loka',
    prevPhoto: 'Fyrri mynd',
    nextPhoto: 'Næsta mynd',
    noPhotos: 'Engar myndir enn.',
    photosPreview: (n) => `${n} myndir úr lífi mínu.`,

    travelTitle: 'Ferðalög',
    travelIntro: 'Hvar ég hef átt heima, hvar ég hef búið og hvert ég hef farið.',
    nights: (n) => pl('is', n, 'nótt', 'nætur'),
    countries: 'lönd',
    visited: 'Heimsótt',
    visitedStat: 'heimsótt',
    lived: 'Búið í',
    livedStat: 'búið í',
    home: 'Heima',
    nightsAbroad: 'nætur erlendis',
    airports: 'Flugvellir',
    airportsStat: 'flugvellir',
    flightsStat: 'flug',
    kmFlown: 'km flogið',
    roundEarth: (x) => `${x}× í kringum jörðina`,
    mapLabel: 'Heimskort yfir heimaland, lönd sem ég hef búið í og lönd sem ég hef heimsótt',
    loadingMap: 'Hleð korti…',
    airport: 'Flugvöllur',
    route: 'Flugleið',
    born: (d) => `f. ${d}`,
    yearsHere: (n) => `${n} ár hér`,
    inAll: (s) => `${s} samtals`,
    present: 'núna',
    fromThenOn: 'þaðan í frá',
    soFar: (s) => `${s} hingað til`,
    nightsByYear: 'Nætur erlendis eftir árum',
    mostNights: 'Hvar ég hef gist flestar nætur',
    longestStay: (n, where, from) => `Lengsta dvöl: ${n} ${pl('is', n, 'nótt', 'nætur')} í ${where}, frá ${from}.`,
    firstVisit: (n, d) => `${n} ${pl('is', n, 'nótt', 'nætur')} · fyrst ${d}`,
    trips: 'Ferðir',
    travelTile: (c, l, n, a) => [`${c} lönd`, l && `búið í ${l} ${pl('is', l, 'landi', 'löndum')}`, n && `${n} nætur erlendis`, a && `${a} flugvellir`].filter(Boolean).join(' · '),
    travelPreview: (c, v, l) => `${c} lönd: ${v} heimsótt, búið í ${l}.`,
    map: { home: 'heima', lived: 'bjó þar', nightsOne: 'nótt', nightsMany: 'nætur', flights: 'flug', failed: 'Ekki tókst að hlaða kortinu.' },

    cvTitle: 'Ferilskrá',
    cvSections: { education: 'Menntun', work: 'Störf', volunteer: 'Sjálfboðaliðastörf', projects: 'Verkefni' },
    cvSectionsNav: 'Hlutar ferilskrár',
    downloadPdf: 'Sækja PDF',
    filter: 'Sía',
    filterBy: 'Sía eftir merki',
    allEntries: 'Allt',
    showingOne: 'Sýni {n} færslu merkta „{tag}“.',
    showingMany: 'Sýni {n} færslur merktar „{tag}“.',
    ofTotal: (n, t) => `${n} af ${t}`,
    presentCv: 'núna',
  },

  en: {
    langName: 'English',
    skip: 'Skip to content',
    nav: { garden: 'Garden', books: 'Books', photos: 'Photos', travel: 'Travel', cv: 'CV', about: 'About' },
    switchTo: 'Íslenska',
    footerTended: (name) => `Tended by ${name}`,
    browseGarden: 'Browse the garden',
    onlyIn: { is: 'Only available in Icelandic', en: 'Only available in English' },
    notFoundTitle: 'Nothing growing here',
    notFoundBody: (garden) => `This page hasn’t been planted. Try <a href="${garden}">the garden</a>.`,
    kind: { section: 'Section', page: 'Page', home: 'Home' },

    stages: {
      seedling: { label: 'Seedling', blurb: 'Rough and early. An idea I’ve only just planted.' },
      budding: { label: 'Budding', blurb: 'Taking shape. Cleaned up, but still growing.' },
      evergreen: { label: 'Evergreen', blurb: 'Fairly complete. I’ll still tend it now and then.' },
    },
    types: { essay: 'Essay', note: 'Note', pattern: 'Pattern', project: 'Project' },
    typesPlural: { essay: 'Essays', note: 'Notes', pattern: 'Patterns', project: 'Projects' },
    planted: 'Planted',
    tended: 'Last tended',
    topics: 'Topics',
    linkingHere: 'Linking here',
    notPlanted: 'Not planted yet',
    sidenote: 'Sidenote',

    gardenTitle: 'The Garden',
    gardenIntro: 'Notes, essays and half-finished thoughts, growing at different speeds. Nothing here is ever really done.',
    filterNotes: 'Filter notes',
    all: 'All',
    anyStage: 'Any stage',
    allTopics: 'All topics',
    nothingHere: 'Nothing growing here yet.',

    recentlyTended: 'Recently tended',
    wholeGarden: 'The whole garden →',
    library: 'Library',
    lifeInPictures: 'Life in pictures',
    atlas: 'Atlas',
    booksRead: (n) => `${n} read`,
    currentlyReading: 'currently reading',

    booksTitle: 'Books',
    booksIntro: 'What I’m reading, what I’ve read, and the growing pile waiting for me.',
    booksStat: (read, reading, toRead) => `<strong>${read}</strong> read · <strong>${reading}</strong> on the nightstand · <strong>${toRead}</strong> in the anti-library`,
    readingNow: 'Currently reading',
    undated: 'Undated',
    antiLibrary: 'Anti-library',
    antiLibraryBlurb: 'Books I want to read, someday.',
    coverOf: (t) => `Cover of ${t}`,
    outOf5: (r) => `${r} out of 5`,
    readMyNotes: 'Read my notes →',
    finished: 'Finished',
    booksPreview: (read, reading) => `${read} books read, ${reading} in progress.`,

    photosTitle: 'Photos',
    photosIntro: 'Moments from my life, roughly in order.',
    openPhoto: 'Open photo',
    photoViewer: 'Photo viewer',
    close: 'Close',
    prevPhoto: 'Previous photo',
    nextPhoto: 'Next photo',
    noPhotos: 'No photos yet.',
    photosPreview: (n) => `${n} photographs from my life.`,

    travelTitle: 'Travel',
    travelIntro: 'The places I’ve called home, the places I’ve lived, and everywhere I’ve visited along the way.',
    nights: (n) => pl('en', n, 'night', 'nights'),
    countries: 'countries',
    visited: 'Visited',
    visitedStat: 'visited',
    lived: 'Lived',
    livedStat: 'lived in',
    home: 'Home',
    nightsAbroad: 'nights abroad',
    airports: 'Airports',
    airportsStat: 'airports',
    flightsStat: 'flights',
    kmFlown: 'km flown',
    roundEarth: (x) => `${x}× round the Earth`,
    mapLabel: 'World map of home, countries lived in and countries visited',
    loadingMap: 'Loading map…',
    airport: 'Airport',
    route: 'Flight route',
    born: (d) => `Born ${d}`,
    yearsHere: (n) => `${n} years here`,
    inAll: (s) => `${s} in all`,
    present: 'present',
    fromThenOn: 'from then on',
    soFar: (s) => `${s} so far`,
    nightsByYear: 'Nights abroad, by year',
    mostNights: 'Where I’ve spent the most nights',
    longestStay: (n, where, from) => `Longest single stay: ${n} ${pl('en', n, 'night', 'nights')} in ${where}, from ${from}.`,
    firstVisit: (n, d) => `${n} ${pl('en', n, 'night', 'nights')} · first ${d}`,
    trips: 'Trips',
    travelTile: (c, l, n, a) => [`${c} countries`, l && `lived in ${l}`, n && `${n} nights abroad`, a && `${a} airports`].filter(Boolean).join(' · '),
    travelPreview: (c, v, l) => `${c} countries: ${v} visited, ${l} lived in.`,
    map: { home: 'home', lived: 'lived', nightsOne: 'night', nightsMany: 'nights', flights: 'flights', failed: 'The map couldn’t load right now.' },

    cvTitle: 'CV',
    cvSections: { education: 'Education', work: 'Work', volunteer: 'Volunteer work', projects: 'Projects' },
    cvSectionsNav: 'CV sections',
    downloadPdf: 'Download PDF',
    filter: 'Filter',
    filterBy: 'Filter by tag',
    allEntries: 'All',
    showingOne: 'Showing {n} entry tagged “{tag}”.',
    showingMany: 'Showing {n} entries tagged “{tag}”.',
    ofTotal: (n, t) => `${n} of ${t}`,
    presentCv: 'present',
  },
};
