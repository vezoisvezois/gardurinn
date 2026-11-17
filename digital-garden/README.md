# 🌱 Digital garden

A personal digital garden with notes, books, photos and travel. It was inspired by Maggie Appleton's garden, and it's built with one small Node script and hosted free on GitHub Pages.

**Features**

- **Notes and essays** with growth stages (🌱 seedling → 🌿 budding → 🌲 evergreen), topics, filters and backlinks ("Linking here").
- **Sidenotes.** Ordinary Markdown footnotes appear in the margin on wide screens. On phones you tap the number to open them.
- **Hover previews.** Hover over any internal link to see a card with the page's title, stage and summary. External links show where they go.
- **"6ya" badges.** `{{2019}}` renders as *2019⁶ʸᵃ*. The badge is worked out when the page loads, so it never goes stale.
- **Books.** Shows what you're currently reading, what you've read by year and an anti-library. Covers come from Open Library using the ISBN, with a generated cover if none is found.
- **Photos.** Shown in a masonry grid grouped by year, with a lightbox (arrow keys work). Photos are resized and converted to WebP automatically.
- **Travel.** Shows stats, a world map of countries, airports and great-circle flight routes, a chart of nights abroad by year, nights by country, and lists of trips, countries and airports.

---

## 1. Put it on GitHub

1. Create a new repository on GitHub, for example `garden`.
2. Upload the contents of this folder. Either drag the files into the GitHub web page, or run:
   ```bash
   cd digital-garden
   git init && git add . && git commit -m "Plant the garden"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/garden.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
4. Open the **Actions** tab and watch the "Build and deploy" run. When it finishes, your site is live at `https://YOUR-USERNAME.github.io/garden/`.

> Note: until you add your own domain, the site lives in a `/garden/` sub-folder, and links that start with `/` will break there. Step 2 fixes that. You can also name the repo `YOUR-USERNAME.github.io` to serve the site from the root.

## 2. Connect your domain

1. In **Settings → Pages → Custom domain**, enter your domain (for example `yourname.com`) and save.
2. At your domain registrar, add DNS records:
   - For the bare domain (`yourname.com`): four **A** records pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`.
   - For `www`: a **CNAME** record pointing to `YOUR-USERNAME.github.io`.
3. Wait for DNS to update (a few minutes to a few hours), then tick **Enforce HTTPS**.

GitHub's guide covers this in more detail: <https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site>

## 3. Make it yours

Start with `site.config.json`, which holds your name, intro text, home country and footer. After that, every push to `main` rebuilds the site automatically.

### Preview on your own computer (optional)

You need [Node.js](https://nodejs.org) 20 or newer. Then run:

```bash
npm install
npm run dev     # → http://localhost:4321, rebuilds when you save
```

---

## Writing notes

Each note is a Markdown file in `content/notes/`. The file name becomes the URL, so `my-idea.md` is served at `/notes/my-idea/`.

```markdown
---
title: My idea
description: One-line summary, shown on cards and hover previews.
type: note            # note | essay | pattern | project
stage: seedling       # seedling | budding | evergreen
planted: 2026-11-17
tended: 2026-11-17
topics: [Travel, Photography]
draft: false          # true hides the note
---

Text with a sidenote.[^1] Link to another note with [[Note title]] or
[[file-name|custom link text]]. A date with an age badge: {{2019}} or {{2019-06-14}}.

[^1]: The sidenote text. It can include *formatting*, [links](/books/) and {{2020}}.
```

- **Sidenotes:** write `[^anything]` in the text and `[^anything]: text` on its own line anywhere in the note.
- **Wiki links:** `[[...]]` matches a note's title or file name. A link to a note that doesn't exist yet shows as a faded "not planted yet" link.
- **Images:** put them in `static/images/` and write `![alt text](/images/photo.jpg)`.
- **Pages:** files in `content/pages/` (like `about.md`) become top-level pages.

The note **A note on sidenotes and dates** shows every feature working, so it's handy to copy when you start a new note.

## Books — `data/books.json`

```jsonc
{ "title": "…", "author": "…", "isbn": "9781234567890",
  "status": "read",            // read | reading | to-read
  "finished": "2026-08",       // groups books by year
  "rating": 4,                 // 1–5, optional
  "thoughts": "A sentence or two (Markdown works).",
  "note": "my-notes-file-name",// optional link to a full note
  "cover": "/images/cover.jpg" // optional; overrides the Open Library cover
}
```

## Photos — `content/photos/` and `data/photos.json`

Drop the photos into `content/photos/`, then list each one:

```jsonc
{ "file": "2026-reykjavik-harbour.jpg", "caption": "Harbour at dawn", "place": "Reykjavík", "date": "2026-02-14", "alt": "Fishing boats in a harbour at sunrise" }
```

Large originals are fine, because the build resizes them. Keep each file under about 50 MB so GitHub accepts it. If you have hundreds of photos, ask about moving them to an image host.

## CV — `data/cv.json`

The CV page has four sections: `education`, `work`, `volunteer` and `projects`. Each entry looks like this:

```jsonc
{
  "title": "Job title",
  "org": "Company name",            // optional
  "place": "Reykjavík, Iceland",    // optional
  "from": "2023-08",                // year-month, or just a year
  "to": "2024-06",                  // leave out if it's ongoing ("present")
  "summary": "A sentence or two. *Markdown* works.",
  "highlights": ["Bullet point", "Another one"],  // optional
  "link": "https://…",             // optional, links the title
  "tags": ["Skill", "Tool"]         // optional
}
```

Entries are sorted newest first, with ongoing ones at the top. A section with no entries is hidden. To offer a downloadable version, put the file in `static/` (e.g. `static/cv.pdf`) and set `"pdf": "/cv.pdf"`. The page also prints cleanly.

## Travel — `data/travel.json` and `data/airports.json`

Countries are sorted into three groups: **home**, **lived** and **visited**.

```jsonc
"home": "Iceland", "homeCode": "IS", "born": "2000-05-04",
"lived": [ { "country": "Denmark", "code": "DK", "from": "2018-01-11", "to": "2018-06-27" } ],
"visited": [ { "country": "France", "code": "FR", "region": "Europe" } ]
```

- Time at home is worked out automatically: every date from `born` onwards that isn't inside a `lived` period.
- A country you've lived in is shown under Lived, even if it's also in `visited`.
- Visited countries are grouped by `region`. England, Scotland and Wales use the codes `GB-ENG`, `GB-SCT` and `GB-WLS` for their flags.
- Places too small for the world map (Singapore, Hong Kong, Liechtenstein…) appear as dots.

Each **stay** is one visit to one country. Nights are counted from `arrive` to `depart`.

```jsonc
{ "trip": "Europe 2022", "country": "Iceland", "code": "IS", "place": "Reykjavík, Akureyri", "arrive": "2022-06-16", "depart": "2022-07-04" }
```

- `code` is the two-letter country code, used for the flag.
- `trip` groups several stays into one trip.
- Stays in your `home` country are ignored.

**Flights** are listed as `"AKL-SIN"`. Each airport code also needs an entry in `data/airports.json` with its coordinates (you can look them up on Wikipedia):

```jsonc
"AKL": { "name": "Auckland Airport", "city": "Auckland", "lat": -37.0082, "lon": 174.7850 }
```

If you forget an airport, the build prints a warning telling you which one is missing.

**Map names.** Countries are matched to the map by name. Common differences such as "United States", "Czech Republic" and "Ivory Coast" are already handled. If a country still doesn't light up, open the browser console (it lists the names it couldn't match) and add the map's own name to `"mapNames"`, for example `"mapNames": { "Bosnia": "Bosnia and Herz." }`.

---

## How it's built

| File | What it does |
|---|---|
| `build.mjs` | Reads `content/` and `data/`, then writes the finished site to `dist/` |
| `static/assets/styles.css` | All the styling: colours, fonts and layout. The design tokens are at the top. |
| `static/assets/garden.js` | Adds the age badges, hover previews, filters and lightbox |
| `static/assets/travel-map.js` | Draws the world map with no external libraries |
| `.github/workflows/deploy.yml` | Builds and publishes the site on every push |

Ideas for later: an RSS feed, a dark mode, a "Now" page, and a graph view of links between notes.
