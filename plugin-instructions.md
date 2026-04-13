# Pokerogue Moves Tracker Plugin

This guide explains how to install and run the Tampermonkey script `pokerogue-moves-tracker.user.js` which tracks your currently active Pokemon's moves, types, and PP in Pokerogue.

## Requirements
* Google Chrome (or any Chromium-based browser like Edge, Brave).
* The **Tampermonkey** browser extension.

## Installation Instructions

1. **Install Tampermonkey**:
   - Go to the [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo).
   - Click **Add to Chrome** and confirm the installation.

2. **Add the Script**:
   - Click the Tampermonkey icon in your browser's extension toolbar and select **Create a new script...**
   - A new editor tab will open. Delete all the default placeholder code in the editor.
   - Open the file `pokerogue-moves-tracker.user.js` from this repository.
   - Copy all the code from that file and paste it into the Tampermonkey editor.
   - Click **File > Save** (or press `Ctrl+S` / `Cmd+S`).

3. **Run the Game**:
   - Navigate to [https://pokerogue.net](https://pokerogue.net) (or `http://localhost:8000` if you are running the game locally).
   - Once a battle starts, you will see a dark floating overlay with green text in the **bottom right corner** of the screen.
   - The UI will continuously update to display the 4 moves of your active Pokemon, including their types and real-time remaining PP!

## How it works
The script acts as a completely external wiretap. It does not modify any source files on the server or in the game repository. It works by injecting itself before the game loads (`@run-at document-start`), hooking into Javascript's native `Array.prototype.push` to briefly intercept the Phaser Game scene when it's initialized, and then uses a `setInterval` loop to passively poll and render the stats of your active Pokemon directly into the browser DOM.
