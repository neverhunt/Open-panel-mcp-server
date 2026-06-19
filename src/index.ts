import { Server } from "@modelcontextprotocol/sdk/server/index.js";

import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ── Config ────────────────────────────────────────────────────────────────────

const CLIENT_ID = process.env.OPENPANEL_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.OPENPANEL_CLIENT_SECRET ?? "";
const BASE_URL = process.env.OPENPANEL_BASE_URL ?? "";

if (!CLIENT_ID || !CLIENT_SECRET || !BASE_URL) {
  console.error(
    "ERROR: OPENPANEL_CLIENT_ID, OPENPANEL_CLIENT_SECRET, and OPENPANEL_BASE_URL must be set in the environment."
  );
  process.exit(1);
}


// ── OpenPanel API helper ──────────────────────────────────────────────────────

async function opRequest(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined) url.searchParams.set(key, String(val));
  }
  
  console.log(`[DEBUG] OpenPanel API Request to: ${url.toString()}`);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "openpanel-client-id": CLIENT_ID,
        "openpanel-client-secret": CLIENT_SECRET,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[ERROR] OpenPanel API error ${res.status}: ${text}`);
      throw new Error(`OpenPanel API error ${res.status}: ${text}`);
    }

    return res.json();
  } catch (err) {
    console.error(`[ERROR] OpenPanel API request failed:`, err);
    throw err;
  }
}

// ── Tool implementations ──────────────────────────────────────────────────────

/** Tool 1: Top landing pages with visitor counts */
async function getLandingPages(args: {
  project_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  filters?: string;
}) {
  const data = await opRequest("/export/events", {
    projectId: args.project_id,
    startDate: args.start_date,
    endDate: args.end_date,
    limit: args.limit ?? 100,
    filters: args.filters,
    // filter to page views only
    event: "screen_view",
  });

  return data;
}

/** Tool 2: Events recorded on a specific page path */
async function getPageEvents(args: {
  project_id?: string;
  path: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  filters?: string;
}) {
  const data = await opRequest("/export/events", {
    projectId: args.project_id,
    startDate: args.start_date,
    endDate: args.end_date,
    limit: args.limit ?? 100,
    path: args.path,
    filters: args.filters,
  });

  return data;
}

/** Tool 3: All distinct event names being tracked */
async function getEventsList(args: {
  project_id?: string;
  start_date?: string;
  end_date?: string;
  filters?: string;
}) {
  const data = await opRequest("/export/events", {
    projectId: args.project_id,
    startDate: args.start_date,
    endDate: args.end_date,
    filters: args.filters,
    limit: 1000,
  });

  // Extract unique event names from the response
  const events = (data as { data?: Array<{ name?: string }> }).data ?? [];
  const uniqueNames = [...new Set(events.map((e) => e.name).filter(Boolean))];

  return {
    total_events_in_range: events.length,
    unique_event_names: uniqueNames,
  };
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_landing_pages",
    description:
      "Get the top pages that users landed on, along with visitor/event counts. Use this to see which pages are receiving traffic.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Optional OpenPanel project ID. Required if using Root credentials to query a specific project.",
        },
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format (e.g. 2024-01-01)",
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format (e.g. 2024-01-31)",
        },
        limit: {
          type: "number",
          description: "Max number of records to return. Default: 100",
        },
        filters: {
          type: "string",
          description: "JSON array string of filters (e.g. '[{\"property\":\"country\",\"operator\":\"is_not\",\"value\":\"IN\"}]')",
        },
      },
    },
  },
  {
    name: "get_page_events",
    description:
      "Get all events recorded on a specific page path. Use this to see what actions users are taking on a particular page.",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        project_id: {
          type: "string",
          description: "Optional OpenPanel project ID.",
        },
        path: {
          type: "string",
          description: "The page path to filter by, e.g. /pricing or /signup",
        },
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format",
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format",
        },
        limit: {
          type: "number",
          description: "Max number of records to return. Default: 100",
        },
        filters: {
          type: "string",
          description: "JSON array string of filters",
        },
      },
    },
  },
  {
    name: "get_events_list",
    description:
      "Get a list of all distinct event names being tracked across your site. Use this to discover what events are available before querying a specific page.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Optional OpenPanel project ID.",
        },
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format",
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format",
        },
        filters: {
          type: "string",
          description: "JSON array string of filters",
        },
      },
    },
  },
];

// ── MCP Server Factory ────────────────────────────────────────────────────────

function createServerInstance(): Server {
  console.log("[DEBUG] Creating new Server instance...");
  const server = new Server(
    { name: "openpanel-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.log("[DEBUG] ListToolsRequestSchema called");
    return { tools: TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    console.log(`[DEBUG] CallToolRequestSchema called for tool: ${name}`);

    try {
      let result: unknown;

      if (name === "get_landing_pages") {
        result = await getLandingPages(
          args as { project_id?: string; start_date?: string; end_date?: string; limit?: number; filters?: string }
        );
      } else if (name === "get_page_events") {
        result = await getPageEvents(
          args as {
            project_id?: string;
            path: string;
            start_date?: string;
            end_date?: string;
            limit?: number;
            filters?: string;
          }
        );
      } else if (name === "get_events_list") {
        result = await getEventsList(
          args as { project_id?: string; start_date?: string; end_date?: string; filters?: string }
        );
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      console.error(`[ERROR] Tool execution failed for ${name}:`, err);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

// ── Start ─────────────────────────────────────────────────────────────────────

const app = express();
const port = process.env.PORT || 3000;

const transports = new Map<string, SSEServerTransport>();
const servers = new Map<string, Server>();

// Default landing page
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>OpenPanel MCP Server</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
          h1 { color: #333; }
          .status { padding: 10px; background: #e6f4ea; color: #1e8e3e; border-radius: 4px; display: inline-block; }
          .endpoint { background: #f1f3f4; padding: 10px; border-radius: 4px; font-family: monospace; }
        </style>
      </head>
      <body>
        <h1>OpenPanel MCP Server</h1>
        <div class="status">✅ Server is running</div>
        <p>This is a Model Context Protocol (MCP) server for OpenPanel Analytics.</p>
        <h2>Connection Endpoints</h2>
        <p>SSE Transport URL: <span class="endpoint">/sse</span></p>
        <p>Message POST URL: <span class="endpoint">/messages</span></p>
      </body>
    </html>
  `);
});

app.get("/sse", async (req, res) => {
  console.log(`[SSE] New connection from ${req.ip}`);

  // CRITICAL FIX: Prevent CapRover Nginx from buffering the SSE stream!
  // If Nginx buffers, the Python client never receives the session ID and times out in 60s.
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Cache-Control", "no-cache");

  try {
    const transport = new SSEServerTransport("/messages", res);
    console.log(`[SSE] Transport initialized. Session ID: ${transport.sessionId}`);
    
    const serverInstance = createServerInstance();
    await serverInstance.connect(transport);
    console.log(`[SSE] Server connected to transport for session ${transport.sessionId}`);
    
    transports.set(transport.sessionId, transport);
    servers.set(transport.sessionId, serverInstance);
    
    res.on('close', () => {
      console.log(`[SSE] Connection closed for session ${transport.sessionId}`);
      transports.delete(transport.sessionId);
      servers.delete(transport.sessionId);
    });
  } catch (err) {
    console.error(`[SSE] Error during connection setup:`, err);
    if (!res.headersSent) res.status(500).send("Failed to setup SSE");
  }
});

app.post("/messages", async (req, res) => {
  console.log(`[POST /messages] Request received from ${req.ip}. Query:`, req.query);
  try {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      console.log(`[POST /messages] Error: Missing sessionId`);
      res.status(400).send("Missing sessionId");
      return;
    }
    
    const transport = transports.get(sessionId);
    if (!transport) {
      console.log(`[POST /messages] Error: Session not found for ID ${sessionId}`);
      res.status(404).send("Session not found");
      return;
    }
    
    console.log(`[POST /messages] Forwarding message to transport for session ${sessionId}...`);
    await transport.handlePostMessage(req, res);
    console.log(`[POST /messages] Message handled successfully.`);
  } catch (err) {
    console.error("[POST /messages] Unhandled error:", err);
    if (!res.headersSent) {
      res.status(500).send("Internal Server Error");
    }
  }
});

app.listen(port, () => {
  console.log(`OpenPanel MCP server listening on port ${port}`);
});
