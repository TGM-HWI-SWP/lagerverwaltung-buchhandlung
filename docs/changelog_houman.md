# Changelog - [Houman]

Persönliches Changelog für [Houman], Rolle: [Businesslogic]

---

## [v0.1] - 2026-01-20

### Implementiert
- database 
- crud methods
- Datenbankmodell-Datei

### Tests geschrieben
- test_[name 1]
- test_[datenbank]

### Commits
```
- d4ec87ca2ce9ce2e29a86d28c409dca47bcc0841 Feat: [db.sql erschaffen]
- ec3a66c97ca07dbdfd909afec396e363c6934dfd Feat: [neue datenbank angeschafft]
- 12aafe047993a0082bb2cdb6f84862c2ea02969b Feat: [crud für inventory.py und books.py]
```

### Mergekonflikt(e)
- [Datei]: [Kurzbeschreibung und Lösung]

---

## [v0.2] - [27.03.2026]

### Implementiert
- main.py
- [Feature/Fix 2]

### Tests geschrieben
- 

### Commits
```
- 5747bbfdfa0180aeff598281ec52012f6d7e98d4 Feat: [main.py logic + kommentare]
- 0cef1d0a5aa034ac50318f79e6bcab5668cdcaab Feat: [Merge branch 'Businesslogic-Houman']
```

### Mergekonflikt(e)
- Keine

---

## [v0.3] - [17.04.2026]

### Implementiert
- supplier tabelle und lager des suppliers
- supplier stock bestellen und dass es ins movement tabelle geschrieben wird
- main update mit inventory und reports und supplier

### Tests geschrieben
- 

### Commits
```
- 535318268c2233923c05ad71dbea93952760acdd
- 1e914130ad917caeff298b6c30b850a95916dea4
- 551381df03a67b0d7038644f4c7f37835c7ca9e6
- d75617469bccbfb5f549544a07244dc712806061
```

### Mergekonflikt(e)
- 551381df03a67b0d7038644f4c7f37835c7ca9e6

---

## [v1.0] - [23.04.2026]

### Implementiert
- [Port&Adapter Prinzip updated]

### Tests geschrieben
- [Tests]

### Commits
```
- []
```

### Mergekonflikt(e)
- [Konflikte]



## Zusammenfassung

**Gesamt implementierte Features:** [8]  
**Gesamt geschriebene Tests:** [2]  
**Gesamt Commits:** [41]  
**Größte Herausforderung:** [Nach port & adapter Prinzip alles coden ]  
**Schönste Code-Zeile:** [

class UnitOfWork(Protocol):
    books: BookRepository
    movements: MovementRepository
    suppliers: SupplierRepository
    purchase_orders: PurchaseOrderRepository
    incoming_deliveries: IncomingDeliveryRepository
    book_supplier_links: BookSupplierLinkRepository

    def commit(self) -> None: ...

    def rollback(self) -> None: ...

    def flush(self) -> None: ...

Weil es alle Methoden der anderen Klassen in eine Klasse zusammenfasst, und die dann genutzt werden
]

---

**Changelog erstellt von:** [David Houman]  
**Letzte Aktualisierung:** [23.4.2026]
