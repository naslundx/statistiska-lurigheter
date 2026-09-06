# Statistiska lurigheter

En liten statisk webbplats (vanilla JS) som förklarar statistiska begrepp på ett
lekfullt sätt. Allt innehåll definieras i `content.json`.

## Köra lokalt

Sidan läser `content.json` med `fetch`, så den måste serveras via en webbserver
(inte öppnas som `file://`). Kör t.ex:

```bash
python3 -m http.server 8000
```

Öppna sedan http://localhost:8000 i webbläsaren.

## Kontrollera innehållet

Efter att du ändrat `content.json` kan du validera det (giltig JSON + rätt
struktur: ämnen, delar, svarsalternativ, `showIf`-referenser, grafer):

```bash
python3 scripts/check-content.py
```

Skriptet skriver ut varningar och fel och avslutar med kod `1` om något är fel
(annars `0`), så det går även att använda i t.ex. en pre-commit-hook eller CI.

## Felsökning / Debuggning

För att hoppa direkt till en specifik del (för felsökning eller test), kan du lägga till `?page=N` i webbadressen, där `N` är numret på den "del" (part) du vill se (1-indexerat). Till exempel:

```
http://localhost:8000/?page=5
```

Detta hoppar över introt och laddar direkt den 5:e delen räknat över alla ämnen.

## Struktur

```
index.html        Skal + sidhuvud + sidfot
css/style.css     Tema (färgglatt, barnvänligt, responsivt)
js/main.js        App: laddar innehåll, navigering, start/slut
js/render.js      Ritar en "del": rader, grafer, svarsknappar (animerat)
js/graph.js       Ritar diagram (punkter + linjer) som SVG
js/variables.js   Slumpar variabler + textinfogning ($var, *emfas*)
content.json      Allt innehåll
scripts/check-content.py  Validerar content.json
```

## Innehållsmodell (`content.json`)

- **site**: titel, namn, LinkedIn-länk (fyll i din riktiga URL i `linkedin`).
- **intro / outro**: start- respektive slutsida.
- **topics[]**: varje ämne har `title`, valfria `variables` och `parts[]`.
  - **En `part` = en helskärmssida.** Raderna animeras in en efter en.
  - **variables**: slumpas vid sidladdning.
    - `[min, max]` (två tal) → slumpat heltal (inklusivt).
    - `["a", "b", ...]` (lista med text) → slumpat val.
  - **En rad (`lines[]`) kan vara:**
    - En textsträng. Stöder `$variabel` och `*emfas*` (färgad markering).
    - `{ "graph": { ... } }`: se nedan.
    - `{ "options": { "id", "choices", "correct?", "reveal?" } }`: svarsknappar.
      När en `part` har `options` visas ingen "Nästa"-knapp förrän man svarat.
      `reveal` kan visa uppföljningsrader per svar, eller `"*"` för alla.
  - En `part` kan ha `showIf: { question, equals }` för att bara visas om ett
    tidigare svar matchar.

### Graf

```json
{
  "graph": {
    "xRange": [0, 45],
    "yRange": [40, 100],
    "series": [
      { "type": "points", "color": "blue", "data": [[5, 68], [8, 64]] },
      { "type": "points", "color": "teal", "data": [[1, 30, 3]] },
      { "type": "line", "color": "purple", "style": "dashed", "data": [[5, 52], [40, 86]] },
      { "type": "bars", "barWidth": 0.8, "data": [[1, 30.1], [2, 17.6]] }
    ]
  }
}
```

Serietyper:

- `points`: punkter. En datapunkt är `[x, y]` eller `[x, y, felmarginal]`
  (felmarginalen ritas som ett stapelstreck).
- `line`: linje genom punkterna. `"style": "dashed"` ger streckad linje.
  `"smooth": true` ger en mjuk, icke-linjär kurva (spline) istället för raka segment.
- `bars`: stapeldiagram. `barWidth` (i x-enheter) styr breddan. Utan `color`
  blir staplarna regnbågsfärgade; ange `color` för en enda färg.

**Axelbeskrivningar och ändvärden:** lägg till `xLabel`/`yLabel` för en beskrivning
under/vid axeln, och `xEnds`/`yEnds` (`[minEtikett, maxEtikett]`) för start- och
slutvärden. Utan `xEnds`/`yEnds` visas `xRange`/`yRange`-värdena; en tom sträng
(`""`) döljer det ändvärdet. Inga mellansteg (ticks) ritas.

Sätt `"axes": false` för att helt dölja axellinjer, pilar och ändvärden (t.ex.
för en ren prickspridning där axlarna inte tillför något).

Färger: `blue, red, green, orange, purple, pink, yellow, teal, grey` (eller egen
hex). Axlar ritas utan mellanliggande steg.

### Ikon-rutnät (proportioner / basfrekvens)

```json
{
  "graph": {
    "iconGrid": {
      "cols": 10,
      "groups": [
        { "color": "red", "count": 1 },
        { "color": "orange", "count": 1 },
        { "color": "grey", "count": 98 }
      ]
    }
  }
}
```

Ritar ett rutnät av färgade prickar (fylls rad för rad). Bra för att visa
andelar, t.ex. falska positiva i ett medicinskt test.

### Förklaring (legend)

Alla grafer (både axeldiagram och ikon-rutnät) kan få en liten förklaring under
sig med `legend`:

```json
{
  "graph": {
    "iconGrid": { "cols": 10, "groups": [ ... ] },
    "legend": [
      { "color": "red", "label": "sjuk" },
      { "color": "grey", "label": "frisk" },
      { "type": "dashed", "color": "purple", "label": "medelvärde" }
    ]
  }
}
```

Varje post har `color` och `label`. Med `"type": "line"` eller `"type": "dashed"`
visas ett linjeprov istället för en prick (standard är prick).
