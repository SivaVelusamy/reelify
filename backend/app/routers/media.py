"""Same-origin media delivery — streams storage objects through the backend.

Public (the signed token is the credential). Used when MEDIA_DELIVERY="proxy".
"""

import logging

from botocore.exceptions import ClientError
from fastapi import APIRouter, Request, Response, status
from fastapi.responses import StreamingResponse

from app import storage
from app.exceptions import NotFoundError
from app.media_proxy import verify_media_token

logger = logging.getLogger(__name__)
router = APIRouter(tags=["media"])

_CHUNK = 256 * 1024


@router.get("/media/{token}")
def media_proxy(token: str, request: Request) -> Response:
    try:
        key = verify_media_token(token)
    except ValueError:
        raise NotFoundError("Media") from None

    range_header = request.headers.get("range")
    try:
        obj = storage.stream_object(key, range_header=range_header)
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code in ("NoSuchKey", "404"):
            raise NotFoundError("Media") from None
        if code in ("InvalidRange", "416"):
            return Response(status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE)
        logger.warning("media_proxy: storage error for %s: %s", key, code)
        raise NotFoundError("Media") from None

    body = obj["Body"]
    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(obj["ContentLength"]),
        "Cache-Control": "private, max-age=3600",
    }
    status_code = status.HTTP_200_OK
    if range_header and obj.get("ContentRange"):
        headers["Content-Range"] = obj["ContentRange"]
        status_code = status.HTTP_206_PARTIAL_CONTENT

    return StreamingResponse(
        body.iter_chunks(_CHUNK),
        status_code=status_code,
        media_type=obj.get("ContentType") or "application/octet-stream",
        headers=headers,
    )
