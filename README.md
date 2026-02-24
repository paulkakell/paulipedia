# Personal Wikipedia-style Page (Static, GitHub Pages)

Modern, responsive, and Wikipedia-inspired personal biography page that loads all content from JSON.

## Files

- `index.html` : Main page
- `editor.html` : GUI editor for `data/data.json` (download/save updated JSON)
- `assets/styles.css` : Styling
- `assets/app.js` : Loads JSON and renders the page
- `assets/editor.mjs` : GUI editor logic
- `assets/json_ops.mjs` : JSON manipulation helpers (also used by tests)
- `assets/editor.css` : Editor styling
- `data/data.json` : Your content, edit this
- `assets/favicon.svg` : Favicon

## Edit content

Open `data/data.json` and update the values.
No build step is required.

Alternatively, open `editor.html` and use the tree editor to add, delete, or change items. The editor cannot write back to GitHub Pages directly, so you must download the updated `data.json` and commit it.

## Notes

- All links and paths are relative for GitHub Pages.
- Dark mode is included and stored in localStorage.
- The search box highlights matches within the article text.
