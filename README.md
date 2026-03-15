# epub-reader

A simple, portable epub reader built with Rust and Tauri. Manages a local library of epub files.

## Features

- **Library management** — Add epub files to a persistent library
- **Portable** — No installation required; library data is stored as `library.json` next to the executable

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

The library is stored as a `library.json` file in the same directory as the executable. Each entry is keyed by the epub's internal identifier of Title:Author if an identifier is not available.

The `library.json` file stores the following information for each book:

- Title, author
- Source file paths
- Date added, last opened
- Current chapter and position
