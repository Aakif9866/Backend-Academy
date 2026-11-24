---
title: Linux and the Shell for Backend Engineers
summary: The file system, permissions, processes, environment variables, pipes, networking commands and the debugging toolkit you'll use on every server.
difficulty: beginner
minutes: 45
prerequisites: [computers-processes-threads]
objectives:
  - Navigate the Linux file system and know what lives in /etc, /var, /proc and /tmp
  - Read and change file permissions and ownership
  - Compose commands with pipes and redirection to answer real questions about logs
  - Inspect processes, ports and network connectivity from the command line
  - Use environment variables correctly for configuration and secrets
videos:
  - id: ZtqBQ68cfJc
    title: The 50 Most Popular Linux & Terminal Commands - Full Course for Beginners
    channel: freeCodeCamp.org
    why: A hands-on tour of the commands used in this lesson. Follow along in a terminal rather than just watching.
resources:
  - url: https://linuxcommand.org/tlcl.php
    title: The Linux Command Line (free book)
    why: A complete, free book by William Shotts that goes from first commands to shell scripting.
  - url: https://www.gnu.org/software/bash/manual/
    title: GNU Bash Reference Manual
    why: The authoritative reference for quoting, expansion and redirection rules.
  - url: https://www.shellcheck.net/
    title: ShellCheck
    why: A linter that catches the quoting and word-splitting bugs that make shell scripts dangerous.
quiz:
  - type: mcq
    q: "A file has permissions -rw-r----- owned by user app, group app. Who can read it?"
    options: ["Everyone", "The owner and members of group app", "Only root", "Only the owner"]
    answer: 1
    explain: "The three triplets are owner (rw-), group (r--) and others (---). Owner can read and write, group can read, others have no access. Root bypasses permission checks entirely."
  - type: code
    q: What does this pipeline print?
    code: |
      grep ' 500 ' access.log | awk '{print $7}' | sort | uniq -c | sort -rn | head -5
    options: ["The 5 most recent errors", "The 5 URL paths with the most HTTP 500 responses, with counts", "The 5 slowest requests", "The first 5 lines of the log"]
    answer: 1
    explain: "grep keeps 500 lines, awk extracts field 7 (the path in common log format), sort + uniq -c counts each distinct path, sort -rn orders by count descending, head keeps the top 5."
  - type: scenario
    q: "Your API won't start: \"EADDRINUSE: address already in use :::3000\". What command shows what's holding the port?"
    options: ["ls /dev/3000", "ss -ltnp 'sport = :3000' (or lsof -i :3000)", "cat /etc/ports", "ping localhost:3000"]
    answer: 1
    explain: "ss -ltnp lists listening TCP sockets with the owning process; lsof -i :3000 does the same. Often it's an old instance of your own server that didn't shut down."
  - type: tf
    q: Running `export DB_PASSWORD=secret` in a terminal makes that variable available to programs started from that same shell afterwards.
    answer: 0
    explain: "True. Exported variables are inherited by child processes started from that shell. They're not visible to unrelated processes or other shells, and they vanish when the shell exits."
  - type: mcq
    q: "Why is `curl -v https://api.example.com` so useful when debugging?"
    options: ["It's faster than a browser", "It shows DNS resolution, the TLS handshake, the exact request headers sent and the response headers received", "It bypasses firewalls", "It caches responses"]
    answer: 1
    explain: "-v (verbose) prints the connection steps, certificate details and every header in both directions, which is exactly what you need to see whether a problem is DNS, TLS, a header or the server."
---

## Why it matters

Almost every backend runs on Linux: your containers, your cloud VMs, your CI runners and your database servers. When something breaks in production, the tools you'll reach for are `ssh`, `curl`, `ss`, `journalctl`, `grep` and `top`, not an IDE. Fluency here turns a two-hour mystery into a five-minute diagnosis.

## The file system: everything is a file

Linux has a single tree starting at `/`. Some directories you'll touch constantly:

| Path | What lives there |
| --- | --- |
| `/etc` | System-wide configuration: `/etc/nginx/`, `/etc/hosts`, `/etc/systemd/` |
| `/var/log` | Log files (on systemd systems many logs are in the journal instead) |
| `/var/lib` | Application state: `/var/lib/postgresql/`, `/var/lib/docker/` |
| `/home/<user>` | User home directories (`~`) |
| `/tmp` | Temporary files, often cleared on reboot |
| `/proc` | A virtual file system exposing kernel and process information |
| `/dev` | Devices (disks, `/dev/null`, `/dev/urandom`) |
| `/usr/bin`, `/usr/local/bin` | Installed programs |

"Everything is a file" is close to literally true: sockets, pipes, devices and process information are all accessed through file-like interfaces. That's why the same tools (`cat`, `grep`, `ls`) work on so many things.

```bash
pwd                    # where am I?
ls -lah                # list everything, human-readable sizes, including dotfiles
cd /var/log && ls -lt  # newest files first
cat /etc/os-release    # which distro is this?
du -sh * | sort -h     # what is using the disk here?
df -h                  # free space per mounted file system
find / -name "*.log" -size +100M 2>/dev/null   # big log files anywhere
```

## Permissions and ownership

Every file has an **owner**, a **group** and three sets of permissions: for the owner, for the group, and for everyone else.

```
-rw-r-----  1 app  app  2.1K Nov 10 09:12 .env
│└┬┘└┬┘└┬┘     │    │
│ │  │  └ others: ---  (nothing)
│ │  └─── group:  r--  (read)
│ └────── owner:  rw-  (read, write)
└──────── type: - file, d directory, l symlink
```

Permissions are often written in octal: r = 4, w = 2, x = 1, summed per triplet. `640` is `rw-r-----`, `755` is `rwxr-xr-x`, `600` is `rw-------`.

```bash
chmod 600 .env                 # only the owner can read/write: right for secrets
chmod +x deploy.sh             # make a script executable
chown app:app /srv/app -R      # change owner and group recursively
sudo -u app whoami             # run a command as another user
```

For a directory, `x` means "may enter it" and `r` means "may list it".

**Principle of least privilege:** run your service as a dedicated, unprivileged user (`app`, `www-data`, or a numeric UID in containers), give it write access only to the directories it needs, and keep secrets at `600`.

## Shell fundamentals: pipes, redirection and quoting

The shell's superpower is composing small programs. Each program reads **stdin** and writes **stdout** (and errors to **stderr**).

```bash
command > out.txt        # stdout to a file (overwrite)
command >> out.txt       # append
command 2> err.txt       # stderr to a file
command > all.txt 2>&1   # both to one file
command < input.txt      # stdin from a file
cmd1 | cmd2              # stdout of cmd1 becomes stdin of cmd2
command > /dev/null      # discard output
```

A realistic question: "which endpoints produced the most 500 errors in the last log file?"

```bash
grep ' 500 ' /var/log/nginx/access.log \
  | awk '{print $7}' \
  | sort | uniq -c | sort -rn | head
```

The toolkit for slicing text:

| Tool | Use |
| --- | --- |
| `grep -E 'a|b'`, `grep -v`, `grep -c`, `grep -r` | Filter lines; invert; count; search recursively |
| `awk '{print $1, $9}'` | Pick columns, simple arithmetic |
| `sort`, `sort -n`, `uniq -c` | Order and count |
| `cut -d, -f2` | Split on a delimiter |
| `head -n 20`, `tail -n 50`, `tail -f` | Start, end, follow a growing file |
| `wc -l` | Count lines |
| `jq '.level'` | Query JSON (structured logs!) |
| `xargs` | Turn lines into arguments: `cat ids.txt \| xargs -n1 -P8 ./process.sh` |

With structured JSON logs, `jq` is indispensable:

```bash
# All error-level log lines for one request id, showing time and message
jq -c 'select(.level=="error" and .request_id=="6c1f9a") | {time, msg}' app.log
```

**Quoting matters.** Unquoted variables are split on spaces and expanded as globs:

```bash
file="my report.txt"
rm $file        # tries to delete "my" and "report.txt"  ✗
rm "$file"      # deletes "my report.txt"               ✓
```

Start scripts with `set -euo pipefail` so they stop on the first error, treat unset variables as errors, and fail if any command in a pipeline fails. Run ShellCheck on anything you'll reuse.

## Processes from the command line

```bash
ps aux | grep node           # all processes, filter by name
pgrep -fl gunicorn           # PIDs by pattern
top        # or htop: live CPU and memory per process
kill -TERM 4242              # polite stop (graceful shutdown)
kill -KILL 4242              # forced stop (no cleanup) — last resort
command &                    # run in the background
jobs; fg %1                  # list and resume background jobs
nohup ./worker.sh &          # keep running after you log out
```

On servers, long-running services are managed by **systemd**:

```bash
sudo systemctl status myapi          # is it running? recent log lines
sudo systemctl restart myapi
sudo journalctl -u myapi -f          # follow its logs
sudo journalctl -u myapi --since "10 min ago" -p err
```

A minimal unit file at `/etc/systemd/system/myapi.service`:

```ini
[Unit]
Description=My API
After=network-online.target

[Service]
User=app
WorkingDirectory=/srv/myapi
EnvironmentFile=/etc/myapi/env
ExecStart=/usr/bin/node server.js
Restart=on-failure
# systemd sends SIGTERM on stop, then SIGKILL after this timeout
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

## Environment variables

Environment variables are key-value strings every process inherits from its parent. They are the standard way to configure a service without changing code (factor III of the [Twelve-Factor App](https://12factor.net/config)).

```bash
echo "$HOME"                         # read one
env | sort                           # list all
export PORT=8080                     # set for this shell and its children
PORT=9090 node server.js             # set only for this one command
```

In code, read them once at startup and **validate** them, so a missing value fails fast instead of at 3 a.m.:

```ts
import { z } from "zod";
const Env = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});
export const env = Env.parse(process.env); // throws with a clear message if invalid
```

Secrets in environment variables are convenient but not invisible: they're readable in `/proc/<pid>/environ` by the same user and root, they can leak into crash reports and child processes, and `.env` files get committed by accident. Add `.env` to `.gitignore`, and in production prefer a secrets manager that injects values at runtime (covered in [CI/CD and infrastructure as code](/learn/cicd-and-iac/)).

## Networking commands

These answer "is it DNS, the network, TLS, or my app?"

```bash
ip addr                         # this machine's interfaces and IPs
ss -ltnp                        # listening TCP ports and their processes
ss -tnp state established       # current connections
dig api.example.com +short      # DNS lookup (nslookup works too)
dig api.example.com +trace      # follow the resolution from the root
ping -c 3 10.0.1.5              # basic reachability (ICMP may be blocked)
nc -vz db.internal 5432         # can I open a TCP connection to this port?
curl -v https://api.example.com/health            # full request/response with TLS details
curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' https://api.example.com/   # status and timing
traceroute api.example.com      # the path packets take
```

A debugging ladder for "the service can't reach the database":

1. `dig db.internal`: does the name resolve to the right IP?
2. `nc -vz db.internal 5432`: is the port reachable (firewall, security group)?
3. `psql "$DATABASE_URL" -c 'select 1'`: do credentials and TLS work?
4. App logs: is the connection pool exhausted, or is it a timeout setting?

## SSH

```bash
ssh -i ~/.ssh/id_ed25519 app@203.0.113.10
ssh-keygen -t ed25519 -C "you@example.com"     # generate a key pair
ssh -L 5433:localhost:5432 app@bastion          # forward local 5433 to the remote Postgres
scp backup.sql app@host:/tmp/                   # copy a file
```

Disable password logins on servers (`PasswordAuthentication no` in `sshd_config`) and use keys. Port forwarding (`-L`) lets you reach a private database through a bastion host without exposing it to the internet.

## Common mistakes

- `chmod 777` to "fix" a permission error. It gives every user write access. Fix ownership instead.
- Running everything as root, in containers too.
- Unquoted variables in scripts, which break on spaces and can delete the wrong files.
- Using `kill -9` first. It skips graceful shutdown, so in-flight requests fail and files may be left half-written.
- Committing `.env` files.
- Debugging by guesswork instead of walking the DNS → TCP → TLS → app ladder.

## Security considerations

- Least privilege everywhere: unprivileged service users, `600` on secrets, minimal sudo.
- Key-based SSH only; consider a bastion and disallow direct root login.
- Be careful with `curl … | bash` install scripts: read them first.
- Shell scripts that interpolate untrusted input are command-injection vulnerabilities (see [web vulnerabilities](/learn/web-vulnerabilities/)).

## Hands-on exercise

Write a script `logreport.sh` that takes an Nginx access log path and prints:

1. Total requests and the number of 4xx and 5xx responses.
2. The top 10 client IPs by request count.
3. The top 10 paths returning 5xx.
4. Requests per minute for the busiest 5 minutes.

Requirements: `set -euo pipefail`, quote every variable, print usage if no argument is given, and pass ShellCheck with no warnings. Generate a test log by running Nginx in Docker and hitting it with a loop of `curl` requests, including some to missing paths.

## Completion criteria

- You can find what's using a port, a disk or a CPU without searching the web.
- You can answer questions about a log file with a pipeline.
- You configure services through validated environment variables and keep secrets out of Git.
