# C2 Redirector

This is a Node.js Express application that acts as a redirector and proxy to the C2 server. It allows deployment with HTTPS using a domain and Let's Encrypt certificate.

## Setup
1. **Install Dependencies**: Run `npm install` to install required packages.
2. **Environment Variables**: Set `TARGET_C2_URL` to your actual C2 server IP and port if different from the default (`http://31.57.147.77:6464`).
3. **Run**: Use `npm start` to run the server, or `npm run dev` for development with nodemon.

## HTTPS Deployment
- Obtain a domain and point it to the server running this application.
- Use Certbot or another Let's Encrypt client to obtain an SSL certificate for your domain.
- Configure Nginx or another reverse proxy to handle HTTPS and forward traffic to this app on port 6465.

## Nginx Example Configuration
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://localhost:6465;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
