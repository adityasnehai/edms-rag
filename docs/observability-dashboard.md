# EDMS Observability Dashboard

## Core Panels

### API Health
- Request rate
- 4xx rate
- 5xx rate
- Up/down status

### Latency
- p50, p95, p96 request latency by route
- Search latency
- Chat latency
- Ingestion stage latency

### Reliability
- Request rejections
- Auth failures
- Queue depth
- Ingestion success/failure rate

## PromQL

```promql
histogram_quantile(0.95, sum(rate(edms_http_request_latency_seconds_bucket[5m])) by (le, route, method))
histogram_quantile(0.96, sum(rate(edms_http_request_latency_seconds_bucket[5m])) by (le, route, method))
sum(rate(edms_http_responses_total{status_class="5xx"}[5m]))
sum(rate(edms_auth_failures_total[5m]))
sum(rate(edms_request_rejections_total[5m]))
edms_queue_depth{queue_name="ingestion"}
```

## Alert Targets

- p95 request latency > 1.5s
- p96 request latency > 2s
- 5xx error rate > 5%
- ingestion queue depth > 20
- auth failures spike
- request rejections spike
