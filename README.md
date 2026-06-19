# openpanel-mcp

A minimal MCP server for OpenPanel analytics. Focused on 3 tools:

| Tool | What it does |
|---|---|
| `get_landing_pages` | Top pages users landed on, with counts |
| `get_page_events` | All events on a specific page path |
| `get_events_list` | All distinct event names being tracked |

---

## Setup

### 1. Get your OpenPanel credentials
Go to **OpenPanel Dashboard → Settings → API Clients** and create a client.  
Copy the **Client ID** and **Client Secret**.

### 2. Install & run locally

```bash
npm install
npm run dev
```

Set env vars before running:
```bash
export OPENPANEL_CLIENT_ID=your_client_id
export OPENPANEL_CLIENT_SECRET=your_client_secret
```

### 3. Add to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "openpanel": {
      "command": "node",
      "args": ["/path/to/openpanel-mcp/dist/index.js"],
      "env": {
        "OPENPANEL_CLIENT_ID": "your_client_id",
        "OPENPANEL_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

Then restart Claude Desktop.

### 4. Deploy to CapRover

```bash
# Build image
docker build -t openpanel-mcp .

# Push to your registry or use CapRover's deploy flow
# Set env vars in CapRover app settings:
# OPENPANEL_CLIENT_ID=...
# OPENPANEL_CLIENT_SECRET=...
```

---

## Example usage

> "How many people visited my landing pages this week?"  
> "What events happened on /pricing in the last 30 days?"  
> "What events are being tracked on my site?"
