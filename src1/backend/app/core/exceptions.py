class ConflictError(ValueError):
    """Raised when an operation conflicts with current state (e.g., immutable records)."""
    pass
