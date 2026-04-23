# Changelog - Kaufmann

Persönliches Changelog für Kaufmann, Rolle: GUI-Designer

---

## [v0.1] - 2026-03-06

### Implementiert
- PSP Fertig Gestellt



### Commits
```
- 849f7cc0a524f406c3674a6bc3e09f017ee8e224: PSP-Fertig

```


---

## [v0.2] - 13.03.2026

### Implementiert
- Das Projekt Reorganisiert
- Erste Grundidee von der GUI

### Tests geschrieben
- kein Test

### Commits
```
- 811c606d4308071df0552f861c1890fb67de1f7c: reorganise via AI
- a4fcacd1ea3e3024d470f38f4da31a40dc8ca265: ertse GUI
```

### Mergekonflikt(e)
- Keine

---

## [v0.3] - 20.03.2026

### Implementiert
- Dark-Light Mode

### Tests geschrieben
- kein Test

### Commits
```
- da48ecb8e76306f9a3a6d0ff0300e283f8d2989f: dark-light mode
```

### Mergekonflikt(e)
- keine

---

## [v0.4] - 17.04.2026

### Implementiert
- sidebar & reload bug gefixed und Report A eingefügt
- Systemeinstellungen überarbeitet
- fürs erste die GUI fertiggestellt
- Bestellungs Tab hinzugefügt + Funktionen
- 3 neue tabs und grobe überarbeitungen

### Tests geschrieben
- keine

### Commits
```
- 289fc571a51d7cc40ea7c8438d8ebb94873ee88d: sidebar & reload bug gefixed
- 4259bea3dd474ceb57561072f2c1f2a3d071f6a4: ein paar sinnvolle einstellungen
- 578ca2fbadb9800bd99333a50cd9062937837525: Bestell Tab
- e9c6133b1d5e73849dd7c7c62df63f133bbbe9d4: 3 neue tabs und grobe überarbeitungen


```

### Mergekonflikt(e)
- keine

---

## [v0.5] - 

### Implementiert
- [Feature/Fix]

### Tests geschrieben
- [Tests]

### Commits
```
- [Commits]
```

### Mergekonflikt(e)
- [Konflikte]

---

## [v1.0] - [Datum]

### Implementiert
- [Feature/Fix]

### Tests geschrieben
- [Tests]

### Commits
```
- [Commits]
```

### Mergekonflikt(e)
- [Konflikte]

---

## Zusammenfassung

**Gesamt implementierte Features:** Komplette GUI und was dazu gehört, keine Ahnung wie viele ich genau gemacht hab
**Gesamt geschriebene Tests:** 1 Kompletten habe vergessen die immer hinzuzufügen  
**Gesamt Commits:** 22 
**Größte Herausforderung:** Modularisierung von den TSX files
**Schönste Code-Zeile:** 
const revenueData = useMemo(() => {
    const monthlyRevenue: { [key: string]: number } = {};
    salesLog
      .filter((entry) => entry.type === "Verkauf")
      .forEach((entry) => {
        const date = new Date(entry.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + entry.total;
      });
    return Object.entries(monthlyRevenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }));
  }, [salesLog]);

Die Umsatzanzeige war erfüllend

---

**Changelog erstellt von:** Tristan Kaufmann  
**Letzte Aktualisierung:** 22.04.2026
