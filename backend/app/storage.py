"""Thin S3-compatible object storage wrapper (works with AWS S3 and MinIO)."""

import logging
from typing import BinaryIO

import boto3
from botocore.client import Config as BotoConfig

from app.config import settings

logger = logging.getLogger(__name__)


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.STORAGE_ENDPOINT or None,
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
    """Return a time-limited signed GET URL for the given key."""
    expires = ttl if ttl is not None else settings.SIGNED_URL_TTL_SECONDS
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.STORAGE_BUCKET, "Key": key},
        ExpiresIn=expires,
    )


def delete_object(key: str) -> None:
    _client().delete_object(Bucket=settings.STORAGE_BUCKET, Key=key)
    logger.info("Deleted object from storage: %s", key)
