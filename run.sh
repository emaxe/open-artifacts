#!/usr/bin/env bash
#
# Interactive build/run helper for Open Artifacts.
# Wraps the docker compose / pnpm commands already documented in README.md into one menu.
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DEV_DB_URL="postgres://postgres:postgres@localhost:5433/open_artifacts_dev"

# --- output helpers (printf only, no echo) ---------------------------------

bold()  { printf '\033[1m%s\033[0m' "$1"; }
info()  { printf '\n\033[36m▶ %s\033[0m\n' "$1"; }
ok()    { printf '\033[32m✓ %s\033[0m\n' "$1"; }
warn()  { printf '\033[33m! %s\033[0m\n' "$1"; }
fail()  { printf '\033[31m✗ %s\033[0m\n' "$1"; }

pause() {
  printf '\nНажмите Enter, чтобы вернуться в меню...'
  read -r _ || exit 0
}

# --- environment checks -----------------------------------------------------

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Не найдена команда '$1'. Установите её и запустите скрипт снова."
    exit 1
  fi
}

check_env_file() {
  if [ ! -f .env ]; then
    warn ".env не найден."
    printf 'Создать его из .env.example сейчас? [Y/n] '
    read -r reply || reply=n
    case "$reply" in
      n|N) fail "Без .env продакшн-режим работать не будет."; return 1 ;;
      *)
        cp .env.example .env
        ok "Создан .env — при желании отредактируйте SESSION_SECRET/SUPERADMIN_*/и т.д."
        ;;
    esac
  fi
  return 0
}

# --- production (docker compose) -------------------------------------------

prod_up() {
  info "Продакшн: сборка и запуск docker compose"
  check_env_file || return
  docker compose up -d --build
  if [ $? -eq 0 ]; then
    ok "Стек поднят. Открой http://localhost:3000"
  else
    fail "docker compose up завершился с ошибкой"
  fi
}

prod_down() {
  info "Продакшн: остановка docker compose"
  docker compose down
  ok "Остановлено"
}

prod_logs() {
  info "Логи контейнера app (Ctrl+C для выхода)"
  docker compose logs -f app
}

# --- dev environment ---------------------------------------------------------

dev_db_up() {
  info "Dev: поднимаю Postgres (docker-compose.dev.yml) на localhost:5433"
  docker compose -f docker-compose.dev.yml up -d < /dev/null

  printf 'Ждём готовности базы'
  for _ in $(seq 1 20); do
    if docker compose -f docker-compose.dev.yml exec -T db pg_isready -U postgres < /dev/null >/dev/null 2>&1; then
      printf '\n'
      break
    fi
    printf '.'
    sleep 1
  done

  info "Применяю схему через drizzle-kit push"
  # --force: auto-approve without an interactive prompt (this is the throwaway dev DB) — a script
  # driven from a pipe has no TTY to answer a confirmation, so without it push can hang forever.
  (cd apps/api && DATABASE_URL="$DEV_DB_URL" pnpm exec drizzle-kit push --config drizzle.config.ts --force < /dev/null)
  if [ $? -eq 0 ]; then
    ok "Dev-БД готова (postgres://localhost:5433/open_artifacts_dev)"
  else
    fail "Не удалось применить схему — смотри вывод выше"
  fi
}

dev_api() {
  info "Dev API (pnpm dev:api) — http://localhost:3000, Ctrl+C для остановки"
  warn "Убедитесь, что dev-БД уже поднята (пункт 4), иначе API не подключится"
  pnpm dev:api
}

dev_web() {
  info "Dev Web (pnpm dev:web) — http://localhost:5173, Ctrl+C для остановки"
  pnpm dev:web
}

# --- build / tests / deps ----------------------------------------------------

build_all() {
  info "Typecheck всего workspace"
  pnpm -r run typecheck || { fail "Typecheck не прошёл"; return; }
  ok "Typecheck чист"

  info "Сборка всех пакетов (pnpm run build)"
  pnpm run build || { fail "Сборка не прошла"; return; }
  ok "Сборка завершена"
}

install_deps() {
  info "Устанавливаю зависимости (pnpm install)"
  pnpm install && ok "Готово" || fail "pnpm install завершился с ошибкой"
}

run_unit_tests() {
  info "Unit-тесты (без БД)"
  pnpm -r run test
}

run_integration_tests() {
  info "Интеграционные тесты (нужна dev-БД — пункт 4, если ещё не поднята)"
  (cd apps/api && pnpm run test:integration)
}

run_e2e_tests() {
  info "E2E тест песочницы (Playwright, нужна dev-БД — пункт 4)"
  (cd apps/api && pnpm exec playwright install chromium >/dev/null 2>&1; pnpm run test:e2e)
}

tests_menu() {
  while true; do
    printf '\n'
    bold "Какие тесты запустить?"
    printf '\n'
    printf '  1) Unit\n'
    printf '  2) Интеграционные\n'
    printf '  3) E2E (sandbox security)\n'
    printf '  4) Все три\n'
    printf '  0) Назад\n'
    printf '\nВыбор: '
    read -r choice || exit 0
    case "$choice" in
      1) run_unit_tests; pause ;;
      2) run_integration_tests; pause ;;
      3) run_e2e_tests; pause ;;
      4) run_unit_tests; run_integration_tests; run_e2e_tests; pause ;;
      0) return ;;
      *) warn "Не понял выбор" ;;
    esac
  done
}

# --- main menu ---------------------------------------------------------------

print_header() {
  printf '\n'
  bold "Open Artifacts — сборка и запуск"
  printf '\n'
}

print_menu() {
  printf '\n'
  printf '  1) Продакшн: собрать и запустить (docker compose up -d --build)\n'
  printf '  2) Продакшн: остановить (docker compose down)\n'
  printf '  3) Продакшн: логи\n'
  printf '  4) Dev: поднять Postgres + применить схему\n'
  printf '  5) Dev: запустить API (foreground)\n'
  printf '  6) Dev: запустить Web (foreground)\n'
  printf '  7) Собрать проект (typecheck + build)\n'
  printf '  8) Тесты\n'
  printf '  9) Установить зависимости (pnpm install)\n'
  printf '  0) Выход\n'
}

main() {
  require_cmd docker
  require_cmd pnpm
  require_cmd node

  print_header

  while true; do
    print_menu
    printf '\nВыбор: '
    read -r choice || { printf '\nПока!\n'; exit 0; }
    case "$choice" in
      1) prod_up; pause ;;
      2) prod_down; pause ;;
      3) prod_logs ;;
      4) dev_db_up; pause ;;
      5) dev_api ;;
      6) dev_web ;;
      7) build_all; pause ;;
      8) tests_menu ;;
      9) install_deps; pause ;;
      0) printf '\nПока!\n'; exit 0 ;;
      *) warn "Не понял выбор — введите номер пункта" ;;
    esac
  done
}

main
