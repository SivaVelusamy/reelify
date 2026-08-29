"""Thin S3-compatible object storage wrapper (works with AWS S3 and MinIO)."""

import logging
from typing import BinaryIO

import boto3
from botocore.client import Config as BotoConfig

from app.config import settings

logger = logging.getLogger(__name__)


def _client(endpoint: str | None = None):
    return boto3.client(
        "s3",
        endpoint_url=endpoint or settings.STORAGE_ENDPOINT or None,
        aws_access_key_id=settings.STORAGE_ACCESS_KEY,
        aws_secret_access_key=settings.STORAGE_SECRET_KEY,
        region_name=settings.STORAGE_REGION,
        config=BotoConfig(signature_version="s3v4"),
    )


def upload_fileobj(
    key: str, fileobj: BinaryIO, content_type: str = "application/octet-stream"
) -> str:
    """Upload a file-like object and return its storage key."""
    _client().upload_fileobj(
        fileobj,
        settings.STORAGE_BUCKET,
        key,
        ExtraArgs={"ContentType": content_type},
    )
    logger.info("Uploaded object to storage: %s", key)
    return key


def generate_presigned_url(key: str, ttl: int | None = None) -> str:
    """Return a time-limited signed GET URL the browser can fetch directly.

    Signed against STORAGE_PUBLIC_ENDPOINT when set (e.g. http://localhost:9000
    in local Docker), otherwise STORAGE_ENDPOINT.
    """
    expires = ttl if ttl is not None else settings.SIGNED_URL_TTL_SECONDS
    client = (
        _client(settings.STORAGE_PUBLIC_ENDPOINT)
        if settings.STORAGE_PUBLIC_ENDPOINT
        else _client()
    )
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.STORAGE_BUCKET, "Key": key},
        ExpiresIn=expires,
    )


def download_bytes(key: str) -> bytes:
    """Fetch an object's full contents into memory."""
    resp = _client().get_object(Bucket=settings.STORAGE_BUCKET, Key=key)
    return resp["Body"].read()


def download_to_path(key: str, dest_path: str) -> str:
    """Stream an object to a local file path and return that path."""
    _client().download_file(settings.STORAGE_BUCKET, key, dest_path)
    return dest_path


def upload_file(key: str, path: str, content_type: str = "application/octet-stream") -> str:
    """Upload a local file by path."""
    with open(path, "rb") as fh:
        return upload_fileobj(key, fh, content_type)


def object_size(key: str) -> int | None:
    """Return an object's size in bytes, or None if it does not exist."""
    from botocore.exceptions import ClientError

    try:
        head = _client().head_object(Bucket=settings.STORAGE_BUCKET, Key=key)
        return int(head["ContentLength"])
    except ClientError:
        return None


def object_exists(key: str) -> bool:
    return object_size(key) is not None


def delete_object(key: str) -> None:
    _client().delete_object(Bucket=settings.STORAGE_BUCKET, Key=key)
    logger.info("Deleted object from storage: %s", key)
