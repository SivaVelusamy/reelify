"""Shared slowapi rate limiter.

Routers import `limiter` and decorate endpoints, e.g.:

    from app.rate_limit import limiter

    @router.post("/login")
    @limiter.limit("5/minute")
    async def login(request: Request, ...):
        ...

app.main wires up the limiter state and the 429 exception handler.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
