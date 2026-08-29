"""Custom application exceptions.

All inherit from AppException and carry a message, machine-readable code, and HTTP status.
Registered with FastAPI exception handlers in app.main.
"""


class AppException(Exception):
    def __init__(self, message: str, code: str, status_code: int = 500):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


class NotFoundError(AppException):
    def __init__(self, resource: str = "Resource"):
        super().__init__(f"{resource} not found", "NOT_FOUND", 404)


class ConflictError(AppException):
    def __init__(self, message: str = "Resource conflict"):
        super().__init__(message, "CONFLICT", 409)


class UnauthorizedError(AppException):
    def __init__(self, message: str = "Not authenticated"):
        super().__init__(message, "UNAUTHORIZED", 401)


class ForbiddenError(AppException):
    def __init__(self, message: str = "Permission denied"):
        super().__init__(message, "FORBIDDEN", 403)


class PaymentRequiredError(AppException):
    def __init__(self, message: str = "Usage limit exceeded for current plan"):
        super().__init__(message, "PAYMENT_REQUIRED", 402)


class ValidationError(AppException):
    def __init__(self, message: str = "Validation failed"):
        super().__init__(message, "VALIDATION_ERROR", 422)
