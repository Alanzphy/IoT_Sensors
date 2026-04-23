from __future__ import annotations

import argparse
import json
from types import SimpleNamespace

from app.db.demo_seed import DEFAULT_DAYS, DEFAULT_SEED, cmd_run_all
from app.db.seed import PRIMARY_TEST_CLIENT_EMAIL, seed as base_seed
from app.db.session import SessionLocal


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Bootstrap completo de demo local: seed base + run-all de demo_seed."
        )
    )
    parser.add_argument(
        "--client-email",
        default=PRIMARY_TEST_CLIENT_EMAIL,
        help=f"Cliente objetivo para dataset demo (default: {PRIMARY_TEST_CLIENT_EMAIL})",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=DEFAULT_DAYS,
        help=f"Ventana historica en dias (default: {DEFAULT_DAYS})",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_SEED,
        help=f"Semilla deterministica (default: {DEFAULT_SEED})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="No modifica BD; solo muestra lo que haria",
    )
    parser.add_argument(
        "--snapshot-dir",
        default="demo_seed_snapshots",
        help="Directorio para snapshots JSON",
    )
    parser.add_argument(
        "--skip-base-seed",
        action="store_true",
        help="Omite app.db.seed (util si ya tienes usuarios/areas/nodos creados)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not args.skip_base_seed:
        base_seed()

    runtime_args = SimpleNamespace(
        client_email=args.client_email,
        days=args.days,
        seed=args.seed,
        dry_run=args.dry_run,
        snapshot_dir=args.snapshot_dir,
        batch_size=1000,
        command="run-all",
    )

    with SessionLocal() as db:
        try:
            result = cmd_run_all(db, runtime_args)
        except Exception:
            db.rollback()
            raise

    print(json.dumps(result, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
