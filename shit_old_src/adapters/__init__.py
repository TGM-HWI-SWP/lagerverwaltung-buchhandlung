"""Adapters - Konkrete Implementierungen der Ports"""

from .repository import InMemoryRepository, RepositoryFactory
from .report import ConsoleReportAdapter

__all__ = ["InMemoryRepository", "RepositoryFactory", "ConsoleReportAdapter"]
