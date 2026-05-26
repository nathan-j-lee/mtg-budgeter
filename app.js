// DOM Element References
const cardInput = document.getElementById('cardInput');
const searchBtn = document.getElementById('searchBtn');
const debugOutput = document.getElementById('debugOutput');

// The search submission handler
function handleSearchSubmit() {
    const currentInputValue = cardInput.value.trim();

    if (currentInputValue === "") {
        debugOutput.innerText = "⚠️ Please type a card name first!";
        debugOutput.style.color = "#ff5555";
        return;
    }

    // Gather all currently checked color values into an array
    const selectedColors = [];
    const allChecked = document.querySelectorAll('input[name="mtgColor"]:checked');
    allChecked.forEach(cb => selectedColors.push(cb.value));

    // Fallback indicator if no options were checked
    const colorDisplayString = selectedColors.length > 0 ? selectedColors.join(', ') : 'None selected (Any)';

    // Update debug panel with our structured composite inputs
    debugOutput.innerText = `✅ Data Captured Successfully!\n\n🔹 Card Name: "${currentInputValue}"\n🔹 Selected Filter Pool: [ ${colorDisplayString} ]\n\nReady for Phase 2 Autocomplete integration!`;
    debugOutput.style.color = "#8be9fd";
}

// Event Triggers
searchBtn.addEventListener('click', handleSearchSubmit);
cardInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        handleSearchSubmit();
    }
});