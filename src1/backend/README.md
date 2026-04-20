# Backend

Das Backend basiert auf FastAPI und nutzt ein getrenntes Modell für Katalog, Lagerorte, Bestände und Historie.

## Produktive Tabellen

- `suppliers`
- `catalog_products`
- `product_prices`
- `warehouses`
- `stock_items`
- `stock_ledger_entries`
- `product_suppliers`
- `purchase_orders_v2`
- `purchase_order_v2_lines`
- `sales_orders`
- `sales_order_lines`
- `return_orders`
- `return_order_lines`
- `activity_logs`
- `audit_events`
- `staff_users`

## Start

```bash
uvicorn app.main:app --reload --port 8000
```

## Tests

```bash
python -m unittest -q tests.test_sqlite_schema
```
