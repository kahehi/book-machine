# Golden Run 005: Concurrent Lock Test

**Projekt:** proj_golden_005
**Typ:** Concurrency-Test – Parallele Schreibzugriffe
**Erwartetes Ergebnis:** Kein Datenverlust, korrekte Serialisierung

## Testbeschreibung

Zwei Tasks versuchen gleichzeitig, manuscript.json zu schreiben.
LockManager soll sicherstellen, dass nur ein Task schreibt.
Der zweite Task muss warten bis der Lock freigegeben ist.

## Testschritte

1. Task A: Erwerbe Lock fuer manuscript.json (lease=10s)
2. Task B: Versuche Lock fuer manuscript.json zu erwerben -> wartet
3. Task A: Schreibe Daten, gib Lock frei
4. Task B: Erwerbe Lock, schreibe ueberschriebene Daten, gib Lock frei
5. Pruefe: Nur Task B Daten vorhanden (korrekte Reihenfolge)

## Assertions

- Kein simultanes Schreiben moeglich
- Kein LockError bei normalem Betrieb
- LockError bei Timeout (wenn Lock nie freigegeben)
- lock_N.json Dateien werden korrekt erstellt und geloescht
