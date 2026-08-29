from app.services import auth_service

BASE = "/api/v1/auth"


def test_register_success(client):
    resp = client.post(
        f"{BASE}/register",
        json={"email": "new@example.com", "password": "password123", "full_name": "New"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "new@example.com"
    assert body["plan"] == "free"
    assert "hashed_password" not in body


def test_register_duplicate_conflict(client, user):
    resp = client.post(
        f"{BASE}/register",
        json={"email": user.email, "password": "password123"},
    )
    assert resp.status_code == 409


def test_register_weak_password_422(client):
    resp = client.post(
        f"{BASE}/register",
        json={"email": "weak@example.com", "password": "short"},
    )
    assert resp.status_code == 422


def test_login_success(client, user):
    resp = client.post(
        f"{BASE}/login",
        data={"username": user.email, "password": "password123"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"] and body["refresh_token"]
    assert body["token_type"] == "bearer"


def test_login_bad_credentials_401(client, user):
    resp = client.post(
        f"{BASE}/login",
        data={"username": user.email, "password": "wrong-password"},
    )
    assert resp.status_code == 401


def test_refresh_rotation_and_old_token_rejected(client, user):
    login = client.post(
        f"{BASE}/login", data={"username": user.email, "password": "password123"}
    ).json()
    old_refresh = login["refresh_token"]

    rotated = client.post(f"{BASE}/refresh", json={"refresh_token": old_refresh})
    assert rotated.status_code == 200
    new_refresh = rotated.json()["refresh_token"]
    assert new_refresh != old_refresh

    reused = client.post(f"{BASE}/refresh", json={"refresh_token": old_refresh})
    assert reused.status_code == 401

    still_ok = client.post(f"{BASE}/refresh", json={"refresh_token": new_refresh})
    assert still_ok.status_code == 200


def test_logout_revokes_refresh_token(client, user):
    login = client.post(
        f"{BASE}/login", data={"username": user.email, "password": "password123"}
    ).json()
    refresh = login["refresh_token"]
    assert client.post(f"{BASE}/logout", json={"refresh_token": refresh}).status_code == 204
    assert client.post(f"{BASE}/refresh", json={"refresh_token": refresh}).status_code == 401


def test_forgot_and_reset_password_flow(client, db, user):
    resp = client.post(f"{BASE}/forgot-password", json={"email": user.email})
    assert resp.status_code == 202

    # unknown email still 202 (no user enumeration)
    assert (
        client.post(f"{BASE}/forgot-password", json={"email": "nobody@example.com"}).status_code
        == 202
    )

    token = auth_service.create_password_reset(db, user.email)
    assert token

    reset = client.post(
        f"{BASE}/reset-password",
        json={"token": token, "new_password": "brand-new-pass"},
    )
    assert reset.status_code == 200

    # token cannot be reused
    assert (
        client.post(
            f"{BASE}/reset-password",
            json={"token": token, "new_password": "another-pass"},
        ).status_code
        == 401
    )

    # old password rejected, new one works
    assert (
        client.post(
            f"{BASE}/login", data={"username": user.email, "password": "password123"}
        ).status_code
        == 401
    )
    assert (
        client.post(
            f"{BASE}/login", data={"username": user.email, "password": "brand-new-pass"}
        ).status_code
        == 200
    )


def test_me_requires_auth(client):
    assert client.get(f"{BASE}/me").status_code == 401


def test_me_rejects_bad_token(client):
    resp = client.get(f"{BASE}/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert resp.status_code == 401


def test_me_authorized(client, auth_headers, user):
    resp = client.get(f"{BASE}/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == user.email


def test_inactive_user_forbidden(client, db, user, auth_headers):
    user.is_active = False
    db.commit()
    resp = client.get(f"{BASE}/me", headers=auth_headers)
    assert resp.status_code in (401, 403)


def test_update_me(client, auth_headers):
    resp = client.put(f"{BASE}/me", json={"full_name": "Renamed Person"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Renamed Person"
