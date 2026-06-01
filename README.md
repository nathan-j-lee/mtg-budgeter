# 🔮 MTG Alternative Finder — Documentation & Roadmap

This project is a browser-based utility designed to recommend alternative Magic: The Gathering cards for any given selection. It allows players to find budget-friendly replacements, functional backups, or format-legal alternatives by extracting a card's baseline attributes and mapping them against Scryfall's robust database engine.

---

## 🗺️ Core Application Flow & Roadmap

### 📍 Phase 1: The Baseline Sandbox *(Complete)*

* **Objective:** Establish steady communication with the Scryfall API and prove the data parsing concept.

* **Execution:** Create a lightweight interface that requests a single card by name, implements network sanitization, handles layout deviations safely, and extracts primary gameplay markers to use as recommendation tags.

---

### 🔍 Phase 2: Autocomplete Search Input *(Complete)*

* **Objective:** Enhance user experience by eliminating typing guesswork and preventing manual syntax errors.

* **Execution:** Connect the main search bar to a throttled input listener. As the user types, the program queries Scryfall's catalog endpoints to return a dynamic, selectable drop-down menu of similarly named cards.

* **2.1 — Keyboard Navigation *(Complete)*:**
  * `ArrowDown` / `ArrowUp` move the highlight through the suggestion list, mirroring the highlighted name into the input field as you navigate — identical to Google's search behavior.
  * `Enter` confirms the currently highlighted suggestion, or falls back to the first item if none are highlighted.
  * `Escape` dismisses the dropdown without submitting.
  * `scrollIntoView` keeps the active item visible when the list overflows.
  * The active index resets to `-1` any time the dropdown closes or new suggestions are fetched, preventing stale state.

  ---

### 🏷️ Phase 3: Crowdsourced Tag Extraction via Express Backend *(Complete)*

* **Objective:** Replace locally-inferred gameplay tags with real, community-sourced tags pulled directly from Scryfall Tagger.

* **Why a backend is required:** Scryfall Tagger exposes an internal GraphQL API at `tagger.scryfall.com/graphql` that requires a valid session cookie and CSRF token on every request. These cannot be obtained safely from the browser due to CORS restrictions — a server-side proxy is the only viable approach.

* **Execution:**
  * A lightweight **Express.js** server acts as a secure middleware layer between the frontend and Tagger.
  * On each card lookup, the server performs a **two-step session handshake**:
    1. Fetches the card's Tagger page (`tagger.scryfall.com/card/{set}/{number}`) to obtain a `_scryfall_tagger_session` cookie and extract the `csrf-token` meta tag from the returned HTML.
    2. Uses both credentials to POST an authenticated GraphQL query to the Tagger endpoint, requesting the full `taggings` list for that card.
  * The Scryfall card object (returned in Phase 1) supplies the `set` and `collector_number` fields needed to construct the Tagger URL — no additional lookup is required.
  * The server filters the raw tag response to **`ORACLE_CARD_TAG`** type only, stripping illustration and printing tags that carry no gameplay relevance.
  * If the Tagger backend is unreachable or returns an error, the frontend gracefully falls back to a locally-inferred tag set derived from the card's oracle text and type line.

* **Tag Types Reference:**

  | Type | Description | Used |
  |---|---|---|
  | `ORACLE_CARD_TAG` | Crowdsourced gameplay function tags (ramp, removal, fast mana, etc.) | ✅ Yes |
  | `ILLUSTRATION_TAG` | Art subject tags (green background, dragon, etc.) | ❌ No |
  | `PRINTING_TAG` | Print and edition-specific tags | ❌ No |

---

### 🎨 Phase 4: Color Filtration & Query Generation

* **Objective:** Give the user precise control over where the recommendation engine looks.

* **Execution:**
  * Provide a UI element (such as checkboxes) to select target mana colors.
  * Build a backend-free search parameter compiler. This engine automatically takes the extracted crowdsourced `ORACLE_CARD_TAG` slugs and cross-references them with the user's selected color boundaries.
  * Format these combined variables into a complex, native Scryfall search string using `otag:` operators (e.g. `otag:ramp otag:fast-mana c:g`).

---

### 📊 Phase 5: Output Display & Advanced Sorting

* **Objective:** Present recommendation results cleanly and allow users to slice data dynamically.

* **Execution:** Print the matching alternatives to the screen and provide instant frontend sorting tools. Users will be able to organize the recommended cards on the fly by:

  * **Mana Value (CMC):** To find cheaper or equivalent curve replacements.
  * **Tag Intersections:** Activating or deactivating specific gameplay tags to narrow down functional similarity.
  * **Financial Cost:** To easily prioritize budget-friendly variations.

---

## 🚀 Deployment Plan

The app is split into two independently deployed pieces — a static frontend and a Node.js backend — each hosted on a platform suited to its needs.

### Frontend → GitHub Pages

* The static files (`index.html`, `style.css`, `app.js`) will be served directly from the project's GitHub repository using **GitHub Pages**.
* No build step is required — GitHub Pages serves the files as-is.
* Free forever with no usage limits or cold-start penalties.
* **Setup:** Enable GitHub Pages in the repository settings, point it at the `main` branch root or a `/docs` folder.

### Backend → Railway

* The Express server (`server.js`) will be deployed as a standalone Node.js service on **Railway**.
* Railway was chosen over alternatives like Render because it has **no spin-down on inactive servers** — the server stays live at all times, so the first request after a period of inactivity is never slow.
* Railway provides **$5 of free credit per month**, which is sufficient to run a small Express server continuously.
* **Setup:** Connect the GitHub repository to Railway, set the start command to `node server.js`, and Railway handles the rest automatically on every push.

### Required Code Change on Deployment

Once the Railway backend is live, update the hardcoded local URL in `app.js`:

```js
// BEFORE (local development)
const response = await fetch('http://localhost:3001/api/tags?set=...')

// AFTER (production)
const response = await fetch('https://your-app.railway.app/api/tags?set=...')
```

Also lock down the CORS origin in `server.js` to your actual GitHub Pages domain:

```js
app.use(cors({
  origin: 'https://your-username.github.io'
}));
```