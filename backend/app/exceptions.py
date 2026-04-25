"""
Shared exceptions for the CampusBook application.

Centralized exception definitions to avoid code duplication and tight coupling.
Service-specific exceptions should remain in their respective modules.
"""


class AppError(Exception):
    """Base exception for all application errors."""

    def __init__(self, message: str, code: str = "INTERNAL_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)


class DatabaseError(AppError):
    """Raised when database operations fail."""

    def __init__(self, message: str):
        super().__init__(message, "DATABASE_ERROR")


class CacheError(AppError):
    """Raised when Redis cache operations fail."""

    def __init__(self, message: str):
        super().__init__(message, "CACHE_ERROR")


class RepositoryError(AppError):
    """Raised when repository operations fail."""

    def __init__(self, message: str):
        super().__init__(message, "REPOSITORY_ERROR")