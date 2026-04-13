// ==UserScript==
// @name         Pokerogue Moves Tracker
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  External wiretap to track current Pokemon's moves, types, and PP in Pokerogue.
// @author       Jules
// @match        https://pokerogue.net/*
// @match        http://localhost:8000/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // List of Pokemon types mapped to their enum values
    const POKEMON_TYPES = [
        "NORMAL", "FIGHTING", "FLYING", "POISON", "GROUND", "ROCK", "BUG", "GHOST", "STEEL",
        "FIRE", "WATER", "GRASS", "ELECTRIC", "PSYCHIC", "ICE", "DRAGON", "DARK", "FAIRY", "STELLAR"
    ];

    // 1. Intercept Array.prototype.push to steal the BattleScene object
    let sceneCaptured = false;
    const origPush = Array.prototype.push;

    Array.prototype.push = function(...args) {
        const res = origPush.apply(this, args);
        if (!sceneCaptured) {
            for (let i = 0; i < args.length; i++) {
                const item = args[i];
                // Check if the pushed object looks like our BattleScene
                if (item && typeof item === 'object' && item.sys && item.sys.game && item.party) {
                    window.globalScene = item;
                    sceneCaptured = true;
                    console.log("[Moves Tracker] Successfully captured BattleScene!");

                    // Restore original push to avoid performance overhead
                    Array.prototype.push = origPush;
                    break;
                }
            }
        }
        return res;
    };

    // 2. Inject floating HTML UI when document is ready
    function createUI() {
        const container = document.createElement('div');
        container.id = 'pokerogue-moves-tracker';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: rgba(10, 10, 10, 0.9);
            border: 2px solid #2ecc71;
            border-radius: 8px;
            padding: 10px;
            color: #2ecc71;
            font-family: monospace;
            font-size: 14px;
            z-index: 999999;
            pointer-events: none;
            min-width: 200px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.5);
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        `;
        document.body.appendChild(container);
        return container;
    }

    let uiContainer = null;

    window.addEventListener('DOMContentLoaded', () => {
        uiContainer = createUI();
        uiContainer.innerHTML = `<div style="grid-column: span 2; text-align: center;">Waiting for battle...</div>`;
    });

    // 3. Polling loop to update moves and PP
    setInterval(() => {
        if (!uiContainer || !window.globalScene) return;

        try {
            // Check if getPlayerField exists
            if (typeof window.globalScene.getPlayerField !== 'function') return;

            // Get active player Pokemon
            const field = window.globalScene.getPlayerField();
            if (!field || field.length === 0) {
                uiContainer.innerHTML = `<div style="grid-column: span 2; text-align: center;">No active Pokemon</div>`;
                return;
            }

            const activePokemon = field[0];

            // Wait for moveset to be available
            if (!activePokemon || (!activePokemon.getMoveset && !activePokemon.moveset)) return;

            const moveset = activePokemon.getMoveset ? activePokemon.getMoveset() : activePokemon.moveset;

            if (!moveset || moveset.length === 0) {
                uiContainer.innerHTML = `<div style="grid-column: span 2; text-align: center;">Loading moves...</div>`;
                return;
            }

            let html = '';
            for (let i = 0; i < 4; i++) {
                const moveObj = moveset[i];
                if (moveObj && moveObj.moveId !== 0) { // moveId 0 is usually NONE
                    // In Pokerogue, PokemonMove.getMove() returns the underlying Move object
                    const move = moveObj.getMove ? moveObj.getMove() : null;
                    const name = moveObj.getName ? moveObj.getName() : (move ? move.name : "Unknown");
                    const typeIndex = move ? move.type : -1;
                    const typeName = (typeIndex >= 0 && typeIndex < POKEMON_TYPES.length) ? POKEMON_TYPES[typeIndex] : "???";

                    const maxPp = moveObj.getMovePp ? moveObj.getMovePp() : (move ? move.pp : 0);
                    const ppUsed = moveObj.ppUsed || 0;
                    const currentPp = Math.max(0, maxPp - ppUsed);

                    html += `
                        <div style="background: rgba(46, 204, 113, 0.1); padding: 5px; border-radius: 4px;">
                            <div style="font-weight: bold; margin-bottom: 2px;">${name}</div>
                            <div style="font-size: 11px; opacity: 0.8;">${typeName}</div>
                            <div style="font-size: 12px; margin-top: 3px;">PP: ${currentPp}/${maxPp}</div>
                        </div>
                    `;
                } else {
                    html += `
                        <div style="background: rgba(255, 255, 255, 0.05); padding: 5px; border-radius: 4px; display: flex; align-items: center; justify-content: center; opacity: 0.5;">
                            - Empty -
                        </div>
                    `;
                }
            }

            uiContainer.innerHTML = html;

        } catch (e) {
            // Ignore errors silently during polling to prevent console spam
        }
    }, 500);

})();
