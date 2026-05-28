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

// Pagination state
let alternativesBuffer = [];
let alternativesPage = 0;
let nextScryfallUrl = null;
let currentCard = null;
const PAGE_SIZE = 25;

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

// Scryfall has its own autocomplete API, pretty cool
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

// Handle search and autocomplete close when name is clicked on
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

// Helper function to close autocomplete form
function closeAutocomplete() {
    autocompleteResults.innerHTML = '';
    autocompleteResults.classList.add('hidden');
}

// Handle mismatch of search bar and autocomplete/no results found
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
    const tagPart = tags.map(t => `otag:${t.slug}`).join(' or ');
    const wrappedTags = `(${tagPart})`;

    let colorPart;
    if (colors.length === 0) {
        colorPart = '';
    } else {
        colorPart = `color<=${colors.join('')}`;
    }

    const query = [wrappedTags, colorPart].filter(Boolean).join(' ');
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

// Namespaces entries to prevent collision with localStorage
const CACHE_PREFIX = 'mtg_tags:';

async function fetchTags(card) {
    const cacheKey = `${CACHE_PREFIX}${card.set}:${card.collector_number}`;

    // Check localStorage first for cache HIT
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        console.log(`Cache hit for ${cacheKey} — skipping Tagger fetch`);
        return JSON.parse(cached);
    }

    // Cache MISS — fetch from Express server
    console.log(`Cache miss for ${cacheKey} — fetching from Tagger`);
    const response = await fetch(
        `http://localhost:3001/api/tags?set=${card.set}&number=${encodeURIComponent(card.collector_number)}`
    );

    if (!response.ok) throw new Error('Tag fetch failed');

    const { tags } = await response.json();
    const gameplayTags = tags.filter(t => t.type === 'ORACLE_CARD_TAG');

    // Write to localStorage
    localStorage.setItem(cacheKey, JSON.stringify(gameplayTags));
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
        //console.log('Ready to search Scryfall with:', scryfallQuery);
        await fetchAlternatives(card, scryfallQuery);

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

// Grey out Colorless when any other color is selected
const colorCheckboxes = document.querySelectorAll('input[name="mtgColor"]');
const colorlessCheckbox = document.getElementById('color-C');

colorCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
        const anyColorChecked = [...colorCheckboxes]
            .filter(c => c.value !== 'C')
            .some(c => c.checked);

        if (anyColorChecked) {
            colorlessCheckbox.checked = false;
            colorlessCheckbox.closest('label').style.opacity = '0.3';
            colorlessCheckbox.closest('label').style.pointerEvents = 'none';
        } else {
            colorlessCheckbox.closest('label').style.opacity = '1';
            colorlessCheckbox.closest('label').style.pointerEvents = 'auto';
        }
    });
});


async function fetchAlternatives(card, query) {
    // Reset pagination state on every new card search
    alternativesBuffer = [];
    alternativesPage = 0;
    nextScryfallUrl = null;
    currentCard = card;

    debugOutput.innerText = `🔎 Searching for alternatives...`;
    debugOutput.style.color = "#aaa";

    try {
        const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards`;
        const response = await fetch(url);

        if (response.status === 404) {
            renderAlternatives([]);
            debugOutput.innerText = `⚠️ No alternatives found for "${card.name}".`;
            debugOutput.style.color = "#ffb86c";
            return;
        }

        if (!response.ok) throw new Error(`Scryfall search failed: ${response.status}`);

        const data = await response.json();

        // Filter out the searched card and store in buffer
        alternativesBuffer = data.data.filter(c => c.id !== card.id);
        nextScryfallUrl = data.has_more ? data.next_page : null;

        showAlternativesPage();

        debugOutput.innerText = `✅ Showing alternatives for "${card.name}"!`;
        debugOutput.style.color = "#8be9fd";

    } catch (err) {
        console.error('Alternative fetch failed:', err);
        debugOutput.innerText = `❌ Could not fetch alternatives. ${err.message}`;
        debugOutput.style.color = "#ff5555";
    }
}

async function showAlternativesPage() {
    const start = alternativesPage * PAGE_SIZE;
    const end = start + PAGE_SIZE;

    // If we're running low on buffered results and there's a next Scryfall page, fetch it
    if (end >= alternativesBuffer.length && nextScryfallUrl) {
        const response = await fetch(nextScryfallUrl);
        if (response.ok) {
            const data = await response.json();
            const filtered = data.data.filter(c => c.id !== currentCard.id);
            alternativesBuffer = alternativesBuffer.concat(filtered);
            nextScryfallUrl = data.has_more ? data.next_page : null;
        }
    }

    const pageCards = alternativesBuffer.slice(start, end);
    const hasMore = end < alternativesBuffer.length || nextScryfallUrl !== null;

    renderAlternatives(pageCards, hasMore);
    alternativesPage++;
}

function renderAlternatives(cards, hasMore = false) {
    let resultsContainer = document.getElementById('alternativesContainer');
    if (!resultsContainer) {
        resultsContainer = document.createElement('div');
        resultsContainer.id = 'alternativesContainer';
        resultsContainer.className = 'alternatives-container';
        document.body.appendChild(resultsContainer);
    }
    resultsContainer.innerHTML = '';

    if (cards.length === 0) {
        resultsContainer.innerHTML = '<p class="no-results">No alternatives found. Try adjusting the color filters.</p>';
        updatePaginationControls(false);
        return;
    }

    cards.forEach(card => {
        const isMultiFaced = card.card_faces && !card.image_uris;
        const imageUrl = isMultiFaced
            ? card.card_faces[0].image_uris?.normal
            : card.image_uris?.normal;

        if (!imageUrl) return;

        const cardEl = document.createElement('div');
        cardEl.className = 'alternative-card';
        cardEl.innerHTML = `<img src="${imageUrl}" alt="${card.name}" title="${card.name}">`;
        resultsContainer.appendChild(cardEl);
    });

    updatePaginationControls(hasMore);
}

function updatePaginationControls(hasMore) {
    const hasPrev = alternativesPage > 1;

    // Helper to build a set of pagination buttons
    function buildControls(id) {
        let controls = document.getElementById(id);
        if (!controls) {
            controls = document.createElement('div');
            controls.id = id;
            controls.className = 'pagination-controls';

            // Top controls go before the alternatives container
            if (id === 'paginationControlsTop') {
                const container = document.getElementById('alternativesContainer');
                document.body.insertBefore(controls, container);
            } else {
                document.body.appendChild(controls);
            }
        }
        controls.innerHTML = '';

        if (hasPrev) {
            const prevBtn = document.createElement('button');
            prevBtn.innerText = '← Previous';
            prevBtn.addEventListener('click', () => {
                alternativesPage -= 2;
                showAlternativesPage();
                window.scrollTo({ top: document.getElementById('alternativesContainer').offsetTop - 20, behavior: 'smooth' });
            });
            controls.appendChild(prevBtn);
        }

        if (hasMore) {
            const nextBtn = document.createElement('button');
            nextBtn.innerText = 'Next →';
            nextBtn.addEventListener('click', () => {
                showAlternativesPage();
                window.scrollTo({ top: document.getElementById('alternativesContainer').offsetTop - 20, behavior: 'smooth' });
            });
            controls.appendChild(nextBtn);
        }

        controls.style.display = (hasPrev || hasMore) ? 'flex' : 'none';
    }

    buildControls('paginationControlsTop');
    buildControls('paginationControls');
}

// Event Listeners
searchBtn.addEventListener('click', handleSearchSubmit);
cardInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        closeAutocomplete();
        handleSearchSubmit();
    }
});

// Focus and select all text in the search bar when / is pressed
document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== cardInput) {
        e.preventDefault(); // stop / from being typed into the input
        cardInput.focus();
        cardInput.select();
    }
});

// Select all text when clicking into the search bar
cardInput.addEventListener('click', () => {
    cardInput.select();
});