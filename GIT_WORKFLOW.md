## Git Workflow

Dieser Workflow ist bewusst einfach gehalten (Schulprojekt) und passt zu einem Repo mit `main` als Integrationsbranch.

### Branching

- `main`: stabiler Stand
- Feature branches: `feature/<name>/<kurzbeschreibung>`

### Arbeiten am Feature

```bash
git checkout -b feature/<name>/<feature>
git add .
git commit -m "Feat: <kurzbeschreibung>"
git push -u origin HEAD
```

### Pull Request (empfohlen)

- kurze Summary
- Testplan (was wurde geklickt/ausgeführt)
- Screenshots falls UI-Änderungen

### Konventionen

- Keine großen “Mixed” Commits (Code + Docs + Format in einem)
- API-Änderung? Dann auch `docs/contracts.md` anpassen.

