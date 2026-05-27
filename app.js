// DOM Element References
const cardInput = document.getElementById('cardInput');
const searchBtn = document.getElementById('searchBtn');
const debugOutput = document.getElementById('debugOutput');
const autocompleteResults = document.getElementById('autocompleteResults');

// Card Profile Elements
const cardProfile = document.getElementById('cardProfile');
const cardImage = document.getElementById('cardImage');
const profileName = document.getElementById('profileName');
const profileTypes = document.getElementById('profileTypes');
const tagCloud = document.getElementById('tagCloud');

let debounceTimer;

// Saved state for the current card's gameplay tags
let currentCardTags = [];

// Local in-memory cache — keyed by "set:collector_number"
// Stores { card, tags } so both the card data and its otags are reused on repeat lookups
const cardCache = {};

// Autocomplete Setup
cardInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = cardInput.value.trim();
    if (query.length < 2) {
        closeAutocomplete();
        return;
    }
    debounceTimer = setTimeout(() => {
        fetchAutocompleteSuggestions(query);
    }, 300);
});

async function fetchAutocompleteSuggestions(query) {
    try {
        const response = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`);
        if (!response.ok) return;
        const data = await response.json();
        renderAutocomplete(data.data);
    } catch (error) {
        console.error("Autocomplete fetch failed:", error);
    }
}

function renderAutocomplete(suggestions) {
    autocompleteResults.innerHTML = '';
    if (!suggestions || suggestions.length === 0) {
        closeAutocomplete();
        return;
    }
    suggestions.forEach(name => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'autocomplete-item';
        itemDiv.innerText = name;
        itemDiv.addEventListener('click', () => {
            cardInput.value = name;
            closeAutocomplete();
            handleSearchSubmit();
        });
        autocompleteResults.appendChild(itemDiv);
    });
    autocompleteResults.classList.remove('hidden');
}

function closeAutocomplete() {
    autocompleteResults.innerHTML = '';
    autocompleteResults.classList.add('hidden');
}

document.addEventListener('click', (e) => {
    if (e.target !== cardInput && e.target !== autocompleteResults) {
        closeAutocomplete();
    }
});

// Returns the selected mana colors from the checkboxes
function getSelectedColors() {
    return [...document.querySelectorAll('input[name="mtgColor"]:checked')].map(el => el.value);
}

// Builds the Scryfall search string from saved otags and selected colors
function buildScryfallQuery(tags, colors) {
    const tagPart = tags.map(t => `otag:${t.slug}`).join(' ');

    let colorPart;
    if (colors.length === 0) {
        colorPart = '';
    } else {
        colorPart = `color<=${colors.join('')}`;
    }

    const query = [tagPart, colorPart].filter(Boolean).join(' ');
    console.log('Scryfall query:', query);
    return query;
}

async function handleSearchSubmit() {
    const currentInputValue = cardInput.value.trim();

    if (currentInputValue === "") {
        debugOutput.innerText = "⚠️ Please type a card name first!";
        debugOutput.style.color = "#ff5555";
        return;
    }

    debugOutput.innerText = `🔍 Looking up "${currentInputValue}"...`;
    debugOutput.style.color = "#aaa";

    try {
        const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(currentInputValue)}`);

        if (!response.ok) {
            throw new Error("Card not found. Check the name and try again.");
        }

        const cardData = await response.json();
        await renderCardProfile(cardData);

    } catch (error) {
        debugOutput.innerText = `❌ Error: ${error.message}`;
        debugOutput.style.color = "#ff5555";
        cardProfile.classList.add('hidden');
    }
}

async function fetchTags(card) {
    const cacheKey = `${card.set}:${card.collector_number}`;

    // Cache hit — return saved tags immediately, no network call
    if (cardCache[cacheKey]) {
        console.log(`Cache hit for ${cacheKey} — skipping Tagger fetch`);
        return cardCache[cacheKey].tags;
    }

    // Cache miss — fetch from Express server
    console.log(`Cache miss for ${cacheKey} — fetching from Tagger`);
    const response = await fetch(
        `http://localhost:3001/api/tags?set=${card.set}&number=${encodeURIComponent(card.collector_number)}`
    );

    if (!response.ok) throw new Error('Tag fetch failed');

    const { tags } = await response.json();
    const gameplayTags = tags.filter(t => t.type === 'ORACLE_CARD_TAG');

    // Write to cache
    cardCache[cacheKey] = { card, tags: gameplayTags };
    console.log(`Cached ${gameplayTags.length} tags for ${cacheKey}`);

    return gameplayTags;
}

async function renderCardProfile(card) {
    const isMultiFaced = card.card_faces && !card.image_uris;
    const primaryFace = isMultiFaced ? card.card_faces[0] : card;

    profileName.innerText = card.name;
    profileTypes.innerText = card.type_line;
    cardImage.src = isMultiFaced ? primaryFace.image_uris.normal : card.image_uris.normal;

    tagCloud.innerHTML = '';
    currentCardTags = [];
    debugOutput.innerText = `⏳ Fetching crowdsourced tags for "${card.name}"...`;
    debugOutput.style.color = "#aaa";

    try {
        const gameplayTags = await fetchTags(card);

        currentCardTags = gameplayTags;

        if (gameplayTags.length === 0) {
            const empty = document.createElement('span');
            empty.className = 'extracted-tag';
            empty.style.color = '#aaa';
            empty.innerText = 'no tags found';
            tagCloud.appendChild(empty);
        } else {
            gameplayTags.forEach(tag => {
                const pill = document.createElement('span');
                pill.className = 'extracted-tag';
                pill.innerText = tag.name;
                tagCloud.appendChild(pill);
            });
        }

        const selectedColors = getSelectedColors();
        const scryfallQuery = buildScryfallQuery(currentCardTags, selectedColors);
        console.log('Ready to search Scryfall with:', scryfallQuery);

        cardProfile.classList.remove('hidden');

        const cacheKey = `${card.set}:${card.collector_number}`;
        const fromCache = !!cardCache[cacheKey];
        debugOutput.innerText = `✅ Loaded "${card.name}" with ${gameplayTags.length} crowdsourced tag(s)!${fromCache ? ' (from cache)' : ''}`;
        debugOutput.style.color = "#8be9fd";

    } catch (err) {
        console.error('Tag fetch failed:', err);
        cardProfile.classList.remove('hidden');
        debugOutput.innerText = `❌ Could not load tags for "${card.name}". Is the server running?`;
        debugOutput.style.color = "#ff5555";
    }
}

// Event Listeners
searchBtn.addEventListener('click', handleSearchSubmit);
cardInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        closeAutocomplete();
        handleSearchSubmit();
    }
});