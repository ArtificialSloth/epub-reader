# epub-reader

A simple, portable [foliate-js](https://github.com/johnfactotum/foliate-js) based ePub reader built with Rust, Tauri, and React.

## Features

- **Library management** - Add ePub files to a persistent human-readable library stored in `library.json` next to the executable
- **Custom themes** - Apply custom themes in `styles.css` next to the executable

## Development

Requires Rust and Node.js installed.

```bash
npm install
npm run tauri dev
```

## Building

```bash
npm run tauri build
```

The binary will be at `src-tauri/target/release/epub-reader.exe` (Windows) or `src-tauri/target/release/epub-reader` (Linux/macOS).

## Library Data

The library is stored as a `library.json` file in the same directory as the executable. Each entry is keyed by the ePub's internal identifier or Title:Author if an identifier is not available. This allows changing file names/paths without losing progress.

The `library.json` file stores the following information for each book:

- Title, author
- Source file paths
- Date added, last opened
- Current location as an ePub CFI

## Custom Themes

Any rules defined in a `styles.css` file in the same directory as the executable will overwrite the default theme. Any rules below the `/* @epub */` marker will be applied to the ePub's content.

### Example:

```
:root {
    /* these three color variables are applied to ePub content by default, but can still be overwritten below the @epub marker */
    --bg-primary:   #000;
    --text-primary: #fff;
    --text-link:    #0000ff;

    font-size: 24px; /* this only affects the app's ui */
}

/* @epub */
body {
    line-height: 1.2; /* this only affects the ePub's content */

    /* these two properties are set by the user and will be overwritten */
    font-family: monospace;
    font-size: 24px;
}

h1 {
    /* you can still set them here though, ideally using em instead of px for sizes */
    font-family: sans-serif;
    font-size: 1em;
}
```
