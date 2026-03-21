from datetime import timedelta

import pytest
from jose import JWTError

from app.auth.jwt import create_token, decode_token


def test_create_and_decode_token():
    token = create_token(subject="test-id", email="test@example.com")
    payload = decode_token(token)
    assert payload["sub"] == "test-id"
    assert payload["email"] == "test@example.com"


def test_expired_token_raises():
    token = create_token(
        subject="test-id",
        email="test@example.com",
        expires_delta=timedelta(seconds=-1),
    )
    with pytest.raises(JWTError):
        decode_token(token)


def test_invalid_token_raises():
    with pytest.raises(JWTError):
        decode_token("not.a.real.token")
