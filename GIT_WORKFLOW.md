## Git-Workflow

Dieser Workflow ist bewusst einfach gehalten und passt zum Schulprojekt.

### Branching

- `main`: stabiler Integrationsstand
- Feature-Branches: `feature/<name>/<kurzbeschreibung>`

### Arbeiten am Feature

```bash
git checkout -b feature/<name>/<feature>
git add .
git commit -m "Feat: <kurzbeschreibung>"
git push -u origin HEAD
```

### Pull Request

- kurze Zusammenfassung
- kurzer Testplan
- Screenshots bei sichtbaren UI-Änderungen

### Konventionen

- keine unnötig gemischten Commits
- API-Änderung? Dann auch `docs/contracts.md` anpassen
- Doku-Änderung? Dann auf den tatsächlichen Produktstand unter `src1/` beziehen
