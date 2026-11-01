#!/usr/bin/env bash
# Local environment: ./local-env/env.sh up | seed | stop | down | status
set -euo pipefail

cd "$(dirname "$0")"
LOCAL_ENV_DIR="$PWD"
BACKEND_DIR="$(cd ../../distributed-scheduler && pwd)"
RUN_DIR="$LOCAL_ENV_DIR/.run"
DATABASE_DSN='scheduler:scheduler@tcp(localhost:3307)/scheduler?parseTime=true&loc=UTC&time_zone=%27%2B00%3A00%27'

mkdir -p "$RUN_DIR"

load_env() {
  node setup-env.mjs
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
}

wait_for() {
  local name="$1" url="$2"
  for _ in $(seq 1 60); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then
      echo "  $name ready"
      return 0
    fi
    sleep 1
  done
  echo "  $name did not start, see $RUN_DIR/$name.log" >&2
  return 1
}

stop_port() {
  lsof -ti "tcp:$1" -sTCP:LISTEN | xargs kill 2>/dev/null || true
}

start_databases() {
  echo '== databases'
  docker compose up -d --wait mysql cassandra
}

run_migrations() {
  echo '== migrations'
  docker compose --profile migrate run --rm migrate-tasks
  docker compose --profile migrate run --rm migrate-jobs
  docker compose exec -T cassandra cqlsh -f /migrations/keyspace.cql
  docker compose exec -T cassandra cqlsh -k scheduler -f /migrations/000001_create_job_history.up.cql
  docker compose exec -T cassandra cqlsh -k scheduler -f /migrations/000002_create_job_by_id.up.cql
}

start_service() {
  local name="$1" port="$2"
  stop_port "$port"
  (cd "$BACKEND_DIR/$name" && go build -o "$RUN_DIR/$name" ./cmd/api)
  # Variables set here win over the service's own .env.local.
  (
    cd "$BACKEND_DIR/$name"
    JWT_SECRET="$JWT_SECRET" DATABASE_DSN="$DATABASE_DSN" SERVER_ADDRESS=":$port" \
      nohup "$RUN_DIR/$name" >"$RUN_DIR/$name.log" 2>&1 &
  )
  wait_for "$name" "http://localhost:$port/health"
}

start_services() {
  echo '== services'
  start_service task-service 8080
  start_service job-service 8081
}

seed() {
  echo '== seed'
  node seed.mjs "$RUN_DIR"
  docker compose exec -T mysql mysql --default-character-set=utf8mb4 -uscheduler -pscheduler scheduler <"$RUN_DIR/seed-jobs.sql" 2>/dev/null
  docker compose exec -T cassandra cqlsh <"$RUN_DIR/seed-jobs.cql" >/dev/null
}

start_frontend() {
  echo '== frontend'
  stop_port 3000
  (cd .. && nohup npm run -s dev >"$RUN_DIR/frontend.log" 2>&1 &)
  wait_for frontend http://localhost:3000/login
}

case "${1:-}" in
  up)
    load_env
    start_databases
    run_migrations
    start_services
    seed
    start_frontend
    echo 'Dashboard: http://localhost:3000'
    ;;
  seed)
    load_env
    seed
    ;;
  stop)
    stop_port 3000
    stop_port 8080
    stop_port 8081
    docker compose stop
    ;;
  down)
    stop_port 3000
    stop_port 8080
    stop_port 8081
    docker compose --profile migrate down -v
    ;;
  status)
    docker compose ps --format 'table {{.Name}}\t{{.Status}}'
    for port in 3000 8080 8081; do
      lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null && echo "port $port listening" || echo "port $port DOWN"
    done
    ;;
  *)
    echo 'usage: env.sh up | seed | stop | down | status' >&2
    exit 1
    ;;
esac
