// ==UserScript==
// @name         Pokerogue Moves Tracker & Two-Way State Machine
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  External wiretap to track game state and inject commands.
// @author       Jules
// @match        https://pokerogue.net/*
// @match        http://localhost:8000/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Button Enums from Pokerogue (src/enums/buttons.ts)
    const Button = {
        UP: 0,
        DOWN: 1,
        LEFT: 2,
        RIGHT: 3,
        SUBMIT: 4,
        ACTION: 5,
        CANCEL: 6,
        MENU: 7
    };

    // Command Enums from Pokerogue (src/enums/command.ts)
    const Command = {
        FIGHT: 0,
        BALL: 1,
        POKEMON: 2,
        RUN: 3,
        TERA: 4
    };

    // UiMode Enums from Pokerogue (src/enums/ui-mode.ts)
    const UiMode = {
        MESSAGE: 0,
        TITLE: 1,
        COMMAND: 2, // MAIN_MENU
        FIGHT: 3,   // FIGHT_MENU
        BALL: 4,
        TARGET_SELECT: 5,
        MODIFIER_SELECT: 6,
        // ... other modes
    };

    // List of Pokemon types
    const POKEMON_TYPES = [
        "NORMAL", "FIGHTING", "FLYING", "POISON", "GROUND", "ROCK", "BUG", "GHOST", "STEEL",
        "FIRE", "WATER", "GRASS", "ELECTRIC", "PSYCHIC", "ICE", "DRAGON", "DARK", "FAIRY", "STELLAR"
    ];

    // MoveTarget Enums from Pokerogue (src/enums/move-target.ts)
    const MoveTarget = {
        0: "USER",
        1: "OTHER",
        2: "ALL_OTHERS",
        3: "NEAR_OTHER",
        4: "ALL_NEAR_OTHERS",
        5: "NEAR_ENEMY",
        6: "ALL_NEAR_ENEMIES",
        7: "RANDOM_NEAR_ENEMY",
        8: "ALL_ENEMIES",
        9: "ATTACKER",
        10: "NEAR_ALLY",
        11: "ALLY",
        12: "USER_OR_NEAR_ALLY",
        13: "USER_AND_ALLIES",
        14: "ALL",
        15: "USER_SIDE",
        16: "ENEMY_SIDE",
        17: "BOTH_SIDES",
        18: "PARTY",
        19: "CURSE"
    };

    // 1. Intercept Array.prototype.push to steal the BattleScene object
    let sceneCaptured = false;
    const origPush = Array.prototype.push;

    Array.prototype.push = function(...args) {
        const res = origPush.apply(this, args);
        if (!sceneCaptured) {
            for (let i = 0; i < args.length; i++) {
                const item = args[i];
                if (item && typeof item === 'object' && item.sys && item.sys.game && item.party) {
                    window.globalScene = item;
                    sceneCaptured = true;
                    console.log("[Thor Bridge] Successfully captured BattleScene!");
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
            min-width: 250px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);

        const stateHeader = document.createElement('div');
        stateHeader.id = 'pokerogue-state-header';
        stateHeader.style.cssText = `
            text-align: center;
            font-weight: bold;
            font-size: 16px;
            border-bottom: 1px solid #2ecc71;
            padding-bottom: 5px;
        `;
        container.appendChild(stateHeader);

        const dataGrid = document.createElement('div');
        dataGrid.id = 'pokerogue-data-grid';
        dataGrid.style.cssText = `
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        `;
        container.appendChild(dataGrid);

        return { container, stateHeader, dataGrid };
    }

    let uiElements = null;
    window.addEventListener('DOMContentLoaded', () => {
        uiElements = createUI();
        uiElements.stateHeader.innerText = "WAITING...";
        uiElements.dataGrid.innerHTML = `<div style="grid-column: span 2; text-align: center;">Waiting for battle...</div>`;
    });

    // 3. The Command Receiver (The Bridge)
    window.ThorBridge = {
        execute: function(commandStr) {
            if (!window.globalScene || !window.globalScene.ui) {
                console.warn("[Thor Bridge] Cannot execute command. UI not available.");
                return;
            }

            const ui = window.globalScene.ui;
            const currentMode = ui.getMode();

            console.log(`[Thor Bridge] Executing command: ${commandStr} in mode: ${currentMode}`);

            try {
                if (commandStr === "ACTION_BACK") {
                    ui.processInput(Button.CANCEL);
                    return;
                }

                if (currentMode === UiMode.COMMAND) { // MAIN_MENU
                    switch (commandStr) {
                        case "MAIN_FIGHT":
                            ui.setCursor(Command.FIGHT);
                            ui.processInput(Button.ACTION);
                            break;
                        case "MAIN_BALL":
                            ui.setCursor(Command.BALL);
                            ui.processInput(Button.ACTION);
                            break;
                        case "MAIN_POKEMON":
                            ui.setCursor(Command.POKEMON);
                            ui.processInput(Button.ACTION);
                            break;
                        case "MAIN_RUN":
                            ui.setCursor(Command.RUN);
                            ui.processInput(Button.ACTION);
                            break;
                    }
                } else if (currentMode === UiMode.FIGHT) { // FIGHT_MENU
                    if (commandStr.startsWith("SELECT_MOVE_")) {
                        const moveIndex = parseInt(commandStr.replace("SELECT_MOVE_", ""), 10);
                        if (!isNaN(moveIndex) && moveIndex >= 0 && moveIndex <= 3) {
                            ui.setCursor(moveIndex);
                            ui.processInput(Button.ACTION);
                        }
                    }
                } else if (currentMode === UiMode.TARGET_SELECT) { // TARGET_SELECT
                    if (commandStr.startsWith("SELECT_TARGET_")) {
                        const targetIndexStr = commandStr.replace("SELECT_TARGET_", "");
                        // Target selects might need specific logic depending on available targets.
                        // For MVP, we will try to setCursor to the index corresponding to the target.
                        // Enemy indices are typically 2 and 3 in double battles.
                        // Assuming targetIndex is passed as the actual BattlerIndex (e.g. 2 or 3)
                        const targetIndex = parseInt(targetIndexStr, 10);
                        if (!isNaN(targetIndex)) {
                            ui.setCursor(targetIndex);
                            ui.processInput(Button.ACTION);
                        }
                    }
                }
            } catch (e) {
                console.error("[Thor Bridge] Error executing command:", e);
            }
        }
    };

    // 4. Polling loop to update state
    let lastPayloadStr = "";

    setInterval(() => {
        if (!uiElements || !window.globalScene || !window.globalScene.ui) return;

        try {
            let stateStr = "BUSY";
            let payloadData = {};
            let htmlData = '';

            const ui = window.globalScene.ui;
            const currentMode = ui.getMode();

            // Check if UI is active and ready for input.
            // If overlayActive is true, a transition is happening.
            if (!ui.overlayActive) {
                 if (currentMode === UiMode.COMMAND) {
                     stateStr = "MAIN_MENU";
                 } else if (currentMode === UiMode.FIGHT) {
                     stateStr = "FIGHT_MENU";

                     if (typeof window.globalScene.getPlayerField === 'function') {
                         const field = window.globalScene.getPlayerField();
                         if (field && field.length > 0) {
                             let activePokemon = null;
                             if (ui.handlers[UiMode.FIGHT] && ui.handlers[UiMode.FIGHT].pokemon) {
                                 activePokemon = ui.handlers[UiMode.FIGHT].pokemon;
                             } else if (ui.handlers[UiMode.COMMAND] && ui.handlers[UiMode.COMMAND].pokemon) {
                                 activePokemon = ui.handlers[UiMode.COMMAND].pokemon;
                             } else if (ui.handlers[UiMode.COMMAND] && typeof ui.handlers[UiMode.COMMAND].activeBattlerIndex === 'number') {
                                 activePokemon = field[ui.handlers[UiMode.COMMAND].activeBattlerIndex];
                             } else if (ui.handlers[UiMode.COMMAND] && typeof ui.handlers[UiMode.COMMAND].fieldIndex === 'number') {
                                 activePokemon = field[ui.handlers[UiMode.COMMAND].fieldIndex];
                             } else {
                                 activePokemon = field[0];
                             }

                             if (activePokemon && (activePokemon.getMoveset || activePokemon.moveset)) {
                                 const moveset = activePokemon.getMoveset ? activePokemon.getMoveset() : activePokemon.moveset;
                                 if (moveset && moveset.length > 0) {
                                     payloadData.moves = [];
                                     for (let i = 0; i < 4; i++) {
                                         const moveObj = moveset[i];
                                         if (moveObj && moveObj.moveId !== 0) {
                                             const move = moveObj.getMove ? moveObj.getMove() : null;
                                             const name = moveObj.getName ? moveObj.getName() : (move ? move.name : "Unknown");
                                             const maxPp = moveObj.getMovePp ? moveObj.getMovePp() : (move ? move.pp : 0);
                                             const ppUsed = moveObj.ppUsed || 0;
                                             const currentPp = Math.max(0, maxPp - ppUsed);

                                             payloadData.moves.push({
                                                 index: i,
                                                 name: name,
                                                 pp: currentPp,
                                                 maxPp: maxPp
                                             });

                                             htmlData += `
                                                 <div style="background: rgba(46, 204, 113, 0.1); padding: 5px; border-radius: 4px;">
                                                     <div style="font-weight: bold; margin-bottom: 2px;">${name}</div>
                                                     <div style="font-size: 12px; margin-top: 3px;">PP: ${currentPp}/${maxPp}</div>
                                                 </div>
                                             `;
                                         } else {
                                             htmlData += `
                                                 <div style="background: rgba(255, 255, 255, 0.05); padding: 5px; border-radius: 4px; display: flex; align-items: center; justify-content: center; opacity: 0.5;">
                                                     - Empty -
                                                 </div>
                                             `;
                                         }
                                     }
                                 }
                             }
                         }
                     }
                 } else if (currentMode === UiMode.TARGET_SELECT) {
                     stateStr = "TARGET_SELECT";
                     // Try to extract targets from the TargetSelectUiHandler if possible
                     const targetHandler = ui.handlers[UiMode.TARGET_SELECT];
                     if (targetHandler && targetHandler.targets) {
                         payloadData.targets = targetHandler.targets;

                         if (typeof window.globalScene.getPlayerField === 'function') {
                             const field = window.globalScene.getPlayerField();
                             if (field && field.length > 0) {
                                 let activePokemon = null;
                                 if (ui.handlers[UiMode.FIGHT] && ui.handlers[UiMode.FIGHT].pokemon) {
                                     activePokemon = ui.handlers[UiMode.FIGHT].pokemon;
                                 } else if (ui.handlers[UiMode.COMMAND] && ui.handlers[UiMode.COMMAND].pokemon) {
                                     activePokemon = ui.handlers[UiMode.COMMAND].pokemon;
                                 } else if (ui.handlers[UiMode.COMMAND] && typeof ui.handlers[UiMode.COMMAND].activeBattlerIndex === 'number') {
                                     activePokemon = field[ui.handlers[UiMode.COMMAND].activeBattlerIndex];
                                 } else if (ui.handlers[UiMode.COMMAND] && typeof ui.handlers[UiMode.COMMAND].fieldIndex === 'number') {
                                     activePokemon = field[ui.handlers[UiMode.COMMAND].fieldIndex];
                                 } else {
                                     activePokemon = field[0];
                                 }

                                 if (activePokemon && targetHandler.move !== undefined && (activePokemon.getMoveset || activePokemon.moveset)) {
                                     const moveset = activePokemon.getMoveset ? activePokemon.getMoveset() : activePokemon.moveset;
                                     if (moveset) {
                                         for (let i = 0; i < moveset.length; i++) {
                                             const moveObj = moveset[i];
                                             if (moveObj && moveObj.moveId === targetHandler.move) {
                                                 const move = moveObj.getMove ? moveObj.getMove() : null;
                                                 payloadData.moveName = moveObj.getName ? moveObj.getName() : (move ? move.name : "Unknown");
                                                 if (move && move.moveTarget !== undefined) {
                                                     payloadData.targetType = MoveTarget[move.moveTarget] || move.moveTarget.toString();
                                                 }
                                                 break;
                                             }
                                         }
                                     }
                                 }
                             }
                         }

                         let targetTypeStr = payloadData.targetType ? ` (${payloadData.targetType})` : "";
                         let moveNameStr = payloadData.moveName ? ` - ${payloadData.moveName}` : "";

                         htmlData += `<div style="grid-column: span 2; text-align: center;">Select Target${targetTypeStr}${moveNameStr}</div>`;
                         targetHandler.targets.forEach(targetIdx => {
                              htmlData += `
                                 <div style="background: rgba(46, 204, 113, 0.1); padding: 5px; border-radius: 4px; text-align: center;">
                                     Target ${targetIdx}
                                 </div>
                             `;
                         });
                     } else {
                         htmlData = `<div style="grid-column: span 2; text-align: center;">Select Target</div>`;
                     }
                 }
            }

            if (stateStr === "BUSY" || stateStr === "MAIN_MENU") {
                 htmlData = `<div style="grid-column: span 2; text-align: center; opacity: 0.7;">State: ${stateStr}</div>`;
            }

            const payload = {
                state: stateStr,
                data: payloadData
            };
            const payloadStr = JSON.stringify(payload);

            // Update UI and Log if state changed
            if (payloadStr !== lastPayloadStr) {
                lastPayloadStr = payloadStr;
                console.log("[Thor Bridge] Broadcast State:", payloadStr);

                uiElements.stateHeader.innerText = `STATE: ${stateStr}`;
                uiElements.dataGrid.innerHTML = htmlData;

                // If AndroidInterface exists (for the real app), broadcast it
                if (window.AndroidInterface && typeof window.AndroidInterface.onStateChanged === 'function') {
                    window.AndroidInterface.onStateChanged(payloadStr);
                }
            }

        } catch (e) {
            // Ignore errors silently during polling
        }
    }, 500);

})();
