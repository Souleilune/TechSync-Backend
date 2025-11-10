// backend/app.js - FIXED CORS VERSION FOR PRODUCTION
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { createQueueMiddleware, queueStatsMiddleware, PRIORITY } = require('./middleware/requestQueue');

// Import routes
const authRoutes = require('./routes/auth');
const onboardingRoutes = require('./routes/onboarding');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const suggestionsRoutes = require('./routes/suggestions');
const skillMatchingRoutes = require('./routes/skillMatching'); 
const challengeRoutes = require('./routes/challenges');
const adminRoutes = require('./routes/admin');
const chatRoutes = require('./routes/chat');
const aiChatRoutes = require('./routes/aiChat');
const projectMemberRoutes = require('./routes/projectMembers');
const commentsRoutes = require('./routes/comments');
const notificationsRoutes = require('./routes/notifications');
const githubRoutes = require('./routes/github');
const friendsRoutes = require('./routes/friends');

const soloProjectRoutes = require('./routes/soloProjectRoutes');

const awardsRoutes = require('./routes/awards');
const userProfileUpdateRoutes = require('./routes/userProfileUpdate');
const collaborativeProjectCompletionRoutes = require('./routes/collaborativeProjectCompletion');
const usersRoutes = require('./routes/users');
const timelineRoutes = require('./routes/timeline');
const recommendationsRoutes = require('./routes/recommendations');
const coursesRoutes = require('./routes/courses');

const app = express();

// ============== SECURITY MIDDLEWARE ==============
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

// Trust proxy (CRITICAL for Render deployment)
app.set('trust proxy', 1);

// ============== CORS CONFIGURATION - FIXED FOR PRODUCTION ==============
// Build list of allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

// Add production frontend URL if it exists
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
  // Also add without trailing slash if it has one
  if (process.env.FRONTEND_URL.endsWith('/')) {
    allowedOrigins.push(process.env.FRONTEND_URL.slice(0, -1));
  }
  // Also add with trailing slash if it doesn't have one
  if (!process.env.FRONTEND_URL.endsWith('/')) {
    allowedOrigins.push(process.env.FRONTEND_URL + '/');
  }
}

console.log('🌐 CORS Configuration:');
console.log('   Allowed Origins:', allowedOrigins);
console.log('   NODE_ENV:', process.env.NODE_ENV);

// CORS middleware with detailed logging
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      console.log('✅ CORS: Allowing request with no origin header');
      return callback(null, true);
    }

    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS: Allowing origin:', origin);
      return callback(null, true);
    }

    // Log rejected origins for debugging
    console.log('❌ CORS: Rejecting origin:', origin);
    console.log('   Allowed origins:', allowedOrigins);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin', 
    'X-Requested-With', 
    'Content-Type', 
    'Accept', 
    'Authorization',
    'Cache-Control',
    'Pragma',
    'Expires'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600 // 10 minutes
}));

// Handle preflight requests explicitly
app.options('*', cors());

// Additional CORS headers middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // If origin is in allowed list, set it explicitly
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, Expires');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// ============== REQUEST PARSING ==============
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============== RATE LIMITING ==============
// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path === '/health' || req.path === '/';
  }
});

// Strict rate limiter for expensive operations
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Too many requests for this endpoint, please slow down.'
  }
});

// Auth-specific rate limiter (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.'
  }
});

// ============== REQUEST QUEUE MIDDLEWARE ==============
// Apply general rate limiter to all routes
app.use(generalLimiter);

// ============== HEALTH CHECK ==============
app.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    cors: {
      configured: true,
      allowedOrigins: allowedOrigins
    }
  });
});

// ============== API ROUTES ==============
// 1. Critical routes (with authentication rate limiting)
app.use('/api/auth', authLimiter, authRoutes);

// 2. User routes
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/profile-update', userProfileUpdateRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/awards', awardsRoutes);

// 3. Project routes
app.use('/api/projects', collaborativeProjectCompletionRoutes);
app.use('/api/projects', taskRoutes);
app.use('/api/projects', projectMemberRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/solo-projects', soloProjectRoutes);

// 4. Interaction routes
app.use('/api/timeline', timelineRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/chat', chatRoutes);

// 5. AI and recommendation routes (with strict rate limiting)
app.use('/api/ai-chat', aiChatRoutes);
app.use('/api/suggestions', suggestionsRoutes);
app.use('/api/skill-matching', strictLimiter, skillMatchingRoutes);
app.use('/api/recommendations', strictLimiter, recommendationsRoutes);
app.use('/api/courses', coursesRoutes);

// 6. Feature routes
app.use('/api/challenges', challengeRoutes);
app.use('/api/github', githubRoutes);

// 7. Admin routes (with strict limits)
app.use('/api/admin', strictLimiter, adminRoutes);

// ============== ERROR HANDLING ==============
// Global error handler
app.use(errorHandler);

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// ============== SOCKET.IO SETUP ==============
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      // Same logic as HTTP CORS
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New socket connection:', socket.id);

  socket.on('join-project', (projectId) => {
    socket.join(`project-${projectId}`);
    console.log(`Socket ${socket.id} joined project-${projectId}`);
  });

  socket.on('leave-project', (projectId) => {
    socket.leave(`project-${projectId}`);
    console.log(`Socket ${socket.id} left project-${projectId}`);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);
try {
  const setupSocketHandlers = require('./utils/socketHandler');
  if (typeof setupSocketHandlers === 'function') {
    setupSocketHandlers(io);
  } else {
    console.log('⚠️  Socket handler not properly exported');
  }
} catch (error) {
  console.error('❌ Failed to setup socket handlers:', error.message);
}
// Export both app and server
module.exports = { app, server };