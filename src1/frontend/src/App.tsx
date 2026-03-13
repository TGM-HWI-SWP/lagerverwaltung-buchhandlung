import { BookList } from "./features/books/BookList";
import { InventoryOverview } from "./features/inventory/InventoryOverview";

// Grobe App-Shell: Header + zwei Hauptbereiche (Bücher, Lager).
export function App() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "1rem" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1>Buchhandlungsverwaltung</h1>
        <p>Grobe UI-Struktur für das Schulprojekt.</p>
      </header>

      <main style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "1fr 1fr" }}>
        <section>
          <h2>Bücher</h2>
          <BookList />
        </section>
        <section>
          <h2>Lagerbestand</h2>
          <InventoryOverview />
        </section>
      </main>
    </div>
  );
}

