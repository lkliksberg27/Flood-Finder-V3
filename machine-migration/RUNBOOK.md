# Migrating a Claude Code-managed dev machine

Goal: the new laptop behaves exactly like the old one, with more compute and
nothing broken.

## The idea

Because Claude Code manages this machine, its real state is **configuration,
not mystery**. That means you should not clone a disk. Disk clones drag along
old drivers, a Windows install bonded to different hardware, and years of
accumulated cruft — that is how you get "same computer, same problems."

Instead: **turn the machine into a repo.** Capture what the machine *is* as a
manifest, commit it, and have Claude Code on the new laptop rebuild from that
manifest. You end up with a machine that is identical in behaviour, clean in
construction, and — the real prize — *reproducible*. Do this once and the next
migration is an afternoon, not a weekend.

## What's in this folder

| File | Runs on | Purpose |
|---|---|---|
| `capture.sh` | macOS / Linux | Snapshot the old machine into a manifest |
| `capture.ps1` | Windows (PowerShell 5.1+) | Same, for Windows |
| `RUNBOOK.md` | — | This document |

Both scripts are **read-only**. They never modify the machine they run on, and
they never write a credential value to disk.

---

## Phase 0 — Before you start

- [ ] New laptop in hand and through first boot
- [ ] External SSD, at least as large as the used space on the old drive
- [ ] A **private** GitHub repo for the snapshot (e.g. `machine-setup`).
      Private is not optional — the manifest describes your whole environment.
- [ ] Both machines on the same network

---

## Phase 1 — On the OLD machine: capture

Run the script for your OS from a normal (non-admin) shell:

```powershell
# Windows
.\capture.ps1
```

```bash
# macOS / Linux
./capture.sh
```

It writes `machine-snapshot/` containing:

```
machine-snapshot/
├── SECRETS-TODO.md              <- your hand-migration checklist
└── manifest/
    ├── system.md                 OS, CPU, RAM, arch
    ├── packages/                 winget export / Brewfile / apt manifest
    ├── toolchains/               python, node, rust, go + PINNED versions
    ├── claude/
    │   ├── dot-claude/           settings, CLAUDE.md, agents, commands,
    │   │                         your own skills, hooks, keybindings
    │   └── claude-json-extract.json   MCP servers (values redacted)
    ├── dotfiles/                 .gitconfig, shell profiles, VS Code exts
    ├── env-vars.txt              names only; secret values redacted
    ├── path.txt
    ├── repos.md                  every git repo + dirty/unpushed state
    └── installed-apps.txt        GUI apps not covered by a package manager
```

### Then hand it to Claude Code

Open Claude Code on the old machine, in the snapshot folder, and paste:

> Read `manifest/repos.md`. For every repo marked DIRTY or with unpushed
> commits, walk me through it one at a time: show me the diff, help me write a
> commit message, and push. Do not force-push and do not discard anything. If a
> repo has no remote, tell me and stop — I'll decide where it should live.
>
> Then search every repo for `.env`, `.env.local`, `secrets.*` and similar
> gitignored config files, and list their paths **without printing contents**.
> Those need to move by hand.

**Uncommitted work is the single biggest thing people lose in a migration.**
Do not skip this step. Claude Code cannot rebuild what was never pushed.

### Commit the snapshot

```bash
cd machine-snapshot
git init && git add -A
git commit -m "Snapshot of old machine"
git remote add origin git@github.com:<you>/machine-setup.git
git push -u origin main
```

Before pushing, skim `manifest/env-vars.txt` and `claude-json-extract.json`
yourself. The scripts redact aggressively, but you know your own setup — if
something looks like a credential, delete it.

---

## Phase 2 — Secrets, by hand

Work through `SECRETS-TODO.md`. These never go in the repo.

Move them through a password manager, or retype them. Two notes:

- **SSH keys:** prefer generating a *new* keypair on the new laptop and adding
  it to GitHub over copying the old private key. Same access, and the old key
  dies with the old machine.
- **`.env` files:** gitignored, so they are not in your GitHub remotes and not
  in the snapshot. Copy these across deliberately. This is the most commonly
  lost item in any dev-machine migration.

---

## Phase 3 — The safety net

Independent of everything above, keep a bootable copy of the old machine until
you are certain the new one is complete.

**Easiest:** pull the old SSD, put it in a ~$20 USB NVMe enclosure. Now it's an
external drive — every file reachable, and it doubles as your copy source.

**Or:** run Sysinternals `Disk2vhd` (Windows, free) to snapshot the live disk
to a `.vhdx` on the external SSD, then attach it in Hyper-V on the new laptop.
That gives you the old machine bootable in a window. Useful for hunting down
something you forgot; not something you should rely on daily.

Either way: **do not wipe the old laptop for 60 days.**

---

## Phase 4 — On the NEW machine: rebuild

1. Windows Update / OS updates to completion, then reboot.
2. Install git and Claude Code.
3. `claude` and authenticate.
4. Clone the snapshot repo.
5. Open Claude Code in it and paste:

> This repo is a snapshot of my previous dev machine. Rebuild this machine to
> match it.
>
> Read `manifest/system.md` first to see what the old machine was, then compare
> against this machine — the OS or architecture may differ, and if so, adapt
> rather than copying blindly.
>
> Work in this order, and **stop and show me the plan before installing
> anything**:
> 1. Package managers, then the packages in `manifest/packages/`
> 2. Language toolchains at the **exact versions** pinned in
>    `manifest/toolchains/` — use a version manager (mise/asdf/pyenv/nvm)
>    rather than system-wide installs
> 3. `manifest/claude/dot-claude/` into `~/.claude/` — settings, CLAUDE.md,
>    agents, commands, my own skills, hooks. Do not copy synced skills or
>    plugin caches; those re-sync themselves.
> 4. MCP servers from `manifest/claude/claude-json-extract.json`. Every
>    `<REDACTED:...>` is a credential I must supply — collect them into one
>    list and ask me for all of them at once rather than one at a time.
> 5. Dotfiles from `manifest/dotfiles/`, merged with anything this machine
>    already has — do not blindly overwrite a fresh `.gitconfig`.
> 6. Clone every repo in `manifest/repos.md` to the same relative paths.
>
> Flag anything in `manifest/installed-apps.txt` that needs a manual installer
> or a license sign-in, and list those at the end for me to do by hand.

Let it work. Answer its questions. This is the step that takes the afternoon.

---

## Phase 5 — Prove it's the same machine

This is the part most migrations skip, and it's the reason they end with
"wait, why doesn't this work anymore" three weeks later.

Run the capture script **again**, on the new machine:

```bash
./capture.sh ./new-machine-snapshot
```

Then in Claude Code:

> Diff `manifest/` against `new-machine-snapshot/manifest/`. Ignore expected
> differences (hostname, CPU, RAM, disk sizes, absolute paths under a different
> username). For everything else, produce a table: what exists on the old
> machine but not the new one, and any tool whose version differs.
>
> Then tell me which of those actually matter and which are noise, and fix the
> ones that matter.

You now have a **machine-checkable definition of "it's the same computer."**
That's the thing a disk clone can't give you.

---

## Phase 6 — Decommission

Only after Phase 5 comes back clean, and after ~60 days of real use:

- [ ] Deactivate machine-locked licenses on the old laptop (some EE tools count
      activations — MATLAB and Altium are usually account-based and fine, but
      check before wiping)
- [ ] Sign out of everything
- [ ] Confirm the external SSD copy is readable **from the new machine**
- [ ] Factory reset the old laptop

---

## What this deliberately does NOT move

| Not moved | Why |
|---|---|
| Credential values | Move by hand. See `SECRETS-TODO.md`. |
| SSH private keys | Generate new ones; add to GitHub. |
| Anthropic-synced skills, plugin caches | Re-sync on their own; copying them shadows newer versions. |
| Claude Code transcripts (`~/.claude/projects`) | Machine-specific history, large, not needed to reproduce behaviour. |
| Installed binaries | Reinstalled fresh at pinned versions. Copying binaries across machines is how you inherit rot. |
| OS drivers, Windows install | New hardware needs its own. |

## Keeping it this way

The snapshot repo is now the definition of your machine. Re-run the capture
script and commit whenever you make a significant environment change. Next
migration: Phase 4, done.

For the projects themselves — get everything into Git with a remote. On a
Claude Code-managed machine that's not just backup, it's what lets Claude
rebuild your working context on any machine, in minutes.
