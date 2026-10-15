# Nginx Reverse Proxy, SSL Termination & Load Balancer with Docker

A complete hands-on setup demonstrating **Nginx** as an SSL-terminating reverse proxy and load balancer distributing traffic across multiple containerized **Node.js (Express)** application instances using Docker Compose.

---

## 📐 Architecture & Traffic Flow

```
                      ┌──────────────────────────────────────────┐
                      │                 Client                   │
                      │        (Browser / curl requests)         │
                      └────────────────────┬─────────────────────┘
                                           │
                        HTTP :80           │           HTTPS :443
               ┌───────────────────────────┴────────────────────────────┐
               │                                                        │
               ▼                                                        ▼
       ┌───────────────┐                                       ┌────────────────┐
       │ Nginx (HTTP)  │                                       │ Nginx (HTTPS)  │
       │ 301 Redirect  ├───────> Redirect to https:// ────────>│ SSL Terminated │
       └───────────────┘                                       └───────┬────────┘
                                                                       │
                                                       upstream nodejs_cluster
                                                      (algorithm: least_conn)
                                                                       │
                         ┌─────────────────────────────────────────────┼─────────────────────────────────────────────┐
                         │                                             │                                             │
                         ▼                                             ▼                                             ▼
                 ┌───────────────┐                             ┌───────────────┐                             ┌───────────────┐
                 │  Docker App 1 │                             │  Docker App 2 │                             │  Docker App 3 │
                 │  Container:   │                             │  Container:   │                             │  Container:   │
                 │    `fool`     │                             │    `error`    │                             │    `door`     │
                 │   Port 3002   │                             │   Port 3003   │                             │   Port 3004   │
                 │  X-Served-By: │                             │  X-Served-By: │                             │  X-Served-By: │
                 │    "fool"     │                             │    "error"    │                             │    "door"     │
                 └───────────────┘                             └───────────────┘                             └───────────────┘
```

---

## ⚡ Fast-Track Quickstart (< 2 minutes)

If you want to spin everything up quickly from scratch:

```bash
# 1. Generate SSL Certificates (if not already created)
mkdir -p /Users/appsdeveloperdeveloper/hornacis/nginx-certs
cd /Users/appsdeveloperdeveloper/hornacis/nginx-certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx-selfsigned.key \
  -out nginx-selfsigned.crt \
  -subj "/C=IN/ST=State/L=City/O=Dev/CN=localhost"

# 2. Copy Nginx Configuration & Start Nginx
cd /Users/appsdeveloperdeveloper/hornacis/learn-nginx-1/seer
# For Intel Mac: /usr/local/etc/nginx/nginx.conf
# For Apple Silicon: /opt/homebrew/etc/nginx/nginx.conf
sudo cp nginx.conf /usr/local/etc/nginx/nginx.conf
sudo nginx -t && sudo nginx -s reload || sudo nginx

# 3. Build & Run Docker Application Instances in Background
docker-compose up --build -d

# 4. Test the Load Balancer
for i in {1..6}; do curl -sk -o /dev/null -D - https://localhost | grep "X-Served-By"; done
```

---

## 📋 Prerequisites

Ensure you have the following installed on your system:

- **Docker & Docker Compose**: [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Nginx**:
  ```bash
  brew install nginx
  ```
- **OpenSSL**: Included on macOS (`openssl version`)
- **Node.js (v20+)**: Recommended for local testing if running outside Docker

---

## 🛠️ Step-by-Step Walkthrough

### 1. SSL Certificate Generation

Nginx terminates SSL/TLS on port `443`. Generate a self-signed certificate and private key using OpenSSL:

```bash
# Create directory for certificates
mkdir -p /Users/appsdeveloperdeveloper/hornacis/nginx-certs
cd /Users/appsdeveloperdeveloper/hornacis/nginx-certs

# Generate self-signed certificate valid for 365 days
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx-selfsigned.key \
  -out nginx-selfsigned.crt \
  -subj "/C=IN/ST=State/L=City/O=Dev/CN=localhost"
```

Files produced:
- `nginx-selfsigned.crt`: Public certificate
- `nginx-selfsigned.key`: Private key

---

### 2. Nginx Configuration

The project includes a ready-to-use [`nginx.conf`](./nginx.conf).

#### Key Components in `nginx.conf`:
- **`upstream nodejs_cluster`**: Defines the backend servers (`127.0.0.1:3002`, `127.0.0.1:3003`, `127.0.0.1:3004`) and uses the `least_conn` load balancing algorithm (routes each new request to the container with the least number of active connections).
- **HTTPS Server (`listen 443 ssl`)**: Terminates SSL, passes requests to the upstream cluster, and preserves original client headers (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`).
- **HTTP Server (`listen 80`)**: Automatically redirects any unencrypted traffic to HTTPS (`301 Moved Permanently`).
- **Error Page 497**: Intercepts requests where an HTTP request was sent to an HTTPS port and redirects them to HTTPS cleanly.

#### Apply the configuration:
```bash
# Copy config to Nginx's configuration path
sudo cp /Users/appsdeveloperdeveloper/hornacis/learn-nginx-1/seer/nginx.conf /usr/local/etc/nginx/nginx.conf

# Verify configuration syntax
sudo nginx -t

# Start Nginx (if not running) or reload (if already running)
sudo nginx || sudo nginx -s reload
```

---

### 3. Build & Run Containers with Docker Compose

[`docker-compose.yaml`](./docker-compose.yaml) creates three isolated instances of the Node.js Express server:

| Container Name | Internal Port | Host Port | Injected `APP_NAME` |
| :--- | :--- | :--- | :--- |
| **`fool`** | 3001 | 3002 | `fool` |
| **`error`** | 3001 | 3003 | `error` |
| **`door`** | 3001 | 3004 | `door` |

Launch the cluster:
```bash
cd /Users/appsdeveloperdeveloper/hornacis/learn-nginx-1/seer

# Build images and start containers in detached mode
docker-compose up --build -d

# Check running status
docker-compose ps
```

---

### 4. Verification & Testing

#### A. Test HTTP to HTTPS Auto-Redirect (Port 80 -> 443)
```bash
curl -I http://localhost
```
*Expected output:*
```http
HTTP/1.1 301 Moved Permanently
Server: nginx/1.31.6
Location: https://localhost/
```

#### B. Test SSL & Load Balancing (`X-Served-By` Header)
Each backend server sets an `X-Served-By` response header with its container name. Make repeated requests to see the load balancer in action:

```bash
for i in {1..6}; do
  curl -sk -I https://localhost | grep -E "HTTP|X-Served-By"
done
```
*Expected output (cycled across instances):*
```
HTTP/1.1 200 OK
X-Served-By: fool

HTTP/1.1 200 OK
X-Served-By: error

HTTP/1.1 200 OK
X-Served-By: door

HTTP/1.1 200 OK
X-Served-By: fool
...
```

#### C. Test Directly in Your Web Browser
Open your browser and navigate to:
```
https://localhost
```
> **Note**: Because the certificate is self-signed, modern browsers will display a security warning. Click **Advanced** -> **Proceed to localhost (unsafe)** or type `thisisunsafe` in Chrome.

---

### 5. High Availability & Failover Testing

Test how Nginx automatically handles an offline instance:

1. **Stop one container (simulate crash):**
   ```bash
   docker stop fool
   ```

2. **Send requests again:**
   ```bash
   for i in {1..4}; do
     curl -sk -I https://localhost | grep "X-Served-By"
   done
   ```
   *Notice:* Nginx seamlessly routes traffic **only** to the healthy instances (`error` and `door`) without any 502 errors!

3. **Restore the stopped container:**
   ```bash
   docker start fool
   ```
   Nginx automatically resumes sending traffic to `fool`.

---

## 📦 Project File Structure

```
seer/
├── Dockerfile              # Container definition for Node.js Express app
├── docker-compose.yaml     # Multi-container orchestration (fool, error, door)
├── nginx.conf              # Portable reference Nginx configuration
├── package.json            # Node.js project manifest & scripts
├── .dockerignore           # Excludes node_modules from Docker build context
├── assets/                 # Static SVG graphics & icons
│   ├── hero.svg
│   ├── feature-speed.svg
│   ├── feature-security.svg
│   ├── feature-cloud.svg
│   └── feature-analytics.svg
├── src/
│   ├── index.html          # Web landing page served by Express
│   └── server.js           # Express app logic with custom X-Served-By header
└── README.md               # Documentation and replication guide
```

---

## 🧰 Cheat Sheet & Common Commands

### Nginx Commands
| Action | Command |
| :--- | :--- |
| Check configuration syntax | `sudo nginx -t` |
| Start Nginx | `sudo nginx` |
| Reload configuration safely | `sudo nginx -s reload` |
| Stop Nginx immediately | `sudo nginx -s stop` |
| Stop Nginx gracefully | `sudo nginx -s quit` |
| View access logs | `tail -f /usr/local/var/log/nginx/access.log` |
| View error logs | `tail -f /usr/local/var/log/nginx/error.log` |

### Docker Compose Commands
| Action | Command |
| :--- | :--- |
| Build & Start containers | `docker-compose up --build -d` |
| List running containers | `docker-compose ps` |
| View live logs from all containers | `docker-compose logs -f` |
| View logs from a specific container | `docker-compose logs -f fool` |
| Restart a container | `docker-compose restart <service_name>` |
| Stop and remove containers | `docker-compose down` |

---

## ⚠️ Troubleshooting

1. **Permission Denied on Port 80 / 443**:
   - Ports `< 1024` are privileged ports on Unix/macOS. Run `sudo nginx` or `sudo nginx -s reload` if prompted for permissions.
2. **Nginx Config Path on Apple Silicon vs Intel Mac**:
   - Intel Mac (`x86_64`): `/usr/local/etc/nginx/nginx.conf`
   - Apple Silicon (`M1/M2/M3/M4`): `/opt/homebrew/etc/nginx/nginx.conf`
   - Check where your Nginx looks for config: `nginx -V 2>&1 | grep -o '\--conf-path=[^ ]*'`
3. **Port Conflicts**:
   - If port 80 or 443 is already in use by Apache or another service:
     ```bash
     sudo lsof -i :80
     sudo lsof -i :443
     ```
     Kill or stop the conflicting process before starting Nginx.
