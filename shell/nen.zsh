#!/usr/bin/env zsh
# nen.zsh - ZLE widget for inline ghost-text suggestions
#
# Architecture:
#   User types → nen-self-insert → _nen_fetch_suggestions (curl over UNIX socket)
#              → _nen_render_ghost_text (POSTDISPLAY)
#              → _nen_render_dropdown (zle -M, when open)
#
# Key bindings (active when ZLE is running):
#   →  / End   nen-accept-suggestion   accept ghost text
#   ↓          nen-next-suggestion     open dropdown / next
#   ↑          nen-prev-suggestion     prev suggestion
#   Esc        nen-dismiss             clear ghost text
#   BS / ^H    nen-backward-delete-char
#   printable  nen-self-insert

# ---------------------------------------------------------------------------
# Configuration (overridable before sourcing)
# ---------------------------------------------------------------------------

NEN_SOCKET="${NEN_SOCKET:-/tmp/nen.sock}"
NEN_TIMEOUT="${NEN_TIMEOUT:-0.1}"
NEN_MAX_SUGGESTIONS="${NEN_MAX_SUGGESTIONS:-5}"
NEN_GHOST_COLOR="${NEN_GHOST_COLOR:-240}"

# ---------------------------------------------------------------------------
# State variables
# ---------------------------------------------------------------------------

typeset -g NEN_GHOST_TEXT=""
typeset -g NEN_SUGGESTIONS=()
typeset -g NEN_SELECTED_IDX=0
typeset -g NEN_DROPDOWN_OPEN=0
typeset -g NEN_HAS_DANGER=0

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

function _nen_fetch_suggestions() {
  NEN_GHOST_TEXT=""
  NEN_SUGGESTIONS=()
  NEN_HAS_DANGER=0

  [[ -z "$BUFFER" ]] && return
  [[ ! -S "$NEN_SOCKET" ]] && return

  local parsed
  parsed=$(python3 - "$BUFFER" "$NEN_MAX_SUGGESTIONS" "$NEN_SOCKET" "$NEN_TIMEOUT" 2>/dev/null <<'PYEOF'
import json, sys, subprocess
buf, limit, socket, timeout = sys.argv[1], int(sys.argv[2]), sys.argv[3], float(sys.argv[4])
payload = json.dumps({"buffer": buf, "limit": limit})
try:
    r = subprocess.run(
        ["curl", "-sf", "--unix-socket", socket, "--max-time", str(timeout),
         "-X", "POST", "-H", "Content-Type: application/json",
         "-d", payload, "http://localhost/suggest"],
        capture_output=True, text=True, timeout=timeout + 0.1)
    d = json.loads(r.stdout)
    print("1" if d.get("hasDanger") else "0")
    for s in d.get("suggestions", []):
        print(s["text"])
except Exception:
    pass
PYEOF
) || return

  [[ -z "$parsed" ]] && return

  local lines=("${(@f)parsed}")
  NEN_HAS_DANGER="${lines[1]}"
  NEN_SUGGESTIONS=("${lines[@]:1}")
  (( ${#NEN_SUGGESTIONS[@]} > 0 )) && NEN_GHOST_TEXT="${NEN_SUGGESTIONS[1]}"
}

function _nen_render_ghost_text() {
  POSTDISPLAY=""
  [[ -z "$NEN_GHOST_TEXT" || -z "$BUFFER" ]] && return
  # Show only the suffix that extends beyond the current buffer
  if [[ "$NEN_GHOST_TEXT" == "$BUFFER"* ]]; then
    POSTDISPLAY="${NEN_GHOST_TEXT:${#BUFFER}}"
  fi
  # Danger warning via message line
  if [[ "$NEN_HAS_DANGER" == "1" ]]; then
    zle -M "[nen] Warning: dangerous command" 2>/dev/null || true
  fi
}

function _nen_render_dropdown() {
  if (( ${#NEN_SUGGESTIONS[@]} == 0 )); then
    zle -M "" 2>/dev/null || true
    return
  fi
  local msg="" i
  for (( i = 1; i <= ${#NEN_SUGGESTIONS[@]}; i++ )); do
    if (( i == NEN_SELECTED_IDX + 1 )); then
      msg+="▶ ${NEN_SUGGESTIONS[$i]}"$'\n'
    else
      msg+="  ${NEN_SUGGESTIONS[$i]}"$'\n'
    fi
  done
  zle -M "${msg%$'\n'}" 2>/dev/null || true
}

function _nen_clear_display() {
  POSTDISPLAY=""
  zle -M "" 2>/dev/null || true
}

function _nen_ensure_daemon() {
  [[ -S "$NEN_SOCKET" ]] && return
  if command -v nen &>/dev/null; then
    nohup nen &>/dev/null &!
  fi
}

# ---------------------------------------------------------------------------
# ZLE widgets
# ---------------------------------------------------------------------------

function nen-accept-suggestion() {
  if [[ -n "$NEN_GHOST_TEXT" && "$CURSOR" -eq "${#BUFFER}" ]]; then
    BUFFER="$NEN_GHOST_TEXT"
    CURSOR="${#BUFFER}"
    _nen_clear_display
    NEN_GHOST_TEXT=""
    NEN_SUGGESTIONS=()
    NEN_SELECTED_IDX=0
    NEN_DROPDOWN_OPEN=0
  else
    zle .forward-char 2>/dev/null || true
  fi
}

function nen-next-suggestion() {
  if (( ${#NEN_SUGGESTIONS[@]} == 0 )); then
    zle .down-line-or-history 2>/dev/null || true
    return
  fi
  NEN_DROPDOWN_OPEN=1
  (( NEN_SELECTED_IDX = (NEN_SELECTED_IDX + 1) % ${#NEN_SUGGESTIONS[@]} ))
  NEN_GHOST_TEXT="${NEN_SUGGESTIONS[$((NEN_SELECTED_IDX + 1))]}"
  _nen_render_ghost_text
  _nen_render_dropdown
}

function nen-prev-suggestion() {
  if (( ${#NEN_SUGGESTIONS[@]} == 0 )); then
    zle .up-line-or-history 2>/dev/null || true
    return
  fi
  NEN_DROPDOWN_OPEN=1
  (( NEN_SELECTED_IDX = (NEN_SELECTED_IDX - 1 + ${#NEN_SUGGESTIONS[@]}) % ${#NEN_SUGGESTIONS[@]} ))
  NEN_GHOST_TEXT="${NEN_SUGGESTIONS[$((NEN_SELECTED_IDX + 1))]}"
  _nen_render_ghost_text
  _nen_render_dropdown
}

function nen-dismiss() {
  _nen_clear_display
  NEN_GHOST_TEXT=""
  NEN_SUGGESTIONS=()
  NEN_SELECTED_IDX=0
  NEN_DROPDOWN_OPEN=0
  NEN_HAS_DANGER=0
}

function nen-self-insert() {
  zle .self-insert 2>/dev/null || true
  NEN_DROPDOWN_OPEN=0
  NEN_SELECTED_IDX=0
  _nen_fetch_suggestions
  _nen_render_ghost_text
}

function nen-backward-delete-char() {
  zle .backward-delete-char 2>/dev/null || true
  NEN_DROPDOWN_OPEN=0
  NEN_SELECTED_IDX=0
  _nen_fetch_suggestions
  _nen_render_ghost_text
}

function _nen_line_init() {
  NEN_GHOST_TEXT=""
  NEN_SUGGESTIONS=()
  NEN_SELECTED_IDX=0
  NEN_DROPDOWN_OPEN=0
  NEN_HAS_DANGER=0
  _nen_ensure_daemon
}

# ---------------------------------------------------------------------------
# ZLE registration and key bindings (no-op outside interactive ZLE context)
# ---------------------------------------------------------------------------

{
  autoload -Uz add-zle-hook-widget

  zle -N nen-accept-suggestion
  zle -N nen-next-suggestion
  zle -N nen-prev-suggestion
  zle -N nen-dismiss
  zle -N nen-self-insert
  zle -N nen-backward-delete-char
  zle -N _nen_line_init

  bindkey '^[[C'  nen-accept-suggestion    # →
  bindkey '^[OC'  nen-accept-suggestion    # → (alt sequences)
  bindkey '^[[B'  nen-next-suggestion      # ↓
  bindkey '^[[A'  nen-prev-suggestion      # ↑
  bindkey '^['    nen-dismiss              # Esc
  bindkey '^?'    nen-backward-delete-char # Backspace
  bindkey '^H'    nen-backward-delete-char # Backspace (alt)
  bindkey -M main ' '-'~' nen-self-insert  # All printable ASCII

  if (( $+functions[add-zle-hook-widget] )); then
    add-zle-hook-widget line-init _nen_line_init
  else
    zle -N zle-line-init _nen_line_init
  fi

  # Dim suffix highlight for ghost text
  zle_highlight+=(suffix:fg=240)
} 2>/dev/null || true
