#!/usr/bin/env node

/**
 * Local API server for microservices development
 * Simulates API Gateway + Lambda locally
 */

const http = require('http');
const url = require('url');

// Set local environment
process.env.AWS_REGION = 'us-east-2';
process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';

// Import Lambda handlers
const competitions = require('../lambda/competitions');
const events = require('../lambda/events');
const scores = require('../lambda/scores');
const categories = require('../lambda/categories');
const wods = require('../lambda/wods');
const users = require('../lambda/users');

// Route to handler mapping
const routes = {
  '/competitions': competitions,
  '/events': events,
  '/scores': scores,
  '/categories': categories,
  '/wods': wods,
  '/me': users,
  '/users': users,
};

const PORT = 3001;

const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  // Find matching handler
  let handler = null;
  let basePath = '';
  
  for (const [route, h] of Object.entries(routes)) {
    if (path === route || path.startsWith(route + '/')) {
      handler = h;
      basePath = route;
      break;
    }
  }
  
  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Route not found' }));
    return;
  }

  // Read request body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    // Simulate API Gateway event
    const event = {
      path: path,
      httpMethod: req.method,
      headers: req.headers,
      queryStringParameters: parsedUrl.query,
      body: body || null,
      requestContext: {
        authorizer: {
          claims: {
            sub: 'local-user-123', // Mock user ID for local dev
            email: 'dev@local.com',
            'custom:isSuperAdmin': 'true', // Mock super admin
          }
        }
      }
    };

    console.log(`${req.method} ${path} → ${basePath}`);

    try {
      const response = await handler.handler(event);
      
      res.writeHead(response.statusCode, {
        'Content-Type': 'application/json',
        ...response.headers
      });
      res.end(response.body);
    } catch (error) {
      console.error('Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: error.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log('🚀 Local API Server running');
  console.log(`📍 http://localhost:${PORT}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  /competitions');
  console.log('  /events');
  console.log('  /scores');
  console.log('  /categories');
  console.log('  /wods');
  console.log('  /me');
  console.log('  /users');
  console.log('');
  console.log('Press Ctrl+C to stop');
});
