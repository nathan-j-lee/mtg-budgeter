// DOM Element References
const cardInput = document.getElementById('cardInput');
const searchBtn = document.getElementById('searchBtn');
const debugOutput = document.getElementById('debugOutput');
const autocompleteResults = document.getElementById('autocompleteResults');

let debounceTimer;

// 1. Listen for user typing inside the input box
cardInput.addEventListener('input', () => {
    // Clear any previous countdown timer instantly
    clearTimeout(debounceTimer);

    const query = cardInput.value.trim();

    // If they wiped out the text box, clear and hide the dropdown immediately
    if (query.length < 2) {
        closeAutocomplete();
        return;
    }

    // Start a fresh 300ms countdown before calling the API
    debounceTimer = setTimeout(() => {
        fetchAutocompleteSuggestions(query);
    }, 300); 
});

// 2. Fetch data safely from Scryfall
async function fetchAutocompleteSuggestions(query) {
    try {
        const response = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) return; // Fail silently if network drops

        const data = await response.json();
        renderAutocomplete(data.data); // Scryfall wraps the array inside a property named 'data'
    } catch (error) {
        console.error("Autocomplete fetch failed:", error);
    }
}

// 3. Render the suggestion rows into the HTML
function renderAutocomplete(suggestions) {
    autocompleteResults.innerHTML = ''; // Wipe out previous list

    if (!suggestions || suggestions.length === 0) {
        closeAutocomplete();
        return;
    }

    // Build an interactive row for each string returned by Scryfall
    suggestions.forEach(name => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'autocomplete-item';
        itemDiv.innerText = name;

        // When a user clicks a suggestion...
        itemDiv.addEventListener('click', () => {
            cardInput.value = name; // Put the exact card name in the input box
            closeAutocomplete();     // Close the dropdown
            handleSearchSubmit();    // Automatically trigger the search!
        });

        autocompleteResults.appendChild(itemDiv);
    });

    autocompleteResults.classList.remove('hidden');
}

// Helper to shut down the dropdown UI safely
function closeAutocomplete() {
    autocompleteResults.innerHTML = '';
    autocompleteResults.classList.add('hidden');
}

// Close the dropdown automatically if the user clicks completely outside of it
document.addEventListener('click', (e) => {
    if (e.target !== cardInput && e.target !== autocompleteResults) {
        closeAutocomplete();
    }
});

// Primary search submission handler
function handleSearchSubmit() {
    const currentInputValue = cardInput.value.trim();

    if (currentInputValue === "") {
        debugOutput.innerText = "⚠️ Please type a card name first!";
        debugOutput.style.color = "#ff5555";
        return;
    }

    const selectedColors = [];
    const allChecked = document.querySelectorAll('input[name="mtgColor"]:checked');
    allChecked.forEach(cb => selectedColors.push(cb.value));

    const colorDisplayString = selectedColors.length > 0 ? selectedColors.join(', ') : 'None selected (Any)';

    debugOutput.innerText = `✅ Data Ready for Phase 3 Search Integration!\n\n🔮 Target Card: "${currentInputValue}"\n🎨 Filter Deck Colors: [ ${colorDisplayString} ]`;
    debugOutput.style.color = "#8be9fd";
}

// Button and Enter-key triggers
searchBtn.addEventListener('click', handleSearchSubmit);
cardInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        closeAutocomplete(); // Hide dropdown if they forcibly hit Enter
        handleSearchSubmit();
    }
});