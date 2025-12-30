const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { noSqlInjectionGuard } = require('../middleware/validator');
const { notFound, errorHandler } = require('../middleware/errorHandler');

function createApp() {
  const app = express();

  const publicDir = path.join(__dirname, '..', 'public');
  const distDir = path.join(__dirname, '..', 'dist');
  const distIndex = path.join(distDir, 'index.html');

  // Middleware
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const corsOrigins = String(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  // Dev: allow all origins (easier local dev)
  // Prod: only enable CORS if an explicit allowlist is provided
  if (!isProd) {
    app.use(cors());
  } else if (corsOrigins.length > 0) {
    app.use(
      cors({
        origin: corsOrigins,
        credentials: true,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      })
    );
  }

  app.use(express.json({ limit: '1mb' }));

  // Legacy HTML pages -> Vue SPA routes
  app.get('/index.html', (req, res) => res.redirect(302, '/'));
  app.get('/login.html', (req, res) => res.redirect(302, '/login'));
  app.get('/products.html', (req, res) => res.redirect(302, '/products'));
  app.get('/product-detail.html', (req, res) => res.redirect(302, '/products'));
  app.get('/recommended.html', (req, res) => res.redirect(302, '/recommended'));
  app.get('/shops.html', (req, res) => res.redirect(302, '/shops'));
  app.get('/merchant.html', (req, res) => res.redirect(302, '/shops'));
  app.get('/orders.html', (req, res) => res.redirect(302, '/orders'));
  app.get('/address.html', (req, res) => res.redirect(302, '/addresses'));
  app.get('/profile.html', (req, res) => res.redirect(302, '/profile'));
  app.get('/merchant-dashboard.html', (req, res) => res.redirect(302, '/merchant/dashboard'));
  app.get('/add-product.html', (req, res) => res.redirect(302, '/merchant/products/new'));
  app.get('/admin.html', (req, res) => res.redirect(302, '/admin'));

  // Serve built Vue SPA if available (dist may appear after startup)
  app.use((req, res, next) => {
    if (fs.existsSync(distIndex)) {
      return express.static(distDir)(req, res, next);
    }
    return next();
  });

  // Keep legacy public assets (uploads/images/style.css)
  app.use(express.static(publicDir));

  // Security Middleware - NoSQL Injection Guard
  app.use(noSqlInjectionGuard);

  // Health check (lightweight)
  app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // API Routes
  app.use(require('../routes'));

  // Serve frontend
  app.get('*', (req, res) => {
    if (fs.existsSync(distIndex)) {
      return res.sendFile(distIndex);
    }

    res.status(500).type('html').send(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>前端未构建</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;max-width:820px;margin:48px auto;padding:0 16px;line-height:1.6}
      code,pre{background:#f6f8fa;border-radius:6px;padding:2px 6px}
      pre{padding:12px;overflow:auto}
    </style>
  </head>
  <body>
    <h1>Vue 前端尚未构建</h1>
    <p>当前找不到 <code>dist/index.html</code>，因此无法提供 SPA 页面。</p>
    <p>请在项目根目录执行：</p>
    <pre><code>npm run build:web
node server.js</code></pre>
    <p>或直接执行：<code>npm start</code>（会自动构建 dist）。</p>
  </body>
</html>`);
  });

  // Global Error Handling Middleware (must be after all routes)
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
