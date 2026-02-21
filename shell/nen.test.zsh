#!/usr/bin/env zsh
# nen.test.zsh - Unit tests for shell/nen.zsh (run outside ZLE context)

source "${0:h}/nen.zsh" 2>/dev/null || { echo "FAIL: source failed"; exit 1; }

typeset -i failures=0
pass() { print -P "%F{green}PASS%f: $1"; }
fail() { print -P "%F{red}FAIL%f: $1"; (( failures++ )); }

# ---------------------------------------------------------------------------
# 1. Function definition checks
# ---------------------------------------------------------------------------

for fn in _nen_fetch_suggestions _nen_render_ghost_text _nen_render_dropdown \
          _nen_clear_display nen-accept-suggestion nen-next-suggestion \
          nen-prev-suggestion nen-dismiss nen-self-insert nen-backward-delete-char \
          _nen_ensure_daemon _nen_line_init; do
  (( $+functions[$fn] )) && pass "$fn defined" || fail "$fn not defined"
done

# ---------------------------------------------------------------------------
# 2. Empty BUFFER → suggestions remain empty (early return)
# ---------------------------------------------------------------------------

BUFFER="" NEN_SOCKET="/tmp/_nen_nonexistent.sock"
NEN_GHOST_TEXT="" NEN_SUGGESTIONS=() NEN_HAS_DANGER=0
_nen_fetch_suggestions
[[ -z "$NEN_GHOST_TEXT" ]] \
  && pass "empty BUFFER: ghost text empty" \
  || fail "empty BUFFER: ghost text not empty (got: '$NEN_GHOST_TEXT')"
(( ${#NEN_SUGGESTIONS[@]} == 0 )) \
  && pass "empty BUFFER: suggestions empty" \
  || fail "empty BUFFER: suggestions not empty (got: ${#NEN_SUGGESTIONS[@]})"

# ---------------------------------------------------------------------------
# 3. Missing socket → suggestions remain empty
# ---------------------------------------------------------------------------

BUFFER="git"
NEN_GHOST_TEXT="" NEN_SUGGESTIONS=()
_nen_fetch_suggestions
[[ -z "$NEN_GHOST_TEXT" ]] \
  && pass "missing socket: ghost text empty" \
  || fail "missing socket: ghost text not empty (got: '$NEN_GHOST_TEXT')"
(( ${#NEN_SUGGESTIONS[@]} == 0 )) \
  && pass "missing socket: suggestions empty" \
  || fail "missing socket: suggestions not empty"

# ---------------------------------------------------------------------------
# 4. nen-dismiss → all state cleared
# ---------------------------------------------------------------------------

NEN_GHOST_TEXT="git status"
NEN_SUGGESTIONS=("git status" "git log")
NEN_DROPDOWN_OPEN=1
NEN_SELECTED_IDX=2
NEN_HAS_DANGER=1
nen-dismiss
[[ -z "$NEN_GHOST_TEXT" ]] \
  && pass "dismiss: ghost text cleared" \
  || fail "dismiss: ghost text not cleared (got: '$NEN_GHOST_TEXT')"
(( ${#NEN_SUGGESTIONS[@]} == 0 )) \
  && pass "dismiss: suggestions cleared" \
  || fail "dismiss: suggestions not cleared (${#NEN_SUGGESTIONS[@]} remain)"
(( NEN_DROPDOWN_OPEN == 0 )) \
  && pass "dismiss: dropdown closed" \
  || fail "dismiss: dropdown not closed (NEN_DROPDOWN_OPEN=$NEN_DROPDOWN_OPEN)"
(( NEN_SELECTED_IDX == 0 )) \
  && pass "dismiss: selected index reset" \
  || fail "dismiss: selected index not reset (NEN_SELECTED_IDX=$NEN_SELECTED_IDX)"
(( NEN_HAS_DANGER == 0 )) \
  && pass "dismiss: has_danger cleared" \
  || fail "dismiss: has_danger not cleared (NEN_HAS_DANGER=$NEN_HAS_DANGER)"

# ---------------------------------------------------------------------------
# 5. NEN_SOCKET config variable exists with default
# ---------------------------------------------------------------------------

[[ -n "$NEN_SOCKET" ]] \
  && pass "NEN_SOCKET has a default value" \
  || fail "NEN_SOCKET is empty"

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

if (( failures == 0 )); then
  print -P "\n%F{green}All tests passed.%f"
else
  print -P "\n%F{red}$failures test(s) failed.%f"
fi
exit $failures
