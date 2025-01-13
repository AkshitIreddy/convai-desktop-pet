const fs = require('fs');
const path = require('path');

class CharacterStore {
    constructor() {
        this.store = null;
    }

    async initializeStore() {
        try {
            const { default: Store } = await import('electron-store');
            this.store = new Store();

            // Try to get the characters, if it fails, we'll reset the store
            try {
                this.store.get('characters');
            } catch (error) {
                console.error('Error reading store, resetting...', error);
                this.store.clear();
            }

            if (!this.store.has('characters') || !this.store.has('apiKey')) {
                const charactersPath = path.join(__dirname, 'characters.json');
                const characters = JSON.parse(fs.readFileSync(charactersPath, 'utf8'));
                
                const characterData = {};
                for (const [name, data] of Object.entries(characters)) {
                    characterData[name] = {
                        id: data.character_id,
                        spawn: false,
                        session_id: -1
                    };
                }

                this.store.set('characters', characterData);
                this.store.set('apiKey', '');
            }

            // Add settings initialization
            if (!this.store.has('settings')) {
                this.store.set('settings', {
                    defaultFrameDuration: 200,
                    defaultMoveDuration: 12
                });
            }
        } catch (error) {
            console.error('Failed to initialize store:', error);
            throw error;
        }
    }

    getCharacterId(name) {
        const characters = this.store.get('characters');
        return characters[name]?.id;
    }

    getCharacterSpawn(name) {
        const characters = this.store.get('characters');
        return characters[name]?.spawn;
    }

    getAllCharacters() {
        return this.store.get('characters');
    }

    setCharacter(name, id, spawn = false) {
        const characters = this.store.get('characters');
        characters[name] = { id, spawn, session_id: -1 };
        this.store.set('characters', characters);
    }

    setCharacterSpawn(name, spawn) {
        const characters = this.store.get('characters');
        if (characters[name]) {
            characters[name].spawn = spawn;
            this.store.set('characters', characters);
        }
    }

    getApiKey() {
        return this.store.get('apiKey');
    }

    setApiKey(key) {
        this.store.set('apiKey', key);
    }

    setCharacterId(name, newId) {
        const characters = this.store.get('characters');
        if (characters[name]) {
            characters[name].id = newId;
            this.store.set('characters', characters);
        }
    }

    getCharacterSessionId(name) {
        const characters = this.store.get('characters');
        return characters[name]?.session_id;
    }

    setCharacterSessionId(name, sessionId) {
        const characters = this.store.get('characters');
        if (characters[name]) {
            characters[name].session_id = sessionId;
            this.store.set('characters', characters);
        }
    }

    getSettings() {
        return this.store.get('settings');
    }

    updateSettings(settings) {
        this.store.set('settings', settings);
    }
}

module.exports = CharacterStore;
