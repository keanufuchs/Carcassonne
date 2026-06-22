# Aufteilung der Präsentation auf 4 Personen

Gesamtzeit: 20 Minuten  
Ziel: Jede Person spricht ca. 5 Minuten. Die Übergaben sind so gesetzt, dass jede Person einen inhaltlich geschlossenen Block hat.

## Kurzüberblick

| Person | Inhalt | Folien | Zeit |
|--------|--------|--------|------|
| Person 1 | Einstieg, Produkt, Rahmen, Anforderungen | Folien 1-6 | 5:00 min |
| Person 2 | Prozess und Architektur-Grundlagen | Folien 7-13 | 5:00 min |
| Person 3 | Designentscheidungen und Umsetzung | Folien 14-20 | 5:00 min |
| Person 4 | Qualität, Start, Code-Einstieg, Abschluss | Folien 21-27 | 5:00 min |

## Person 1 — Einstieg, Produkt, Rahmen, Anforderungen

Zeit: 5:00 Minuten  
Folien 1-6:

- 1: Titel
- 2: Agenda
- 3: Was soll das Ganze?
- 4: Das Produkt in einem Satz
- 5: Rahmen des Projekts
- 6: Anforderungen im Überblick

Inhaltlicher Fokus:

- Kurz erklären, dass es um eine digitale Carcassonne-Umsetzung als Projektabgabe geht.
- Produktidee in einem Satz: Kacheln legen, Meeple setzen, Punkte erzielen.
- Rahmen klären: Web-App, Desktop-App, KI und Multiplayer als Erweiterungen.
- Anforderungen knapp einordnen: Must-Haves erfüllt, Pflicht-Erweiterungen erfüllt.

Übergabe:

> "Nachdem klar ist, was wir gebaut haben und welche Anforderungen dahinterstanden, geht es jetzt darum, wie wir das Projekt organisiert und gesteuert haben."

## Person 2 — Prozess und Architektur-Grundlagen

Zeit: 5:00 Minuten  
Folien 7-13:

- 7: Prozess & Anforderungen
- 8: Vorgehensweise: agil
- 9: 4 Stakeholder-Meetings als Review-Punkte
- 10: Backlog statt klassischem Pflichtenheft
- 11: Architektur & Design
- 12: Strikte 4-Schichten-Architektur
- 13: Domänenmodell: ein zentraler GameState

Inhaltlicher Fokus:

- Agile Vorgehensweise erklären: kurze Schleifen, Reviews, Anpassungen.
- Stakeholder-Meetings als Kontrollpunkte darstellen.
- Backlog als lebendiges Pflichtenheft erklären.
- Architektur als Brücke zur Umsetzung einführen.
- 4-Schichten-Modell und zentralen `GameState` als wichtigste Grundlage erklären.

Übergabe:

> "Auf dieser Architektur bauen die konkreten Designentscheidungen auf. Die nächsten Folien zeigen, wie daraus ein robuster Spielablauf und die eigentliche Umsetzung entstanden sind."

## Person 3 — Designentscheidungen und Umsetzung

Zeit: 5:00 Minuten  
Folien 14-20:

- 14: Spielzug als Zustandsautomat
- 15: Zentrale Entscheidungen — begründet
- 16: User Interface & Umsetzung
- 17: Oberfläche — eine Codebasis, mehrere Ziele
- 18: Spielkern & Wertung
- 19: Reasoning AI — drei Stufen, mit Fallback
- 20: Netzwerk-Multiplayer — autoritatives Backend

Inhaltlicher Fokus:

- Spielzug als Zustandsautomat erklären: ziehen, legen, Meeple setzen, werten.
- Die wichtigsten Designentscheidungen begründen, nicht jedes Detail aufzählen.
- UI-Ansatz erklären: eine Codebasis, 2D/3D, Zoom und Pan.
- Spielkern und Wertung als reine, testbare Logik hervorheben.
- KI kurz erklären: mehrere Stufen plus Fallback.
- Netzwerk-Multiplayer knapp: Server ist autoritativ, Clients senden Aktionen.

Übergabe:

> "Damit ist gezeigt, wie das Spiel technisch umgesetzt ist. Zum Schluss geht es darum, wie wir die Qualität abgesichert haben und wie man das Projekt startet beziehungsweise im Code nachvollzieht."

## Person 4 — Qualität, Start, Code-Einstieg, Abschluss

Zeit: 5:00 Minuten  
Folien 21-27:

- 21: Qualitätssicherung
- 22: Testpyramide & Kennzahlen
- 23: Start & Code-Einstieg
- 24: Drei Wege
- 25: Von außen nach innen
- 26: Abnahmekriterien — erfüllt
- 27: Vielen Dank

Inhaltlicher Fokus:

- Testpyramide erklären: Unit-Tests für Kernlogik, ergänzende Tests für Integration/UI.
- Kennzahlen nur als Beleg nennen, nicht einzeln vorlesen.
- Drei Startwege zeigen: sofort spielen, aus dem Code, Desktop-App.
- Code-Einstieg erklären: von außen nach innen lesen.
- Abnahmekriterien als Abschluss nutzen: Projektziel erreicht.
- Mit kurzem Fazit enden.

Abschluss:

> "Zusammengefasst haben wir eine spielbare Carcassonne-Version mit sauber getrenntem Spielkern, UI, KI- und Multiplayer-Erweiterung umgesetzt und die zentralen Abnahmekriterien erfüllt. Vielen Dank."

## Zeitpuffer

Falls jemand schneller ist, nicht künstlich strecken. Den Puffer für Fragen oder eine ruhigere Abschlussfolie nutzen. Wenn die Zeit knapp wird, zuerst Detailbeispiele kürzen, nicht die Übergaben.

Empfohlene Zielzeiten:

- Person 1: 4:45 min + 0:15 Übergabe
- Person 2: 4:45 min + 0:15 Übergabe
- Person 3: 4:45 min + 0:15 Übergabe
- Person 4: 4:30 min + 0:30 Abschluss
