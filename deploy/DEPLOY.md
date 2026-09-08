# Request Bin — EC2 deployment runbook (Phase 3)

Single Amazon Linux 2023 instance, no Docker. nginx on :80 serves the built
React app and proxies `/api`, `/socket.io`, `/basket/` to the Node backend on
:3000. PostgreSQL and MongoDB run locally on the same box.

## Prerequisites (do before touching the instance)

- Phase 1 (VPC) and Phase 2 (IAM role, security group, instance, Elastic IP)
  complete.
- The deploy branch is **pushed** to GitHub — the box clones it, it can't see
  your laptop:
  ```
  git push -u origin deployment
  ```
- You have the Elastic IP noted, and the PostgreSQL password you intend to use.

All commands below run in the **Session Manager** shell
(EC2 console -> select instance -> Connect -> Session Manager -> Connect).

---

## 1. Become ec2-user and update the system

```bash
sudo su - ec2-user
sudo dnf update -y
```

## 2. (Recommended) add swap so the frontend build can't OOM

`t3.small` has 2 GB RAM; the Vite build can spike over 1 GB with two databases
already running.

```bash
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 3. Install packages

```bash
# Node 22 (NodeSource) — Vite 8 / React 19 need >= 20.19; 22 LTS is safe
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs git nginx postgresql16 postgresql16-server
```

## 4. PostgreSQL

```bash
sudo /usr/bin/postgresql-setup --initdb
sudo systemctl enable --now postgresql

# set the postgres role password (use your own; must match /etc/requestbin.env)
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'YOUR_DB_PASSWORD';"

# allow password auth for local TCP connections (default is ident/peer)
sudo sed -ri 's|^(host\s+all\s+all\s+(127\.0\.0\.1/32|::1/128)\s+)\w+|\1scram-sha-256|' \
  /var/lib/pgsql/data/pg_hba.conf
sudo systemctl restart postgresql
```

Schema is loaded in step 7 (after the repo is cloned).

## 5. MongoDB 7

```bash
sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo >/dev/null <<'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-7.0.asc
EOF

sudo dnf install -y mongodb-org
sudo systemctl enable --now mongod
```

Binds to `127.0.0.1:27017`, no auth — fine for localhost-only use.

## 6. Clone the repo

```bash
cd ~
git clone https://github.com/NestorVil/t5_requestbin.git
cd t5_requestbin
git checkout deployment
```

## 7. Load the database schema

```bash
sudo -u postgres psql -f ~/t5_requestbin/backend/reset.sql
```

## 8. Backend env file

```bash
sudo tee /etc/requestbin.env >/dev/null <<'EOF'
NODE_ENV=production
POSTGRES_USER=postgres
POSTGRES_PASSWORD=YOUR_DB_PASSWORD
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=request_basket
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB_NAME=request_basket
CORS_ORIGIN=http://YOUR_ELASTIC_IP
EOF
sudo chmod 600 /etc/requestbin.env
```

`CORS_ORIGIN` is optional (the code falls back to allow-all), but setting it to
the real address is tighter.

## 9. Backend service

```bash
cd ~/t5_requestbin/backend
npm install
sudo cp ~/t5_requestbin/deploy/requestbin.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now requestbin
sudo systemctl status requestbin --no-pager
```

Expect `active (running)`. Logs: `sudo journalctl -u requestbin -f`

## 10. Frontend build

```bash
cd ~/t5_requestbin/frontend
npm install
npm run build
sudo mkdir -p /var/www/requestbin
sudo cp -r dist/* /var/www/requestbin/
```

## 11. nginx

```bash
# comment out the stock "server { ... }" block inside the http { } section
# of /etc/nginx/nginx.conf, then:
sudo cp ~/t5_requestbin/deploy/nginx-requestbin.conf /etc/nginx/conf.d/requestbin.conf
sudo nginx -t
sudo systemctl enable --now nginx
```

If `nginx -t` complains about a duplicate default server, the stock block in
`nginx.conf` still has `listen 80` — comment it out fully and re-test.

## 12. Verify

On the box:
```bash
curl -sI localhost | head -n1        # HTTP/1.1 200 OK
curl -s localhost/api/new-basket     # a random name in quotes
```

From your laptop:
- `http://YOUR_ELASTIC_IP/` -> UI loads at `/web`
- create a basket, then:
  ```
  curl -X POST http://YOUR_ELASTIC_IP/basket/<name> \
    -H 'content-type: application/json' -d '{"hello":"world"}'
  ```
- the request appears live in the browser without refresh
- rows land in Postgres (`http_requests`) and Mongo (`raw_requests`)

---

## Redeploying after a code change

```bash
cd ~/t5_requestbin && git pull
cd backend && npm install && sudo systemctl restart requestbin
cd ../frontend && npm install && npm run build && sudo cp -r dist/* /var/www/requestbin/
```

## Common issues

| Symptom | Cause / fix |
|---|---|
| `502` on `/api` or `/basket` | backend not running — `journalctl -u requestbin -e` |
| backend restarts in a loop | DB auth — password in `/etc/requestbin.env` != the `postgres` role password, or step 4 `pg_hba` sed didn't apply |
| UI loads, no live updates | check browser console; confirm `/socket.io/` block is in the active nginx config |
| `nginx -t` duplicate default server | stock `server{}` in `nginx.conf` still active |
| Mongo won't start | `journalctl -u mongod -e`; on non-AVX CPUs (t2) pin `mongodb-org-5.0` instead |
