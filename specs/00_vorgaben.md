### 1. Anforderungen an die Anwendung (Das Spiel)

Die Anwendung muss ein klassisches Brettspiel als Computerspiel umsetzen.

#### **Must-Haves (Zwingend erforderlich)**
*   **Plattform:** Umsetzung als **Desktop-PC Anwendung**.
*   **Grafik:** Eine **graphische 2D-Oberfläche**.
*   **Multiplayer:** Ein **lokaler Multiplayer-Modus („Hot-Seat“)**, bei dem sich die Spieler an Maus und Tastatur abwechseln.
*   **Regelwerk:** Es darf nur die Durchführung von **regelkonformen Spielzügen** zugelassen werden.
*   **KI:** Ein **einfacher, zufallsbasierter Computergegner** muss enthalten sein.
*   **Spielumfang:** Es soll (zunächst) nur das **Basisspiel** umgesetzt werden.

#### **Zusatzleistungen (Wahlpflicht)**
Sie müssen **mindestens zwei** der folgenden Erweiterungen wählen:
1.  Zusätzliche Version für **Android**.
2.  Graphische **3D-Oberfläche**.
3.  **Netzwerk-Multiplayer** (zusätzlich zum lokalen Modus).
4.  Anzeige des **nächsten empfohlenen Zuges** (Tipp-Funktion).
5.  Zusätzlich ein **„guter“ Computergegner** (neben dem einfachen).
6.  Inhaltliche **Erweiterungen** zum Basisspiel.
7.  Eigene, mit dem Dozenten abgestimmte Verbesserungsvorschläge.

---

### 2. Anforderungen an das Projektmanagement

Der Dozent agiert in diesem Projekt als Ihr **Auftraggeber, Kunde und Stakeholder**.

#### **Teamarbeit und Organisation**
*   **Gruppengröße:** 3 bis 6 Studierende (mindestens 3).
*   **Selbstorganisation:** Die Gruppe muss sich selbst organisieren; bei Problemen ist der Dozent hinzuzuziehen.
*   **Aufgabenverteilung:** Die Implementierung muss auf **alle Gruppenmitglieder** aufgeteilt werden.

#### **Projektablauf und Phasen**
Das Projekt muss den **gesamten Zyklus der Anwendungsentwicklung** durchlaufen:
1.  **Vorgehensweise:** Wahl zwischen klassischem (z. B. Wasserfall) oder agilem Modell (z. B. Scrum) inklusive entsprechender Planung.
2.  **Anforderungsaufnahme:** Systematische Analyse der Anforderungen (Requirement Management).
3.  **Spezifikation:** Erstellung eines **Lasten- und Pflichtenhefts** (klassisch) oder von **Epics und User Stories** (agil).
4.  **QS-Management:** Planung der Qualitätssicherung inklusive Teststrategien.
5.  **Design & Architektur:** Strukturierter Entwurf, beispielsweise unter Verwendung von **UML**.
6.  **User Interface:** Gestaltung der Bedienoberfläche.
7.  **Implementierung:** Programmierung unter Einsatz von **Versionierung** (z. B. Git).
8.  **Dokumentation:** Umfassende Dokumentation des gesamten Projekts inklusive der **Begründung für getroffene Entscheidungen**.
9.  **Rollout:** Vorführung und Präsentation des Ergebnisses.

#### **Kommunikation und Berichterstattung**
*   **Stakeholder-Updates:** Es werden **mindestens 4 Termine** für regelmäßige Updates an den Stakeholder (Dozenten) erwartet.
*   **Berichte:** Informationspflicht nach oben; Berichte sollten präzise, sachlich und ähnlich wie eine wissenschaftliche Arbeit verfasst sein (Zusammenfassung des Fortschritts, Probleme, Alternativen).
*   **Präzision:** Alles muss explizit aufgeschrieben werden (**„Make the implicit, explicit!“**); verlassen Sie sich nicht auf implizites Wissen.

---

### 3. Qualitätssicherung und Technik

Die Qualitätssicherung umfasst die **Validierung** (Wünsche des Kunden erfüllt?) und die **Verifikation** (Spezifikation korrekt umgesetzt?).

#### **Konstruktive Maßnahmen**
*   Einsatz geeigneter Methoden für Anforderungen und Entwurf.
*   Anwendung **strukturierter Programmierung** und Nutzung höherer Programmiersprachen.
*   **Transparente Dokumentation**.
*   **Wartbarkeit:** Der Code darf nicht „hardgecodet“ sein; Daten und Programme müssen getrennt werden (datengesteuertes Arbeiten), um Erweiterbarkeit zu garantieren.

#### **Analytische Maßnahmen (Metriken)**
Es sollen Metriken zur Beurteilung der Code-Qualität herangezogen werden:
*   **Lines of Code (LoC):** Vermeidung von zu großen Klassen/Funktionen.
*   **McCabe-Zahl:** Maß für die Komplexität (sollte **unter 15** liegen).
*   **Halstead-Metrik:** Zur Schätzung der potenziellen Fehlerzahl.
*   **Überdeckungsmetriken:** Erreichen einer hohen Anweisungs- (C0) und Zweigüberdeckung (C1) durch Testfälle.

#### **Testverfahren**
*   Durchführung von **Unit Tests, Systemtests und Integrationstests**.
*   **TDD (Test-Driven Development):** Es wird empfohlen, erst Tests und dann den eigentlichen Programmcode zu schreiben.
*   **Unabhängigkeit:** Entwickler sollten idealerweise nicht ihren eigenen Code testen.

---

### 4. Formale Anforderungen und Bewertung

*   **Dokumentationsinhalt:** Muss mindestens den Rahmen, die Ziele, Anforderungen, eine Startanleitung für das Programm sowie einen Leitfaden für den Code-Einstieg enthalten.
*   **Prüfungsleistung:** Die Gesamtnote setzt sich zu **jeweils 50 % aus der Dokumentation und der Präsentation** zusammen.
*   **Präsentation:** Findet am letzten Vorlesungstermin statt und dauert ca. **20 bis 45 Minuten** (je nach Gruppengröße).
*   **Bewertungsgrundlage:** In der Regel wird die Teamleistung bewertet; eine individuelle Benotung ist im Bedarfsfall möglich.
*   **Rollout:** Am Ende müssen die Dokumentation und der Quellcode abgegeben werden.