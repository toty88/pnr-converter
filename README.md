# PNR Converter (RAW/HTML → Client-friendly Itinerary)

A browser-based **PNR Converter** that parses **GDS RAW** lines or **HTML “AIR/AÉREO”** itineraries into a clean, client-friendly output with:

- General summary (fare/taxes/total when present)
- Passengers + baggage detection (best-effort, agnostic)
- Per-flight price (derived from total / number of segments)
- Flight-by-flight accordions + a general accordion + full table
- Copy as **HTML** (for Outlook/Mail) or **plain text**
- **Spanish / English** output
- **Light/Dark theme** toggle
- Fully **agnostic**: no airline/airport databases

> Note: Parsing is heuristic. Different providers format PNRs differently, so some fields may be missing depending on the input.

---

## Tech

- Vite + TypeScript (vanilla frontend)
- Runs fully in the browser (no backend)

---

## Setup / Run

### Requirements

- Node.js 18+ (recommended 20+)
- npm (or pnpm/yarn)

### Install

```bash
npm install
```

## Contact

- Name: Edgardo Lorenzo
- Email: edgardolor@gmail.com
- GitHub: https://github.com/toty88
