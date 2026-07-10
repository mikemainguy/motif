# Building a Debian Package for motif-es-manual-mcp

This guide creates a `.deb` package that installs the Motif ES Manual MCP server
as a systemd service on Debian/Ubuntu systems.

## Prerequisites

Install the packaging tools on your Debian build machine:

```bash
sudo apt-get update
sudo apt-get install -y dpkg-dev fakeroot nodejs npm build-essential python3
```

Node.js 20+ is required. If your distro ships an older version, use NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Package Layout

The debian packaging files live in `debian/`:

```
debian/
├── control          # Package metadata and dependencies
├── rules            # Build instructions (Makefile)
├── changelog        # Version history (required by dpkg)
├── conffiles        # Marks config files for upgrade preservation
├── motif-es-manual-mcp.service  # systemd unit file
├── postinst         # Post-install script (enables service, builds DB)
├── prerm            # Pre-removal script (stops service)
└── postrm           # Post-removal script (cleans up)
```

## Building the Package

From the project root:

```bash
# 1. Install Node.js dependencies and compile TypeScript
npm ci
npm run build

# 2. Build the .deb package
dpkg-buildpackage -us -uc -b
```

The `-us -uc` flags skip GPG signing (fine for local/internal use).
The `.deb` file will be created in the parent directory: `../motif-es-manual-mcp_1.0.0_amd64.deb`

### Quick Build (without dpkg-buildpackage)

If you just want a `.deb` without the full Debian build toolchain:

```bash
# 1. Install and compile
npm ci
npm run build

# 2. Create the package staging directory
STAGING=$(mktemp -d)
INSTALL_DIR="$STAGING/opt/motif-es-manual-mcp"

mkdir -p "$INSTALL_DIR"
mkdir -p "$STAGING/DEBIAN"
mkdir -p "$STAGING/etc/systemd/system"

# 3. Copy application files
cp -r dist/ "$INSTALL_DIR/"
cp -r node_modules/ "$INSTALL_DIR/"
cp -r data/ "$INSTALL_DIR/"
cp package.json "$INSTALL_DIR/"

# 4. Copy packaging metadata
cp debian/control "$STAGING/DEBIAN/"
cp debian/conffiles "$STAGING/DEBIAN/"
cp debian/postinst "$STAGING/DEBIAN/"
cp debian/prerm "$STAGING/DEBIAN/"
cp debian/postrm "$STAGING/DEBIAN/"
chmod 755 "$STAGING/DEBIAN/postinst" "$STAGING/DEBIAN/prerm" "$STAGING/DEBIAN/postrm"

# 5. Copy systemd service
cp debian/motif-es-manual-mcp.service "$STAGING/etc/systemd/system/"

# 6. Build the .deb
dpkg-deb --build "$STAGING" motif-es-manual-mcp_1.0.0_amd64.deb
rm -rf "$STAGING"
```

## Installing

```bash
sudo dpkg -i motif-es-manual-mcp_1.0.0_amd64.deb

# If there are missing dependencies:
sudo apt-get install -f
```

This will:
- Install the application to `/opt/motif-es-manual-mcp/`
- Create a `motif-mcp` system user
- Install and enable a systemd service
- Build the search database (embedding generation — takes a few minutes on first install)

## Managing the Service

```bash
# Check status
sudo systemctl status motif-es-manual-mcp

# View logs
sudo journalctl -u motif-es-manual-mcp -f

# Restart
sudo systemctl restart motif-es-manual-mcp

# Stop
sudo systemctl stop motif-es-manual-mcp
```

The server listens on port **3001** by default. The MCP endpoint is at
`http://localhost:3001/mcp`.

## Uninstalling

```bash
sudo dpkg -r motif-es-manual-mcp
# or to also remove config files and the database:
sudo dpkg -P motif-es-manual-mcp
```

## Rebuilding the Search Database

If you need to regenerate the SQLite database with embeddings:

```bash
cd /opt/motif-es-manual-mcp
sudo -u motif-mcp npx tsx scripts/ingest.ts
sudo systemctl restart motif-es-manual-mcp
```

Note: The ingest script is not included in the installed package by default.
To include it, copy `scripts/` into the staging directory during the build step.
