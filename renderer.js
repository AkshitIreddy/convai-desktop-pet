const { ipcRenderer, shell } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    // Set up navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active class from all items and pages
            navItems.forEach(i => i.classList.remove('active'));
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked item and corresponding page
            item.classList.add('active');
            const page = item.getAttribute('data-page');
            document.getElementById(`${page}-page`).classList.add('active');
        });
    });

    // Original get-characters code
    ipcRenderer.send('get-characters');

    // Load settings
    ipcRenderer.send('get-settings');

    // Add this new event listener
    document.addEventListener('click', (event) => {
        if (event.target.tagName === 'A' && event.target.classList.contains('external-link')) {
            event.preventDefault();
            shell.openExternal(event.target.href);
        }
    });
});

document.getElementById('api-key-button').addEventListener('click', () => {
    createApiKeyPopup();
});

function createApiKeyPopup() {
    // Create popup elements
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';

    const content = document.createElement('div');
    content.className = 'popup-content';

    const header = document.createElement('div');
    header.className = 'popup-header';

    const title = document.createElement('h3');
    title.textContent = 'API Key Configuration';

    const closeButton = document.createElement('span');
    closeButton.textContent = '\u00D7';
    closeButton.className = 'popup-close';
    closeButton.onclick = () => overlay.remove();

    // Assemble the popup
    header.appendChild(title);
    header.appendChild(closeButton);
    content.appendChild(header);

    // Add current API key display
    const currentKeyDisplay = document.createElement('p');
    currentKeyDisplay.className = 'current-id';
    currentKeyDisplay.textContent = 'Current API Key: ';
    content.appendChild(currentKeyDisplay);

    // Create form for API key input
    const form = document.createElement('div');
    form.innerHTML = `
        <div class="id-edit-container">
            <label for="api-key">New API Key:</label>
            <input type="text" id="api-key-input" class="id-input">
            <button id="update-api-key" class="update-button">
                Update API Key
            </button>
        </div>
    `;
    content.appendChild(form);

    // Add event listener for the update button
    requestAnimationFrame(() => {
        const updateButton = document.getElementById('update-api-key');
        const keyInput = document.getElementById('api-key-input');
        
        // Get current API key
        ipcRenderer.send('get-api-key');
        
        ipcRenderer.once('api-key', (event, apiKey) => {
            currentKeyDisplay.textContent = `Current API Key: ${apiKey || 'Not set'}`;
            keyInput.value = apiKey || '';
        });

        updateButton.addEventListener('click', () => {
            const newKey = keyInput.value;
            ipcRenderer.send('update-api-key', newKey);
            overlay.remove();
        });
    });

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Show the popup with a fade effect
    requestAnimationFrame(() => {
        overlay.style.display = 'flex';
    });
}

ipcRenderer.on('characters', (event, characters) => {
    const characterList = document.getElementById('character-list');
    characterList.innerHTML = '';

    for (const [name, data] of Object.entries(characters)) {
        // Create card container
        const card = document.createElement('div');
        card.className = 'character-card';

        // Add edit button
        const editButton = document.createElement('img');
        editButton.src = 'assets/icons/edit.png';
        editButton.className = 'edit-button';
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();  // Prevent event bubbling
            const characterId = data.id; // Get the ID from the character data
            createPopup(name, characterId); // Pass the ID to createPopup
        });

        // Add character image
        const image = document.createElement('img');
        image.src = `assets/${name}/walk1.png`;
        image.alt = name;
        image.className = 'character-image';

        // Create info container
        const info = document.createElement('div');
        info.className = 'character-info';

        // Add character name only (removing ID)
        const nameElement = document.createElement('h3');
        nameElement.textContent = name.charAt(0).toUpperCase() + name.slice(1);

        // Create spawn toggle container
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'toggle-container';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `spawn-${name}`;
        checkbox.checked = data.spawn;
        checkbox.addEventListener('change', () => {
            ipcRenderer.send('update-spawn', name, checkbox.checked);
        });

        const label = document.createElement('label');
        label.htmlFor = `spawn-${name}`;
        label.textContent = 'Active';

        // Assemble the card
        toggleContainer.appendChild(checkbox);
        toggleContainer.appendChild(label);

        info.appendChild(nameElement);
        info.appendChild(toggleContainer);

        card.appendChild(editButton);
        card.appendChild(image);
        card.appendChild(info);
        
        characterList.appendChild(card);
    }
});

function createPopup(characterName, characterId) {
    // Create popup elements
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';

    const content = document.createElement('div');
    content.className = 'popup-content';

    const header = document.createElement('div');
    header.className = 'popup-header';

    const title = document.createElement('h3');
    title.textContent = 'Character ID Configuration';

    const closeButton = document.createElement('span');
    closeButton.textContent = '\u00D7';
    closeButton.className = 'popup-close';
    closeButton.onclick = () => overlay.remove();

    // Assemble the popup
    header.appendChild(title);
    header.appendChild(closeButton);
    content.appendChild(header);

    // Add ID display before the form
    const idDisplay = document.createElement('p');
    idDisplay.className = 'current-id';
    idDisplay.textContent = `Current ID: ${characterId}`;
    content.appendChild(idDisplay);

    // Create form for ID input
    const form = document.createElement('div');
    form.innerHTML = `
        <div class="id-edit-container">
            <label for="character-id">New Character ID:</label>
            <input type="text" id="character-id-${characterName}" class="id-input">
            <button id="update-id-${characterName}" class="update-button">
                Update ID
            </button>
        </div>
    `;
    content.appendChild(form);

    // Add event listener for the update button
    requestAnimationFrame(() => {
        const updateButton = document.getElementById(`update-id-${characterName}`);
        const idInput = document.getElementById(`character-id-${characterName}`);
        
        // Set initial value to the current ID
        idInput.value = characterId;

        updateButton.addEventListener('click', () => {
            const newId = idInput.value;
            ipcRenderer.send('update-character-id', characterName, newId);
            overlay.remove();
        });
    });

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Show the popup with a fade effect
    requestAnimationFrame(() => {
        overlay.style.display = 'flex';
    });
}

// Add settings listeners
ipcRenderer.on('settings', (event, settings) => {
    document.getElementById('frame-duration').value = settings.defaultFrameDuration;
    document.getElementById('move-duration').value = settings.defaultMoveDuration;
});

document.getElementById('save-settings').addEventListener('click', () => {
    const settings = {
        defaultFrameDuration: parseInt(document.getElementById('frame-duration').value),
        defaultMoveDuration: parseInt(document.getElementById('move-duration').value)
    };
    ipcRenderer.send('update-settings', settings);
});