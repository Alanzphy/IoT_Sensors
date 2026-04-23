.PHONY: help openapi-sync demo-seed demo-seed-dry demo-live

help:
	@echo "Targets disponibles:"
	@echo "  make openapi-sync   Regenera openapi.yaml y docs/openapi.yaml desde el backend activo"
	@echo "  make demo-seed      Ejecuta seed_demo real para cuenta demo por defecto"
	@echo "  make demo-seed-dry  Ejecuta seed_demo en dry-run"
	@echo "  make demo-live      Ejecuta simulator_fast en --quick-demo"

openapi-sync:
	./scripts/sync_openapi.sh

demo-seed:
	cd backend && DEBUG=true uv run python -m app.db.seed_demo

demo-seed-dry:
	cd backend && DEBUG=true uv run python -m app.db.seed_demo --dry-run

demo-live:
	cd simulator && python3 simulator_fast.py --quick-demo
