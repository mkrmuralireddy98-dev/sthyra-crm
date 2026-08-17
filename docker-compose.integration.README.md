# Phase 1.b Integration Stack

Brings up Postgres + Redis + capture-service for end-to-end local testing.

```bash
docker-compose -f docker-compose.integration.yml up -d --build
curl http://localhost:9090/v1/health
docker-compose -f docker-compose.integration.yml down -v
```

Architecture:
```
capture-service (port 9090)
  ├── Postgres (auto-runs migrations)
  ├── Redis (IdempotencyStore)
  └── LocalFs (storage root: /var/lib/sthyra-crm/storage)
```

For S3, swap STHYRA_CRM_STORAGE=s3 and provide AWS_* env vars. For OTel, set OTEL_ENABLED=true.
