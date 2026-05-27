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

async function renderCardProfile(card) {
    const isMultiFaced = card.card_faces && !card.image_uris;
    const primaryFace = isMultiFaced ? card.card_faces[0] : card;

    profileName.innerText = card.name;
    profileTypes.innerText = card.type_line;
    cardImage.src = isMultiFaced ? primaryFace.image_uris.normal : card.image_uris.normal;

    tagCloud.innerHTML = '';
    debugOutput.innerText = `⏳ Fetching crowdsourced tags for "${card.name}"...`;
    debugOutput.style.color = "#aaa";

    try {
        const response = await fetch(
            `http://localhost:3001/api/tags?set=${card.set}&number=${encodeURIComponent(card.collector_number)}`
        );

        if (!response.ok) throw new Error('Tag fetch failed');

        const { tags } = await response.json();
        const gameplayTags = tags.filter(t => t.type === 'ORACLE_CARD_TAG');

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

        cardProfile.classList.remove('hidden');
        debugOutput.innerText = `✅ Loaded "${card.name}" with ${gameplayTags.length} crowdsourced tag(s)!`;
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