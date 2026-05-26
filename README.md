# 🔮 MTG Alternative Finder — Documentation & Roadmap

This project is a browser-based utility designed to recommend alternative Magic: The Gathering cards for any given selection. It allows players to find budget-friendly replacements, functional backups, or format-legal alternatives by extracting a card's baseline attributes and mapping them against Scryfall’s robust database engine.

---

## 🗺️ Core Application Flow & Roadmap

### 📍 Phase 1: The Baseline Sandbox *(Current)*

* **Objective:** Establish steady communication with the Scryfall API and prove the data parsing concept.


* **Execution:** Create a lightweight interface that requests a single card by name, implements network sanitization, handles layout deviations safely, and extracts primary gameplay markers to use as recommendation tags.



### 🔍 Phase 2: Autocomplete Search Input

* **Objective:** Enhance user experience by eliminating typing guesswork and preventing manual syntax errors.


* **Execution:** Connect the main search bar to a throttled input listener. As the user types, the program queries Scryfall's catalog endpoints to return a dynamic, selectable drop-down menu of similarly named cards.



### 🎨 Phase 3: Color Filtration & Query Generation

* **Objective:** Give the user precise control over where the recommendation engine looks.


* **Execution:**
* Provide a UI element (such as checkboxes) to select target mana colors.


* Build a backend-free search parameter compiler. This engine automatically takes the extracted baseline tags (like mechanical keywords or creature types) and cross-references them with the user's selected color boundaries.


* Format these combined variables into a complex, native Scryfall search string.





### 📊 Phase 4: Output Display & Advanced Sorting

* **Objective:** Present recommendation results cleanly and allow users to slice data dynamically.


* **Execution:** Print the matching alternatives to the screen and provide instant frontend sorting tools. Users will be able to organize the recommended cards on the fly by:


* **Mana Value (CMC):** To find cheaper or equivalent curve replacements.


* **Tag Intersections:** Activating or deactivating specific gameplay tags to narrow down functional similarity.


* **Financial Cost:** To easily prioritize budget-friendly variations.