Original prompt: Baue eine statische mkpascal.art-Fallback-Seite für GitHub Pages im dunklen Stil.

## Aktuell
- Offline-Seite ist statisch umgesetzt.
- Impressum im schlichten Stil angelegt.
- Datenschutz-Verweise wurden aus der Navigation entfernt.

## Nächster Schritt
- Startseite hat jetzt das WebP oben mittig, einen zentrierten Button und einen aufklappenden Spielbereich.
- Button heißt `Spiel starten` und öffnet den Runner weich in-place.
- `game.js` nutzt weiterhin `advanceTime(ms)` und `render_game_to_text`.
- Visuell geprüft: Startseite und aufgeklappte Spielansicht wirken stimmig.
- Offener Punkt bleibt nur die optionale Löschung von `datenschutz.html`, wenn du das noch explizit willst.
- Asset-Struktur für das Spiel ist vorbereitet unter `static/images/404/game/` mit Unterordnern für Items, Animationen, Character, UI und Game-Over.
