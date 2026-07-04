from __future__ import annotations

from uuid import uuid4

from fastapi import Request, Response


PUBLIC_GUEST_COOKIE_NAME = "koryxa_guest"


def get_guest_id(request: Request) -> str | None:
    return request.cookies.get(PUBLIC_GUEST_COOKIE_NAME)


def ensure_guest_id(request: Request, response: Response) -> str:
    guest_id = get_guest_id(request)
    if guest_id:
        return guest_id

    guest_id = f"guest_{uuid4().hex}"
    response.set_cookie(
        PUBLIC_GUEST_COOKIE_NAME,
        guest_id,
        max_age=60 * 60 * 24 * 30,
        httponly=True,
        samesite="lax",
        secure=request.url.scheme == "https",
        path="/",
    )
    return guest_id
