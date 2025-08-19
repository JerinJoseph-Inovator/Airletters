Offline tiles and overlays

This folder contains optional offline data to support the Map Screen when the device has no network.

Supported artifacts (optional):

1) MBTiles -> pre-rendered tiles
   - Create MBTiles for India (zoom levels ~5-12) using TileMill or tippecanoe/mbutil.
   - Extract tiles into PNG files at path: <app document directory>/offline_tiles/{z}/{x}/{y}.png
   - On device/emulator you can copy them into the app's document directory or implement an installer screen.

2) GeoJSON overlays
   - `india_states.geojson` (optional) : place under `assets/offline/india_states.geojson` in the project to display state labels.
   - `cities.json` : simple array of { name, lat, lon } for key cities, placed under `assets/offline/cities.json`.

Notes:
- This app checks for `FileSystem.documentDirectory + 'offline_tiles'` at runtime. If present, the map will use `UrlTile` to load local tiles via file:// URLs.
- Generating MBTiles and extracting tiles can be large in size. Keep zoom levels and tile area limited to India to save space.
- If you want, I can add a small installer UI to copy bundled tiles into DocumentDirectory automatically.
