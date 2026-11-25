import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// Minimal Express-style `res` so the route handlers in ./routes stay unchanged.
function recorder() {
  const res = {
    code: 200,
    out: null,
    status(code) {
      res.code = code;
      return res;
    },
    json(data) {
      res.out = Response.json(data, { status: res.code });
      return res;
    },
    end() {
      res.out = new Response(null, { status: res.code });
      return res;
    },
  };
  return res;
}

export const requireRole = (roles) => ({ roles });

/**
 * Wrap an Express-style (req, res) handler as a Next.js route handler.
 * route([options,] handler)
 * options.auth  — require a valid Bearer token (default true)
 * options.roles — if set, user.role must be one of these (403 otherwise)
 */
export function route(...args) {
  const handler = args.pop();
  const { auth = true, roles } = args[0] || {};
  return async (request, ctx) => {
    const res = recorder();
    const url = new URL(request.url);
    const req = {
      params: (await ctx?.params) || {},
      query: Object.fromEntries(url.searchParams),
      body: undefined,
      user: undefined,
    };

    if (auth) {
      const header = request.headers.get("authorization") || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : null;
      if (!token) return Response.json({ error: "Missing token" }, { status: 401 });
      try {
        req.user = jwt.verify(token, JWT_SECRET);
      } catch {
        return Response.json({ error: "Invalid or expired token" }, { status: 401 });
      }
    }

    if (roles && !roles.includes(req.user?.role)) {
      return Response.json({ error: "Not authorized for this action" }, { status: 403 });
    }

    if (request.method !== "GET" && request.method !== "DELETE") {
      req.body = await request.json().catch(() => undefined);
    }

    handler(req, res);
    return res.out || Response.json({ error: "No response" }, { status: 500 });
  };
}
