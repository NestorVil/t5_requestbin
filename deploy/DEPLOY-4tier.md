# Request Bin — 4-instance multi-tier deployment runbook

Splits the single-box deployment (`DEPLOY.md`) across four EC2 instances in a
custom VPC. No Docker. No application code changes — the app's DB and CORS
settings were already made env-driven on the `deployment` branch.

```
Internet ──:80──> WEB  (public subnet)   nginx: static files + reverse proxy
                    │  :3000
                    ▼
                  APP  (private app subnet)   Express + Socket.io
                   │  :5432          │  :27017
                   ▼                 ▼
                  PG               MONGO   (private db subnet, one each)

Private subnets egress via a NAT Gateway in the public subnet (setup only).
Shell access to every box: SSM Session Manager (no SSH, no key pairs).
```

## Assumed already built (from `DEPLOY.md` era)

- VPC `10.0.0.0/24`, subnets: `web-1a` `10.0.0.0/26`, `app-1a` `10.0.0.128/27`,
  `db-1a` `10.0.0.192/27` (+ the unused `1b` set)
- `requestbin-igw`, `requestbin-public-rt` (`0.0.0.0/0 -> igw`, web subnets),
  `requestbin-private-rt` (associated with app/db subnets)
- `requestbin-ec2-role` (has `AmazonSSMManagedInstanceCore`)
- `requestbin-web-sg` (inbound TCP 80 from `0.0.0.0/0`)

## Instance plan

| Name | Subnet | Public IP | Static private IP | Security group | Type |
|---|---|---|---|---|---|
| `requestbin-web` | `web-1a` | yes | (auto) | `requestbin-web-sg` | t3.small |
| `requestbin-app` | `app-1a` | no | `10.0.0.132` | `requestbin-app-sg` | t3.micro |
| `requestbin-pg` | `db-1a` | no | `10.0.0.196` | `requestbin-db-sg` | t3.micro |
| `requestbin-mongo` | `db-1a` | no | `10.0.0.197` | `requestbin-db-sg` | t3.micro |

All: AMI Amazon Linux 2023, no key pair, IAM instance profile
`requestbin-ec2-role`, 8 GiB gp3. Static private IP goes in the launch wizard
under Network settings -> Advanced network configuration -> "Primary IP".

---

## Phase 1 — NAT Gateway (needed only while installing packages / using SSM on private boxes)

1. VPC console -> Elastic IPs -> Allocate.
2. VPC console -> NAT gateways -> Create: name `requestbin-nat`, subnet
   `requestbin-web-1a`, Connectivity **Public**, attach the Elastic IP.
3. Wait for **Available**.
4. Route tables -> `requestbin-private-rt` -> Routes -> Edit -> add
   `0.0.0.0/0 -> requestbin-nat`.

NAT Gateway bills ~$0.045/hr while it exists — see teardown at the bottom.

## Phase 2 — Security groups

Create in this order (each references the previous as a source):

| SG | Inbound | Outbound |
|---|---|---|
| `requestbin-app-sg` | TCP 3000 from `requestbin-web-sg` | All |
| `requestbin-db-sg` | TCP 5432 from `requestbin-app-sg`, TCP 27017 from `requestbin-app-sg` | All |

`requestbin-web-sg` is unchanged (TCP 80 from `0.0.0.0/0`).

## Phase 3 — Launch the four instances

Per the instance plan table above. Then confirm all four connect via
Session Manager (`whoami` -> `ssm-user`). If a private box won't connect,
check the NAT route, the NAT Gateway state, and the instance's IAM role.

**Run `hostname` at the start of every box's session** to be sure which box
you're on (`ip-10-0-0-132` = app, `-196` = pg, `-197` = mongo).

## Phase 4 — PostgreSQL server (`requestbin-pg`, 10.0.0.196)

```bash
sudo dnf update -y
sudo dnf install -y postgresql16 postgresql16-server
sudo /usr/bin/postgresql-setup --initdb
sudo systemctl enable --now postgresql

sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'YOUR_DB_PASSWORD';"

# listen on the network, not just localhost
sudo sed -ri "s/^#?listen_addresses\s*=.*/listen_addresses = '*'/" /var/lib/pgsql/data/postgresql.conf
# allow the app subnet to authenticate with a password
echo "host    all    all    10.0.0.128/27    scram-sha-256" | sudo tee -a /var/lib/pgsql/data/pg_hba.conf
sudo systemctl restart postgresql

# schema (pull the file from GitHub; feed on stdin so the postgres user can read it)
curl -fsSL -o /tmp/reset.sql https://raw.githubusercontent.com/NestorVil/t5_requestbin/multi-tier/backend/reset.sql
sudo -u postgres psql < /tmp/reset.sql
```
Check: `sudo ss -tlnp | grep 5432` shows `*:5432` (not `127.0.0.1`);
`sudo -u postgres psql -d request_basket -c '\dt'` lists `baskets`,
`http_requests`.

## Phase 5 — MongoDB server (`requestbin-mongo`, 10.0.0.197)

```bash
sudo dnf update -y
sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo >/dev/null <<'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-7.0.asc
EOF
sudo dnf install -y mongodb-org

# listen on the network, not just localhost
sudo sed -ri 's/^(\s*bindIp:).*/\1 0.0.0.0/' /etc/mongod.conf
sudo systemctl enable --now mongod
```
Check: `sudo ss -tlnp | grep 27017` shows `0.0.0.0:27017`;
`mongosh --quiet --eval 'db.runCommand({ ping: 1 })'` -> `{ ok: 1 }`.

## Phase 6 — App server (`requestbin-app`, 10.0.0.132)

```bash
sudo dnf update -y
# swap covers the npm install spike on a 1 GiB box
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs git

cd ~ && git clone https://github.com/NestorVil/t5_requestbin.git
cd t5_requestbin && git checkout multi-tier
cd backend && npm install

sudo tee /etc/requestbin.env >/dev/null <<'EOF'
NODE_ENV=production
POSTGRES_USER=postgres
POSTGRES_PASSWORD=YOUR_DB_PASSWORD
POSTGRES_HOST=10.0.0.196
POSTGRES_PORT=5432
POSTGRES_DB=request_basket
MONGO_URI=mongodb://10.0.0.197:27017
MONGO_DB_NAME=request_basket
CORS_ORIGIN=http://YOUR_WEB_PUBLIC_IP
EOF
sudo chmod 600 /etc/requestbin.env

sudo cp ~/t5_requestbin/deploy/requestbin.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now requestbin
```
Check: `curl -s localhost:3000/api/new-basket` returns a quoted name (that
query hits Postgres across boxes); `sudo journalctl -u requestbin | grep -i mongo`
shows `Connected to MongoDB (request_basket)`.

## Phase 7 — Web server (`requestbin-web`)

```bash
sudo dnf update -y
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs git nginx

cd ~ && git clone https://github.com/NestorVil/t5_requestbin.git
cd t5_requestbin && git checkout multi-tier
cd frontend && npm install && npm run build
sudo mkdir -p /var/www/requestbin && sudo cp -r dist/* /var/www/requestbin/

sudo cp ~/t5_requestbin/deploy/nginx-web-tier.conf /etc/nginx/conf.d/requestbin.conf
# remove the stock "server { ... }" block from /etc/nginx/nginx.conf
# (listen 80; root /usr/share/nginx/html;) or nginx warns about a
# conflicting default server / server_name.
sudo nano /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl enable --now nginx
```
Check: `curl -sI localhost | head -n1` -> `HTTP/1.1 200 OK`;
`curl -s localhost/api/new-basket` -> a quoted name (proxy to `10.0.0.132:3000`).

## Phase 8 — End-to-end

Browser -> `http://<web public IP>/` -> create a basket -> `curl -X POST
http://<web public IP>/basket/<name> -d '{"hi":1}' -H 'content-type: application/json'`
-> request appears live. Confirm the row in Postgres (`http_requests`) and the
document in Mongo (`db.raw_requests`).

---

## Session teardown (do this to keep cost near $0)

1. Stop all four instances (EC2 -> Instance state -> Stop).
2. Delete the NAT Gateway (`requestbin-nat`).
3. Release its Elastic IP.

Parked cost is then ~4 x 8 GiB EBS (~$2.60/mo). VPC / subnets / route tables /
SGs / IAM role are free and stay.

## Session start-up

1. Recreate the NAT Gateway (Phase 1) — new Elastic IP, same subnet, re-add
   the `0.0.0.0/0` route to `requestbin-private-rt`.
2. Start the four instances.
3. If `requestbin-web` got a new public IP, update `CORS_ORIGIN` in
   `/etc/requestbin.env` on the app box and `sudo systemctl restart requestbin`
   (or attach an Elastic IP to `requestbin-web` once to keep it stable).

## Redeploy after a code change

- Backend: on `requestbin-app`, `cd ~/t5_requestbin && git pull`,
  `cd backend && npm install`, `sudo systemctl restart requestbin`.
- Frontend: on `requestbin-web`, `cd ~/t5_requestbin && git pull`,
  `cd frontend && npm install && npm run build`,
  `sudo cp -r dist/* /var/www/requestbin/`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| private box won't connect via Session Manager | NAT route missing / NAT not Available / IAM role not attached |
| `curl localhost/api/new-basket` on web returns 502 | app box not reachable on 3000 — `requestbin-app-sg` rule, or `requestbin` service down on the app box |
| app `/api/new-basket` errors | Postgres cross-box: `listen_addresses`, `pg_hba` `10.0.0.128/27` line, or `requestbin-db-sg` 5432 rule |
| no "Connected to MongoDB" in app logs | `bindIp` on the mongo box still `127.0.0.1`, or `requestbin-db-sg` 27017 rule |
| nginx "conflicting server name" / serves default page | stock `server {}` block still in `/etc/nginx/nginx.conf` |
| live updates don't appear but row is in Postgres | Socket.io path — `/socket.io/` block in the web nginx config |
