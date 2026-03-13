// Zeigt grob eine Liste von Büchern an.
// Später soll diese Komponente Daten vom FastAPI-Backend laden.
export function BookList() {
  // TODO: via fetch/axios Daten von /books holen und anzeigen.
  return (
    <div>
      <p>Hier werden später alle Bücher aus dem Lager angezeigt.</p>
      <ul>
        <li>Beispiel-Buch 1</li>
        <li>Beispiel-Buch 2</li>
      </ul>
    </div>
  );
}

