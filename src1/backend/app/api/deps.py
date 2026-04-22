from __future__ import annotations

from sqlalchemy.orm import Session

from app.adapters.sqlalchemy_repositories import SqlAlchemyUnitOfWork
from app.contracts.repositories import UnitOfWork
from app.services.books import BooksService
from app.services.inventory import InventoryService
from app.services.suppliers import SupplierService


def build_uow(db: Session) -> UnitOfWork:
    return SqlAlchemyUnitOfWork(db)


def books_service(db: Session) -> BooksService:
    return BooksService(build_uow(db))


def inventory_service(db: Session) -> InventoryService:
    return InventoryService(build_uow(db))


def supplier_service(db: Session) -> SupplierService:
    return SupplierService(build_uow(db))
