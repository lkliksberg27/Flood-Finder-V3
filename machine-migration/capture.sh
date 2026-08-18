#!/usr/bin/env bash
# capture.sh - Snapshot a Claude Code-managed macOS/Linux dev machine.
#
# Captures everything needed to rebuild this machine on new hardware: OS,
# package manifests, language toolchains with pinned versions, Claude Code
# configuration, MCP server definitions, every git repo with its remote/
# branch/dirty state, dotfiles, and GUI applications.
#
# SECRETS: never writes secret VALUES. Env vars are recorded by NAME only,
# JSON is scrubbed of credential-bearing keys, private keys are never copied.
#
# Usage: ./capture.sh [output-dir] [repo-scan-root]

set -uo pipefail

OUT="${1:-$PWD/machine-snapshot}"
SCAN_ROOT="${2:-$HOME}"   # where to hunt for git repos
M="$OUT/manifest"
SECRET_RE='(?i)(token|key|secret|password|passwd|credential|auth|apikey|bearer|session|cookie|private|signature|salt)'

mkdir -p "$M"

have() { command -v "$1" >/dev/null 2>&1; }

# grab <file> <command...> - run a command, save stdout+stderr, never fail the script
grab() {
  local dest="$1"; shift
  mkdir -p "$(dirname "$dest")"
  printf '  -> %s\n' "$(basename "$dest")"
  { "$@" ; } >"$dest" 2>&1 || echo "(command failed or not present)" >>"$dest"
}

# Recursively redact credential-bearing values from a JSON file.
scrub_json() {
  local src="$1" dest="$2"
  [ -f "$src" ] || return 0
  mkdir -p "$(dirname "$dest")"
  if have python3; then
    python3 - "$src" "$dest" <<'PY'
import json, re, sys
SECRET = re.compile(r'(token|key|secret|password|passwd|credential|auth|apikey|bearer|session|cookie|private|signature|salt)', re.I)
INLINE = re.compile(r'^(sk-|ghp_|gho_|github_pat_|xox[baprs]-|AKIA|ya29\.)')

def clean(node, keyname=''):
    if isinstance(node, dict):
        return {k: clean(v, k) for k, v in node.items()}
    if isinstance(node, list):
        return [clean(v, keyname) for v in node]
    if isinstance(node, str) and node:
        if SECRET.search(keyname):
            return f'<REDACTED:{keyname} - restore this value by hand>'
        if INLINE.match(node):
            return '<REDACTED:inline-credential - restore this value by hand>'
    return node

try:
    with open(sys.argv[1]) as f:
        data = json.load(f)
    with open(sys.argv[2], 'w') as f:
        json.dump(clean(data), f, indent=2)
except Exception as e:
    with open(sys.argv[2], 'w') as f:
        f.write(f'SCRUB FAILED: {e}\n')
PY
  else
    echo "python3 unavailable - $src NOT copied (would risk leaking secrets)" >"$dest"
  fi
}

printf '\nCapturing machine snapshot -> %s\n\n' "$OUT"

# ------------------------------------------------------------- 1. System
echo "[1/9] System"
{
  echo "# System"
  echo
  echo "| Field | Value |"
  echo "|---|---|"
  echo "| Captured (UTC) | $(date -u '+%Y-%m-%d %H:%M:%S UTC') |"
  echo "| Hostname | $(hostname) |"
  echo "| Kernel | $(uname -srm) |"
  if [ "$(uname -s)" = "Darwin" ]; then
    echo "| macOS | $(sw_vers -productVersion) ($(sw_vers -buildVersion)) |"
    echo "| Chip | $(sysctl -n machdep.cpu.brand_string 2>/dev/null) |"
    echo "| Cores | $(sysctl -n hw.ncpu 2>/dev/null) |"
    echo "| RAM | $(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1073741824 )) GB |"
  else
    echo "| Distro | $(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME") |"
    echo "| CPU | $(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2- | xargs) |"
    echo "| Cores | $(nproc 2>/dev/null) |"
    echo "| RAM | $(awk '/MemTotal/{printf "%.1f GB", $2/1048576}' /proc/meminfo 2>/dev/null) |"
  fi
  echo "| Shell | $SHELL |"
  echo "| Home | $HOME |"
} >"$M/system.md"

grab "$M/disks.txt" df -h

# ---------------------------------------------------------- 2. Packages
echo "[2/9] Package managers"
P="$M/packages"; mkdir -p "$P"
if have brew; then
  echo "  -> brew bundle dump (this is the important one)"
  brew bundle dump --file="$P/Brewfile" --force --describe >/dev/null 2>&1 \
    || brew list --formula >"$P/brew-formulae.txt" 2>&1
  grab "$P/brew-casks.txt" brew list --cask
fi
have apt-mark   && grab "$P/apt-manual.txt"   apt-mark showmanual
have dpkg       && grab "$P/dpkg.txt"         dpkg -l
have dnf        && grab "$P/dnf.txt"          dnf list installed
have pacman     && grab "$P/pacman.txt"       pacman -Qe
have snap       && grab "$P/snap.txt"         snap list
have flatpak    && grab "$P/flatpak.txt"      flatpak list --app

# -------------------------------------------------------- 3. Toolchains
echo "[3/9] Language toolchains"
T="$M/toolchains"; mkdir -p "$T"
have python3 && { grab "$T/python-version.txt" python3 --version; grab "$T/pip-freeze.txt" python3 -m pip freeze; }
have pyenv   && grab "$T/pyenv.txt"      pyenv versions
have uv      && grab "$T/uv-tools.txt"   uv tool list
have pipx    && grab "$T/pipx.txt"       pipx list
have conda   && grab "$T/conda-envs.txt" conda env list
have poetry  && grab "$T/poetry.txt"     poetry --version
if have node; then
  { node --version; npm --version; } >"$T/node-version.txt" 2>&1
  grab "$T/npm-global.txt" npm ls -g --depth=0
fi
have pnpm    && grab "$T/pnpm.txt"    pnpm ls -g --depth=0
have yarn    && grab "$T/yarn.txt"    yarn global list
have rustup  && grab "$T/rustup.txt"  rustup toolchain list
have cargo   && grab "$T/cargo.txt"   cargo install --list
have go      && grab "$T/go.txt"      go version
have dotnet  && grab "$T/dotnet.txt"  dotnet --list-sdks
have java    && grab "$T/java.txt"    java -version
have mise    && grab "$T/mise.txt"    mise ls
have asdf    && grab "$T/asdf.txt"    asdf current
have git     && grab "$T/git-version.txt" git --version
have docker  && grab "$T/docker.txt"  docker image ls

# ------------------------------------------------------- 4. Claude Code
echo "[4/9] Claude Code configuration"
C="$M/claude"; mkdir -p "$C"
CLAUDE_HOME="$HOME/.claude"

if [ -d "$CLAUDE_HOME" ]; then
  # Copy the config tree, excluding transcripts, caches and key-shaped files.
  if have rsync; then
    rsync -a \
      --exclude 'projects/' --exclude 'todos/' --exclude 'statsig/' \
      --exclude 'shell-snapshots/' --exclude 'history/' --exclude 'downloads/' \
      --exclude 'skills/synced/' --exclude 'plugins/cache/' --exclude 'plugins/repos/' \
      --exclude '.git/' --exclude 'node_modules/' --exclude '__pycache__/' \
      --exclude '*.key' --exclude '*.pem' --exclude '*.p12' --exclude '*.pfx' \
      --exclude '.credentials.json' \
      "$CLAUDE_HOME/" "$C/dot-claude/" 2>/dev/null
  else
    mkdir -p "$C/dot-claude"
    for item in settings.json CLAUDE.md agents commands skills plugins hooks keybindings.json; do
      [ -e "$CLAUDE_HOME/$item" ] && cp -R "$CLAUDE_HOME/$item" "$C/dot-claude/" 2>/dev/null
    done
  fi
  # Anthropic-managed content re-syncs on its own; carrying it costs megabytes
  # and can shadow newer upstream versions on the new machine. Drop it either way.
  rm -rf "$C/dot-claude/skills/synced" "$C/dot-claude/plugins/cache" "$C/dot-claude/plugins/repos" 2>/dev/null
  # settings.json can hold env vars with secrets -> overwrite the copy with a scrubbed one.
  scrub_json "$CLAUDE_HOME/settings.json" "$C/dot-claude/settings.json"

  find "$CLAUDE_HOME" -type f \
    -not -path '*/projects/*' -not -path '*/todos/*' -not -path '*/statsig/*' \
    -not -path '*/shell-snapshots/*' -not -path '*/history/*' \
    -not -path '*/skills/synced/*' -not -path '*/plugins/cache/*' 2>/dev/null \
    | sed "s|$HOME|~|" | sort >"$C/tree.txt"
else
  echo "No ~/.claude directory found at $CLAUDE_HOME" >"$C/NOT-FOUND.txt"
fi

# ~/.claude.json holds project history AND MCP server definitions AND tokens.
if [ -f "$HOME/.claude.json" ] && have python3; then
  echo "  -> extracting MCP servers from ~/.claude.json"
  python3 - "$HOME/.claude.json" "$C/claude-json-extract.json" <<'PY'
import json, re, sys
SECRET = re.compile(r'(token|key|secret|password|passwd|credential|auth|apikey|bearer|session|cookie|private)', re.I)

def clean(node, keyname=''):
    if isinstance(node, dict):
        return {k: clean(v, k) for k, v in node.items()}
    if isinstance(node, list):
        return [clean(v, keyname) for v in node]
    if isinstance(node, str) and node and SECRET.search(keyname):
        return f'<REDACTED:{keyname} - restore this value by hand>'
    return node

try:
    with open(sys.argv[1]) as f:
        data = json.load(f)
    projects = data.get('projects', {}) or {}
    out = {
        'mcpServers': clean(data.get('mcpServers', {}), 'mcpServers'),
        'projectPaths': sorted(projects.keys()),
        'perProjectMcp': {
            p: clean(v.get('mcpServers'), 'mcpServers')
            for p, v in projects.items()
            if isinstance(v, dict) and v.get('mcpServers')
        },
    }
    with open(sys.argv[2], 'w') as f:
        json.dump(out, f, indent=2)
except Exception as e:
    with open(sys.argv[2], 'w') as f:
        f.write(f'EXTRACT FAILED: {e}\n')
PY
fi

if have claude; then
  grab "$C/version.txt"  claude --version
  grab "$C/mcp-list.txt" claude mcp list
fi

# ---------------------------------------------------------- 5. Dotfiles
echo "[5/9] Dotfiles and shell config"
D="$M/dotfiles"; mkdir -p "$D"
for f in .gitconfig .gitignore_global .zshrc .zprofile .zshenv .bashrc .bash_profile \
         .profile .inputrc .tmux.conf .vimrc .condarc .curlrc .editorconfig; do
  [ -f "$HOME/$f" ] && cp "$HOME/$f" "$D/$f" 2>/dev/null
done
# .npmrc routinely contains registry auth tokens.
if [ -f "$HOME/.npmrc" ]; then
  sed -E 's/(_auth(Token)?|_password)[[:space:]]*=.*/\1=<REDACTED - restore by hand>/I' \
    "$HOME/.npmrc" >"$D/.npmrc"
fi
[ -f "$HOME/.ssh/config" ] && cp "$HOME/.ssh/config" "$D/ssh-config" 2>/dev/null
{
  echo "Public keys present on this machine (PRIVATE KEYS ARE NOT COPIED - move them by hand):"
  ls -1 "$HOME/.ssh/"*.pub 2>/dev/null | sed 's|.*/|  |' || echo "  (none found)"
} >"$D/ssh-key-inventory.txt"
have code && grab "$D/vscode-extensions.txt" code --list-extensions
[ -d "$HOME/.config" ] && ls -1 "$HOME/.config" >"$D/config-dir-listing.txt" 2>/dev/null

# ------------------------------------------------- 6. Environment (names)
echo "[6/9] Environment variables (names only)"
env | sort | while IFS='=' read -r name value; do
  case "$name" in
    PATH) echo "PATH = (see path.txt)" ;;
    *[Tt]oken*|*TOKEN*|*[Kk]ey*|*KEY*|*[Ss]ecret*|*SECRET*|*PASSWORD*|*[Pp]assword*|*AUTH*|*CREDENTIAL*)
      echo "$name = <REDACTED - restore by hand>" ;;
    *) echo "$name = $value" ;;
  esac
done >"$M/env-vars.txt"
echo "$PATH" | tr ':' '\n' >"$M/path.txt"

# ------------------------------------------------------- 7. Git repos
echo "[7/9] Git repositories"
{
  echo "# Git repositories on this machine"
  echo
  echo "Any repo marked DIRTY has uncommitted work that will be LOST if you wipe"
  echo "this machine. Commit and push every one before migrating."
  echo
  echo "| Path | Remote | Branch | State | Stashes |"
  echo "|---|---|---|---|---|"
  find "$SCAN_ROOT" -type d -name .git \
       -not -path '*/node_modules/*' -not -path '*/Library/*' \
       -not -path '*/.cargo/*' -not -path '*/.venv/*' -not -path '*/venv/*' \
       -prune -print 2>/dev/null | while read -r gitdir; do
    repo="$(dirname "$gitdir")"
    remote="$(git -C "$repo" remote get-url origin 2>/dev/null || echo '(no remote)')"
    branch="$(git -C "$repo" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
    dirty="$(git -C "$repo" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
    stash="$(git -C "$repo" stash list 2>/dev/null | wc -l | tr -d ' ')"
    ahead="$(git -C "$repo" log '@{u}..HEAD' --oneline 2>/dev/null | wc -l | tr -d ' ')"
    state="clean"; [ "$dirty" -gt 0 ] && state="**DIRTY** ($dirty files)"
    [ "$ahead" -gt 0 ] && state="$state / $ahead unpushed"
    echo "| \`${repo/#$HOME/\~}\` | $remote | $branch | $state | $stash |"
  done
} >"$M/repos.md"

# --------------------------------------------------- 8. Installed apps
echo "[8/9] Installed applications"
if [ "$(uname -s)" = "Darwin" ]; then
  ls -1 /Applications "$HOME/Applications" 2>/dev/null | sort -u >"$M/installed-apps.txt"
else
  { have dpkg && dpkg --get-selections; have rpm && rpm -qa; } >"$M/installed-apps.txt" 2>&1
fi

# ---------------------------------------------------- 9. Secrets to-do
echo "[9/9] Secrets checklist"
{
  cat <<'HDR'
# Secrets to move by hand

This snapshot deliberately contains **no credential values**. Everything below
must be moved through a password manager or typed in fresh on the new machine.
Do not paste any of these values into a chat, a file, or a git commit.

## Environment variables detected on the old machine
HDR
  env | cut -d= -f1 | sort | grep -Ei 'token|key|secret|password|auth|credential|apikey' \
    | sed 's/^/- [ ] `/; s/$/` (environment variable)/' || echo "- (none detected)"
  cat <<'FTR'

## Always check these too

- [ ] Claude Code login — run `claude` on the new machine and authenticate
- [ ] SSH private keys in `~/.ssh` — move over an encrypted channel, or
      generate a NEW keypair on the new machine and add it to GitHub (preferred)
- [ ] GitHub CLI / git credential helper login
- [ ] MCP server credentials — see `manifest/claude/claude-json-extract.json`
      for which servers exist and which fields were redacted
- [ ] `.npmrc` registry auth tokens (redacted in this snapshot)
- [ ] Cloud CLI logins (aws configure, gcloud auth login, az login)
- [ ] Any `.env` files inside your project repos — these are gitignored,
      so they are NOT in your GitHub remotes and NOT in this snapshot.
      Copy them across manually. This is the single most commonly lost item.
FTR
} >"$OUT/SECRETS-TODO.md"

printf '\nDone. Snapshot written to: %s\n' "$OUT"
printf 'Review SECRETS-TODO.md, then commit the snapshot to a PRIVATE repo.\n\n'
