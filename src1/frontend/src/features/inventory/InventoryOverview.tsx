// Zeigt grob eine Übersicht des Lagerbestands an.
// Später sollen hier Bestände, Lagerorte etc. dargestellt werden.
export function InventoryOverview() {
  // TODO: via fetch/axios Daten von /inventory holen und anzeigen.
  return (
    <div>
      <p>Übersicht über den aktuellen Lagerbestand (Platzhalter).</p>
      <table>
        <thead>
          <tr>
            <th>Buch</th>
            <th>Menge</th>
            <th>Lagerort</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Beispiel-Buch 1</td>
            <td>10</td>
            <td>Regal A</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

