.PHONY: help openapi-sync

help:
	@echo "Targets disponibles:"
	@echo "  make openapi-sync   Regenera openapi.yaml y docs/openapi.yaml desde el backend activo"

openapi-sync:
	./scripts/sync_openapi.sh
