from datetime import timedelta


def test_create_and_decode_token():
    from app.auth.jwt import create_token, decode_token
    token = create_token(subject="test-id", email="test@example.com")
    payload = decode_token(token)
    assert payload["sub"] == "test-id"
    assert payload["email"] == "test@example.com"


def test_expired_token_raises():
    from app.auth.jwt import create_token, decode_token
    from jose import JWTError
    token = create_token(
        subject="test-id",
        email="test@example.com",
        expires_delta=timedelta(seconds=-1),
    )
    import pytest
    with pytest.raises(JWTError):
        decode_token(token)


def test_invalid_token_raises():
    from app.auth.jwt import decode_token
    from jose import JWTError
    import pytest
    with pytest.raises(JWTError):
        decode_token("not.a.real.token")
