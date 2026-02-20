#!/usr/bin/env zsh
# nen.zsh - ZLE widget for inline suggestions (fig/zsh-autosuggestions style)
#
# Architecture:
#   ┌─────────────────────────────────────────────────────────────┐
#   │  ZLE Widget (this file)                                      │
#   │                                                               │
#   │  nen-suggest-widget                                           │
#   │    └─ nen-fetch-suggestions  (curl --unix-socket, 100ms)      │
#   │         └─ /tmp/nen.sock  →  Deno daemon                      │
#   │                                                               │
#   │  nen-render-ghost-text    (after each keystroke)             │
#   │  nen-render-dropdown      (↓ key opens dropdown)             │
#   │  nen-accept-suggestion    (→ or End key)                     │
#   │  nen-next-suggestion      (↓ key in dropdown)                │
#   │  nen-prev-suggestion      (↑ key in dropdown)                │
#   │  nen-dismiss              (Esc key)                          │
#   │  nen-confirm              (Enter key)                        │
#   └─────────────────────────────────────────────────────────────┘
#
# TODO (Phase 8 - ZLE implementation):
#   1. Implement nen-fetch-suggestions using zpty or async subshell
#      - POST to /tmp/nen.sock via: curl -s --unix-socket /tmp/nen.sock \
#          --max-time 0.1 -X POST -d '{"buffer":"$BUFFER"}' http://localhost/suggest
#   2. Implement ghost text rendering (dim gray, non-destructive)
#      - Store suggestion in NEN_GHOST_TEXT
#      - Render after $BUFFER using ANSI escape sequences
#   3. Implement dropdown rendering with zle -M or custom region_highlight
#      - Show top-N suggestions below the prompt
#      - Highlight selected item
#   4. Implement danger warning display
#      - Show colored warning below ghost text for critical/high severity
#   5. Bind keys:
#      zle -N nen-accept-suggestion
#      zle -N nen-next-suggestion
#      zle -N nen-prev-suggestion
#      zle -N nen-dismiss
#      bindkey '^[[C' nen-accept-suggestion   # →
#      bindkey '^[OC' nen-accept-suggestion   # → (alt)
#      bindkey '^[[B' nen-next-suggestion     # ↓
#      bindkey '^[[A' nen-prev-suggestion     # ↑
#      bindkey '^[' nen-dismiss               # Esc
#   6. Hook into zle-line-init and zle-keymap-select
#   7. Start daemon if not running (lazy start)

# ---------------------------------------------------------------------------
# Configuration (overridable by user in .zshrc before sourcing this file)
# ---------------------------------------------------------------------------

NEN_SOCKET="${NEN_SOCKET:-/tmp/nen.sock}"
NEN_TIMEOUT="${NEN_TIMEOUT:-0.1}"       # curl timeout in seconds
NEN_MAX_SUGGESTIONS="${NEN_MAX_SUGGESTIONS:-5}"
NEN_GHOST_COLOR="${NEN_GHOST_COLOR:-240}"  # ANSI 256-color gray

# ---------------------------------------------------------------------------
# State variables
# ---------------------------------------------------------------------------

typeset -g NEN_GHOST_TEXT=""
typeset -g NEN_SUGGESTIONS=()
typeset -g NEN_SELECTED_IDX=0
typeset -g NEN_DROPDOWN_OPEN=0

# ---------------------------------------------------------------------------
# Widget stubs (to be implemented in Phase 8)
# ---------------------------------------------------------------------------

function _nen_fetch_suggestions() {
  # TODO: fetch suggestions from daemon via curl --unix-socket
  # Returns JSON to stdout; caller parses NEN_SUGGESTIONS array
  :
}

function _nen_render_ghost_text() {
  # TODO: display dim ghost text after BUFFER
  :
}

function _nen_render_dropdown() {
  # TODO: display suggestion dropdown below prompt
  :
}

function _nen_clear_display() {
  # TODO: erase ghost text and dropdown from terminal
  :
}

function nen-accept-suggestion() {
  # TODO: accept ghost text (append to BUFFER)
  zle self-insert
}

function nen-next-suggestion() {
  # TODO: move selection down in dropdown
  zle down-history
}

function nen-prev-suggestion() {
  # TODO: move selection up in dropdown
  zle up-history
}

function nen-dismiss() {
  # TODO: clear ghost text and dropdown, restore normal Esc behaviour
  _nen_clear_display
  NEN_GHOST_TEXT=""
  NEN_SUGGESTIONS=()
  NEN_DROPDOWN_OPEN=0
}

function nen-self-insert() {
  # TODO: hook called on every keystroke; fetch + render after insertion
  zle .self-insert
  _nen_fetch_suggestions
  _nen_render_ghost_text
}

# ---------------------------------------------------------------------------
# ZLE registration (active after Phase 8)
# ---------------------------------------------------------------------------

# zle -N nen-accept-suggestion
# zle -N nen-next-suggestion
# zle -N nen-prev-suggestion
# zle -N nen-dismiss
# zle -N nen-self-insert

# bindkey '^[[C'  nen-accept-suggestion
# bindkey '^[OC'  nen-accept-suggestion
# bindkey '^[[B'  nen-next-suggestion
# bindkey '^[[A'  nen-prev-suggestion
# bindkey '^['    nen-dismiss
# bindkey -M main ' '-']' nen-self-insert
