import session from 'express-session';

declare module 'express-session' {
  interface SessionData {
    maintainerId?: string;
    githubUsername?: string;
  }
}

export function createSessionMiddleware(): ReturnType<typeof session> {
  return session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  });
}

export function requireAuth(
  req: Parameters<import('express').RequestHandler>[0],
  res: Parameters<import('express').RequestHandler>[1],
  next: Parameters<import('express').RequestHandler>[2],
): void {
  if (!req.session?.maintainerId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  next();
}
