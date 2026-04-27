import http from 'node:http';
import { WebSocketServer } from 'ws';
import { Pool, Client } from 'pg';
import { jwtVerify } from 'jose';

const PORT = Number(process.env.REALTIME_PORT || 8787);
const REALTIME_PATH = process.env.REALTIME_PATH || '/ws/realtime';
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const pgListener = new Client({
  connectionString: DATABASE_URL,
});

const clients = new Set();

function parseEqFilter(filter = '') {
  const match = filter.match(/^([^=]+)=eq\.(.+)$/);
  if (!match) return null;
  return {
    column: decodeURIComponent(match[1]),
    value: decodeURIComponent(match[2]),
  };
}

function getPayloadRow(payload) {
  return payload.eventType === 'DELETE' ? payload.old : payload.new;
}

function matchesBinding(binding, payload) {
  if (binding.event !== '*' && binding.event !== payload.eventType) return false;
  if (binding.schema !== payload.schema) return false;
  if (binding.table !== payload.table) return false;

  if (!binding.filter) return true;

  const parsed = parseEqFilter(binding.filter);
  if (!parsed) return true;

  const row = getPayloadRow(payload);
  if (!row) return false;

  return String(row[parsed.column] ?? '') === parsed.value;
}

async function isProjectMember(projectId, userId) {
  const { rows } = await pool.query(
    `
      select exists (
        select 1
        from public.project_members
        where project_id = $1
          and user_id = $2
      ) as allowed
    `,
    [projectId, userId]
  );

  return rows[0]?.allowed === true;
}

async function canSubscribe(userId, binding) {
  if (!binding) return false;
  if (binding.schema !== 'public') return false;

  const parsed = parseEqFilter(binding.filter || '');

  switch (binding.table) {
    case 'projects': {
      if (!parsed) return false;

      if (parsed.column === 'user_id') {
        return parsed.value === userId;
      }

      if (parsed.column === 'id') {
        return await isProjectMember(parsed.value, userId);
      }

      return false;
    }

    case 'columns':
    case 'cards':
    case 'tags':
    case 'project_members':
    case 'comments':
    case 'activity_log':
    case 'invitations': {
      if (!parsed || parsed.column !== 'project_id') return false;
      return await isProjectMember(parsed.value, userId);
    }

    default:
      return false;
  }
}

async function verifyToken(token) {
  const secret = new TextEncoder().encode(JWT_SECRET);
  const { payload } = await jwtVerify(token, secret);

  return {
    id: String(payload.sub),
    email: payload.email ? String(payload.email) : '',
    claims: payload,
  };
}

function send(ws, data) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({
  server,
  path: REALTIME_PATH,
});

wss.on('connection', async (ws, req) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Missing token');
      return;
    }

    const user = await verifyToken(token);

    const client = {
      ws,
      user,
      channels: new Map(), // channelName -> bindings[]
    };

    clients.add(client);

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'subscribe') {
          const channel = String(msg.channel || '');
          const bindings = Array.isArray(msg.bindings) ? msg.bindings : [];

          if (!channel || bindings.length === 0) {
            send(ws, {
              type: 'error',
              channel,
              message: 'Invalid subscription payload',
            });
            return;
          }

          const allowedBindings = [];
          for (const binding of bindings) {
            const allowed = await canSubscribe(user.id, binding);
            if (!allowed) {
              send(ws, {
                type: 'error',
                channel,
                message: 'Forbidden subscription',
              });
              return;
            }

            allowedBindings.push({
              event: binding.event,
              schema: binding.schema,
              table: binding.table,
              filter: binding.filter || '',
            });
          }

          client.channels.set(channel, allowedBindings);

          send(ws, {
            type: 'subscribed',
            channel,
          });

          return;
        }

        if (msg.type === 'unsubscribe') {
          const channel = String(msg.channel || '');
          client.channels.delete(channel);
          return;
        }
      } catch (err) {
        send(ws, {
          type: 'error',
          message: err.message || 'Invalid message',
        });
      }
    });

    ws.on('close', () => {
      clients.delete(client);
    });

    ws.on('error', () => {
      clients.delete(client);
    });
  } catch (err) {
    ws.close(4002, 'Unauthorized');
  }
});

pgListener.on('notification', (msg) => {
  if (!msg.payload) return;

  let payload;
  try {
    payload = JSON.parse(msg.payload);
  } catch {
    return;
  }

  for (const client of clients) {
    for (const [channel, bindings] of client.channels.entries()) {
      const matched = bindings.some((binding) => matchesBinding(binding, payload));

      if (matched) {
        send(client.ws, {
          type: 'postgres_changes',
          channel,
          payload,
        });
      }
    }
  }
});

async function start() {
  await pgListener.connect();
  await pgListener.query('LISTEN db_changes');

  server.listen(PORT, () => {
    console.log(`Realtime server listening on :${PORT}${REALTIME_PATH}`);
  });
}

start().catch((err) => {
  console.error('Realtime server failed to start:', err);
  process.exit(1);
});