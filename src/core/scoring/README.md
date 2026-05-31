# Scoring

Das Scoring-Modul berechnet Punkte für abgeschlossene Features (mid-game) und für alle verbleibenden Features + Bauern am Spielende (end-game). Es operiert ausschließlich auf `Feature`-Objekten und schreibt Punkte nie selbst in den State — das übernimmt `_resolveScoring()` in `Game.ts`.

## Mehrheitsregel (`majority.ts`)

Grundlage aller Wertungen: Wer bekommt die Punkte?

```ts
function majorityWinners(feature: Feature): PlayerId[]
```

- Zählt Meeples pro Spieler in `feature.meeples`
- Gibt alle Spieler mit der **höchsten** Meeple-Anzahl zurück
- Bei Gleichstand bekommen **alle** Gleichplatzierten die vollen Punkte (kein Teilen)
- Feature ohne Meeples → leeres Array (keine Punkte)

Beispiel: Spieler A hat 2 Meeples, Spieler B hat 2 Meeples → beide erhalten volle Punkte.

## Mid-Game Scoring (`midGame.ts`)

Wird aufgerufen, sobald ein Feature als `completed` markiert wird (innerhalb von `_resolveScoring()`).

```ts
function scoreCompletedMidGame(feature): { winners: PlayerId[], points: number }
```

| Feature | Formel | Beispiel |
|---|---|---|
| `CITY` | `2 × (Kacheln + Wappen)` | 3 Kacheln, 1 Wappen → 8 Punkte |
| `ROAD` | `Anzahl Kacheln` | 4 Kacheln → 4 Punkte |
| `MONASTERY` | `9` (fix) | immer 9 Punkte |
| `FIELD` | — | wirft Error (Felder schließen nie mid-game ab) |

`tileCount(feature)` zählt eindeutige TileIds in `feature.segments` — mehrere Segmente derselben Kachel zählen nur einmal.

## End-Game Scoring (`endGame.ts`)

Wird in `_applyEndGame()` für alle unvollständigen Features (außer Feldern) aufgerufen.

```ts
function scoreIncompleteEndGame(feature): { winners: PlayerId[], points: number }
```

| Feature | Formel | Verhältnis zu mid-game |
|---|---|---|
| `CITY` | `1 × (Kacheln + Wappen)` | halbe Punkte |
| `ROAD` | `Anzahl Kacheln` | gleich |
| `MONASTERY` | `1 + monasterySurroundCount` | 1 Punkt + 1 pro Nachbar |
| `FIELD` | `0` | nicht hier gewertet (→ Bauern) |

## Bauernwertung (`farmers.ts`)

Felder werden ausschließlich am Spielende gewertet. Bauern (Meeples auf Feldern) erhalten Punkte für jede **abgeschlossene** Stadt, die an ihr Feld angrenzt.

```ts
function scoreFarmers(reg, tileById): Array<{ winners, points, fieldId }>
```

Algorithmus:
1. Alle Feld-Features mit mindestens einem Meeple durchgehen
2. Für jedes Feld: alle Kacheln des Feldes durchsuchen
3. Auf jeder Kachel: alle Stadt-Segmente prüfen
4. Wenn das Stadt-Feature `completed === true` → in `adjacent`-Set aufnehmen
5. Punkte = `adjacent.size × 3`

**Jede abgeschlossene Stadt zählt nur einmal**, auch wenn das Feld über mehrere Kacheln an sie angrenzt (Set verhindert Doppelzählung).

## Ablauf im Spielfluss

```
placeTile()
  └─ placeTileInternal() → completedFeatures[]
        └─ _resolveScoring()
              ├─ scoreCompletedMidGame(f) für jedes abgeschlossene Feature
              └─ Meeples zurückgeben

Deck leer / keine platzierbaren Kacheln
  └─ _applyEndGame()
        ├─ scoreIncompleteEndGame(f) für alle offenen Features (außer FIELD)
        └─ scoreFarmers(registry, tileById) für alle Felder mit Meeples
```
