# PRTS

A local detective board for **Goose Goose Duck** (鹅鸭杀) meetings. Paste a screenshot of the meeting screen. The app reads every player's name and icon and marks who is dead. You then work the round out on the map: where people were, the routes they walked, alibis, accusations, body locations and votes.

Everything runs on your own computer. Name reading works offline, and nothing is uploaded anywhere.

## Requirements

- [Node.js](https://nodejs.org/) 16 or newer
- A desktop browser: Chrome, Edge or Firefox

## Start

- **Windows:** double-click `start.bat`.
- **macOS / Linux:** run `node server.js` in this folder.

Your browser opens at `http://localhost:7777`. To use another port, run `node server.js 8080`.

> Your games are stored per address. Keep using port 7777 if you want to see games you made earlier.

> Open the app through the server, not by double-clicking `public/index.html`. Name reading can't run on a page opened as a file.

## How to use

1. During a meeting, take a screenshot and press **Ctrl+V** on the page, or drop the image onto it.
2. Check the names that were read, then click **Start new game**.
3. Drag players from the list onto the map where they were seen.
4. At the next meeting, import that meeting's screenshot and choose **New conference**. Each conference gets its own clean board and keeps its screenshot. Switch between conferences with the C1, C2… tabs or the `[` `]` keys.

### Tools

| Key | Tool |
|-----|------|
| `V` | Move / select |
| `R` | Path: drag a player along the route they walked |
| `G` | Play / pause everyone's paths at the same time |
| `L` | Link two players (Together, Vouches, Accuses, Saw, Followed, Killed) |
| `B` | Body or event pin |
| `N` | Switch between the map and the relationship network |
| `P` | Pen |
| `T` | Text note |
| `E` | Eraser |
| `1`–`6` | Mark the selected player: Unknown, Goose-lean, Cleared, Sus, Duck, Neutral |
| `D` | Cycle Alive / Dead / Ejected |
| `F` | Fit the map (or the network) to the screen |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |

Use **Space**+drag or middle-drag to pan, and the mouse wheel to zoom.

Other features:
- **Relationship network:** everyone on a ring with this conference's relations, readable even when players were bunched up on the map
- **Votes received:** how many votes each player (and Skip) got in each conference, shown as a badge on the tokens
- **Event pins:** what happened, when (early / mid / late or a 30-second span) and who was involved, listed as a timeline in the Conference tab
- quick alive / dead / ejected buttons in the player list
- per-player role claims and notes
- custom map images (map menu → Upload)
- PNG export of the board
- saving and loading whole games as `.json`
- an **EN / 中文** language switch

### If the boxes don't line up with the cards

The import window has **Calibration** sliders. Use them if your screenshot isn't a plain 16:9 full-screen capture.

## Your data

Games are kept in your browser's local storage on this computer. Upgrading from GGD Thinking Space 1.0.x keeps them, as long as you open the same address (`http://localhost:7777`) in the same browser. To back one up or move it to another machine, use **Game → Save game (.json)**; it includes the conference screenshots.

## Credits

- Unofficial fan tool. It is not affiliated with or endorsed by the makers of Goose Goose Duck.
- The PRTS name and the interface style are a fan tribute to *Arknights*. This tool is not affiliated with or endorsed by Hypergryph or Yostar.
- The built-in map images come from the community Steam guide <https://steamcommunity.com/sharedfiles/filedetails/?id=2620700282>.
- Name reading uses [tesseract.js](https://github.com/naptha/tesseract.js) and its core and English language data, all under the Apache License 2.0. See `public/vendor/LICENSES.md`.
- The interface font is [Rajdhani](https://fonts.google.com/specimen/Rajdhani) by Indian Type Foundry, under the SIL Open Font License 1.1. See `public/fonts/OFL.txt`.

See `CHANGELOG.md` for what changed in each version.
