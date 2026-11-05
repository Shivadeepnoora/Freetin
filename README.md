# Freetin: Hyderabad Live Traffic 🚦

A lightweight web app that shows **live traffic in Hyderabad**: a city-wide traffic-flow map, speeds and congestion on 18 key roads and junctions (HITEC City, Gachibowli, Biodiversity Junction, Ameerpet, Panjagutta, Mehdipatnam, Secunderabad, LB Nagar, Uppal and more), plus a list of current incidents (jams, accidents, roadworks, closures, flooding).

It's static HTML/CSS/JS with no build step and no backend.

## Features
- **Live flow overlay** on an OpenStreetMap base map, coloured from free-flow to jammed
- **Key roads list**: current speed against usual speed, extra delay, sorted by most congested
- **Incidents**: type, from → to, delay, start time, with filters (jams / accidents / works / weather)
- **City congestion %** and the worst road at a glance
- Auto-refresh (every 2, 5 or 10 min, or off), paused while the tab is hidden
- Mobile-friendly, with light and dark themes
- **Demo mode** with clearly labelled sample data when no API key is set

## Data source
Live data comes from the [TomTom Traffic API](https://developer.tomtom.com/traffic-api/documentation/product-information/introduction):
- Flow tiles: `traffic/map/4/tile/flow/relative0`
- Flow Segment Data: `traffic/services/4/flowSegmentData` (one call per tracked road)
- Incident Details v5: `traffic/services/5/incidentDetails` (bounding box around the ORR)

### Get a free key
1. Sign up at <https://developer.tomtom.com/> and create an app.
2. Copy its API key.
3. Open the app, click **⚙︎**, paste the key and save. The key is stored only in your browser's `localStorage` and sent only to `api.tomtom.com`. You can also open `index.html?key=YOUR_KEY` once.

**Quota tip:** each refresh uses 19 non-tile requests (18 roads + 1 incident call). The free tier covers about 2,500 non-tile requests a day, so the default 5-minute refresh suits a few hours of active viewing a day. Map tiles are counted separately.

## Run locally
```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy
Any static host works. For **GitHub Pages**: Settings → Pages → deploy from branch → root.

> If you deploy publicly with a key baked in via URL, restrict the key to your domain in the TomTom dashboard.

## Customise
- Tracked roads: edit the `ROADS` array in `app.js` (name, area, lat/lon; TomTom snaps each point to the nearest road).
- Coverage area: `BBOX` in `app.js` (max 10,000 km² for incident queries).
- Congestion thresholds: `levelFor()` in `app.js`.
