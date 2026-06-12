# Flipp Bull

Flipp Bull is a static browser game built with HTML, CSS, vanilla JavaScript, and Canvas.

## Project Structure

```text
.
├── index.html
├── styles.css
├── game.js
└── assets/
```

The project does not require a backend, database, build step, or external CDN.

## Local Run

Open `index.html` directly in a browser, or run a local static server from the project folder:

```bash
python -m http.server 4174
```

Then open:

```text
http://127.0.0.1:4174/
```

Any other static server works as long as it serves the project root.

## Deploy To Vercel

1. Create a new Vercel project.
2. Import this folder or the Git repository.
3. Leave build settings empty:
   - Build command: none
   - Output directory: project root
4. Deploy.

Vercel will serve `index.html`, `styles.css`, `game.js`, and `assets/` as static files.

## Deploy To Netlify

1. Create a new Netlify site.
2. Drag and drop the project folder into Netlify, or connect the Git repository.
3. Leave build settings empty:
   - Build command: none
   - Publish directory: project root
4. Deploy.

Netlify will serve the game as a static site.

## Storage

The game stores nickname, best score, leaderboard, and reward state in `localStorage`.

## Debug

Debug and FPS display are disabled by default:

```js
const DEBUG = false;
const DEBUG_PERFORMANCE = false;
```
