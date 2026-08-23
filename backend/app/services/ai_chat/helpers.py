from typing import Any


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    return float(value)
def _to_bool(value: Any) -> bool | None:
    if value is None:
        return None
    return bool(value)
def _round(value: float | None, digits: int = 3) -> float | None:
    if value is None:
        return None
    return round(value, digits)
