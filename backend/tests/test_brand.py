from app.models.brand import BrandKit

BASE = "/api/v1"


def _create_kit(client, headers, **overrides):
    payload = {"name": "Kit"}
    payload.update(overrides)
    return client.post(f"{BASE}/brand-kits", json=payload, headers=headers)


def test_brand_kit_crud(client, auth_headers):
    created = _create_kit(client, auth_headers, name="Main", primary_color="#ff0000")
    assert created.status_code == 201
    kid = created.json()["id"]
    assert created.json()["is_default"] is True  # first kit becomes default

    assert client.get(f"{BASE}/brand-kits/{kid}", headers=auth_headers).status_code == 200
    assert client.get(f"{BASE}/brand-kits", headers=auth_headers).json()[0]["id"] == kid

    updated = client.put(
        f"{BASE}/brand-kits/{kid}", json={"name": "Renamed"}, headers=auth_headers
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Renamed"

    assert client.delete(f"{BASE}/brand-kits/{kid}", headers=auth_headers).status_code == 204


def test_exactly_one_default_on_create(client, db, auth_headers):
    first = _create_kit(client, auth_headers, name="First").json()
    second = _create_kit(client, auth_headers, name="Second", is_default=True).json()

    assert second["is_default"] is True
    db.expire_all()
    kits = {k.id: k.is_default for k in db.query(BrandKit).all()}
    assert kits[first["id"]] is False
    assert kits[second["id"]] is True


def test_delete_default_promotes_another(client, db, auth_headers):
    first = _create_kit(client, auth_headers, name="First").json()
    second = _create_kit(client, auth_headers, name="Second").json()

    assert client.delete(f"{BASE}/brand-kits/{first['id']}", headers=auth_headers).status_code == 204
    db.expire_all()
    remaining = db.query(BrandKit).filter(BrandKit.id == second["id"]).one()
    assert remaining.is_default is True


def test_invalid_hex_color_422(client, auth_headers):
    resp = _create_kit(client, auth_headers, primary_color="not-a-hex")
    assert resp.status_code == 422


def test_caption_preset_crud_and_bare_list(client, auth_headers):
    created = client.post(
        f"{BASE}/caption-presets",
        json={"name": "Bold", "text_color": "#ffffff", "animation": "pop"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    pid = created.json()["id"]

    listed = client.get(f"{BASE}/caption-presets", headers=auth_headers)
    assert listed.status_code == 200
    assert [p["id"] for p in listed.json()] == [pid]

    updated = client.put(
        f"{BASE}/caption-presets/{pid}", json={"name": "Bolder"}, headers=auth_headers
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Bolder"

    assert (
        client.delete(f"{BASE}/caption-presets/{pid}", headers=auth_headers).status_code == 204
    )


def test_caption_preset_unowned_kit_404(client, auth_headers):
    resp = client.post(
        f"{BASE}/caption-presets",
        json={"name": "P", "brand_kit_id": 999999},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_brand_kit_ownership(client, auth_headers, other_headers):
    kid = _create_kit(client, auth_headers, name="Mine").json()["id"]
    assert client.get(f"{BASE}/brand-kits/{kid}", headers=other_headers).status_code == 404


def test_brand_kit_logo_upload(client, auth_headers):
    kid = _create_kit(client, auth_headers, name="WithLogo").json()["id"]
    resp = client.post(
        f"{BASE}/brand-kits/{kid}/logo",
        files={"file": ("logo.png", b"\x89PNG\r\n", "image/png")},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["logo_url"] is not None


def test_brand_kit_logo_rejects_non_image(client, auth_headers):
    kid = _create_kit(client, auth_headers, name="BadLogo").json()["id"]
    resp = client.post(
        f"{BASE}/brand-kits/{kid}/logo",
        files={"file": ("logo.txt", b"nope", "text/plain")},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_update_brand_kit_default_toggle(client, db, auth_headers):
    first = _create_kit(client, auth_headers, name="First").json()
    second = _create_kit(client, auth_headers, name="Second").json()
    assert first["is_default"] is True

    client.put(
        f"{BASE}/brand-kits/{second['id']}", json={"is_default": True}, headers=auth_headers
    )
    db.expire_all()
    kits = {k.id: k.is_default for k in db.query(BrandKit).all()}
    assert kits[first["id"]] is False and kits[second["id"]] is True


def test_caption_presets_filtered_by_kit(client, auth_headers):
    kid = _create_kit(client, auth_headers, name="K").json()["id"]
    client.post(
        f"{BASE}/caption-presets",
        json={"name": "linked", "brand_kit_id": kid},
        headers=auth_headers,
    )
    client.post(f"{BASE}/caption-presets", json={"name": "loose"}, headers=auth_headers)

    filtered = client.get(
        f"{BASE}/caption-presets", params={"brand_kit_id": kid}, headers=auth_headers
    )
    assert [p["name"] for p in filtered.json()] == ["linked"]
