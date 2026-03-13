"""Report Adapter - Report-Generierung"""

from typing import Dict

from ..ports import ReportPort


class ConsoleReportAdapter(ReportPort):
    """Report-Adapter für Konsolenausgabe"""

    def __init__(self, products: Dict = None, movements: list = None):
        self.products = products or {}
        self.movements = movements or []

    def generate_inventory_report(self) -> str:
        """
        Lagerbestandsbericht als Text generieren

        Returns:
            Formatierter Bericht
        """
        if not self.products:
            return "Lager ist leer.\n"

        report = "=" * 60 + "\n"
        report += "LAGERBESTANDSBERICHT\n"
        report += "=" * 60 + "\n\n"

        total_value = 0
        for product_id, product in self.products.items():
            value = product.get_total_value()
            total_value += value
            report += f"ID: {product_id}\n"
            report += f"  Name: {product.name}\n"
            report += f"  Kategorie: {product.category}\n"
            report += f"  Bestand: {product.quantity}\n"
            report += f"  Preis: {product.price:.2f} €\n"
            report += f"  Gesamtwert: {value:.2f} €\n\n"

        report += "-" * 60 + "\n"
        report += f"Gesamtwert Lager: {total_value:.2f} €\n"
        report += "=" * 60 + "\n"

        return report

    def generate_movement_report(self) -> str:
        """
        Bewegungsprotokoll als Text generieren

        Returns:
            Formatierter Bericht
        """
        if not self.movements:
            return "Keine Lagerbewegungen vorhanden.\n"

        report = "=" * 80 + "\n"
        report += "BEWEGUNGSPROTOKOLL\n"
        report += "=" * 80 + "\n\n"

        for movement in sorted(self.movements, key=lambda m: m.timestamp):
            report += f"[{movement.timestamp.strftime('%Y-%m-%d %H:%M:%S')}]\n"
            report += f"  Produkt: {movement.product_name} (ID: {movement.product_id})\n"
            report += f"  Typ: {movement.movement_type}\n"
            report += f"  Menge: {movement.quantity_change:+d}\n"
            if movement.reason:
                report += f"  Grund: {movement.reason}\n"
            report += f"  Durchgeführt von: {movement.performed_by}\n\n"

        report += "=" * 80 + "\n"
        report += f"Gesamtbewegungen: {len(self.movements)}\n"
        report += "=" * 80 + "\n"

        return report
