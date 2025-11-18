// backend/utils/socketHandler.js - PRODUCTION-OPTIMIZED VERSION
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

// Validate environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables for socketHandler');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ============== OPTIMIZED USER TRACKING ==============
class UserConnectionManager {
  constructor() {
    this.userSockets = new Map(); // userId -> Set of socketIds (support multiple connections per user)
    this.socketUsers = new Map(); // socketId -> userId
    this.socketRooms = new Map(); // socketId -> Set of rooms
    this.cleanupInterval = null;
  }

  addConnection(userId, socketId) {
    // ✅ OPTIMIZATION: Support multiple sockets per user
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socketId);
    
    this.socketUsers.set(socketId, userId);
    this.socketRooms.set(socketId, new Set());
  }

  addRoom(socketId, room) {
    if (!this.socketRooms.has(socketId)) {
      this.socketRooms.set(socketId, new Set());
    }
    this.socketRooms.get(socketId).add(room);
  }

  removeConnection(socketId) {
    const userId = this.socketUsers.get(socketId);
    if (userId) {
      const userSockets = this.userSockets.get(userId);
      if (userSockets) {
        userSockets.delete(socketId);
        if (userSockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
    }
    this.socketUsers.delete(socketId);
    this.socketRooms.delete(socketId);
  }

  getRooms(socketId) {
    return this.socketRooms.get(socketId) || new Set();
  }

  getUserSocketCount(userId) {
    return this.userSockets.get(userId)?.size || 0;
  }

  getStats() {
    return {
      totalConnections: this.socketUsers.size,
      uniqueUsers: this.userSockets.size,
      totalRooms: Array.from(this.socketRooms.values()).reduce((sum, rooms) => sum + rooms.size, 0),
      memoryUsage: process.memoryUsage()
    };
  }

  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const stats = this.getStats();
      console.log(`[Socket Cleanup] Connections: ${stats.totalConnections}, Users: ${stats.uniqueUsers}, Memory: ${(stats.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }, 60000);
  }

  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

const connectionManager = new UserConnectionManager();

// ✅ OPTIMIZATION: Cache for frequently accessed data
const userCache = new Map(); // userId -> user data
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const setupSocketHandlers = (io) => {
  console.log('🔌 Setting up production-optimized Socket.io handlers...');
  
  connectionManager.startCleanup();

  const MAX_CONNECTIONS_PER_USER = 10;
  const activeConnections = new Map();

  // ✅ OPTIMIZATION: Authentication middleware with caching
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id || decoded.userId;
      
      if (!userId) {
        return next(new Error('Invalid token structure'));
      }

      // ✅ OPTIMIZATION: Check cache first
      let user = userCache.get(userId);
      
      if (!user || Date.now() - user.cachedAt > USER_CACHE_TTL) {
        const { data: userData, error } = await supabase
          .from('users')
          .select('id, username, full_name, avatar_url')
          .eq('id', userId)
          .single();

        if (error || !userData) {
          return next(new Error('Invalid authentication token'));
        }

        user = { ...userData, cachedAt: Date.now() };
        userCache.set(userId, user);
      }

      // Check connection limit
      const userConnectionCount = connectionManager.getUserSocketCount(user.id);
      if (userConnectionCount >= MAX_CONNECTIONS_PER_USER) {
        return next(new Error('Maximum connections exceeded'));
      }

      socket.userId = user.id;
      socket.user = user;
      
      activeConnections.set(user.id, userConnectionCount + 1);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ [Auth] User authenticated:', user.username);
      }
      
      next();
    } catch (error) {
      console.error('❌ [Auth] Error:', error.message);
      next(new Error('Authentication failed'));
    }
  });

  // ✅ OPTIMIZATION: Global stale connection cleanup
  const cleanupStaleConnections = () => {
    const connectedUserIds = new Set();
    io.sockets.sockets.forEach((s) => {
      if (s.userId) connectedUserIds.add(s.userId);
    });

    let cleaned = 0;
    activeConnections.forEach((count, userId) => {
      if (!connectedUserIds.has(userId)) {
        activeConnections.delete(userId);
        cleaned++;
      }
    });

    if (cleaned > 0 && process.env.NODE_ENV === 'development') {
      console.log(`🧹 [Cleanup] Removed ${cleaned} stale entries`);
    }
  };

  const globalCleanupInterval = setInterval(cleanupStaleConnections, 5 * 60 * 1000);

  // ============== CONNECTION HANDLER ==============
  io.on('connection', (socket) => {
    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      console.log(`✅ [Connection] ${socket.user.username} (${socket.id})`);
    }
    
    connectionManager.addConnection(socket.userId, socket.id);

    // ✅ OPTIMIZATION: Only log events in development
    if (isDev) {
      socket.onAny((eventName) => {
        console.log(`🎯 [Event] ${eventName} from ${socket.user.username}`);
      });
    }

    // ============== FRIENDS CHAT ==============
    socket.on('join_friends_chat', async () => {
      try {
        const userId = socket.userId;
        const userRoom = `user_${userId}`;
        socket.join(userRoom);
        
        const { data: friendships } = await supabase
          .from('user_friendships')
          .select('requester_id, addressee_id')
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
          .eq('status', 'accepted');

        const friendIds = friendships?.map(f => 
          f.requester_id === userId ? f.addressee_id : f.requester_id
        ) || [];

        // ✅ OPTIMIZATION: Batch emit to multiple rooms
        friendIds.forEach(friendId => {
          io.to(`user_${friendId}`).emit('friend_online', {
            userId,
            username: socket.user.username
          });
        });

        const onlineFriends = friendIds.filter(friendId => 
          Array.from(io.sockets.sockets.values()).some(s => s.userId === friendId)
        );

        socket.emit('online_friends_list', { onlineFriends });
      } catch (error) {
        console.error('❌ [Friends Chat] Error:', error.message);
      }
    });

    socket.on('send_friend_message', async (data) => {
      if (isDev) {
        console.log('🔵 [Friend Message] Received from:', socket.user.username);
      }
      
      try {
        const { recipientId, content } = data;
        const senderId = socket.userId;

        // ✅ OPTIMIZATION: Validate input first (fail fast)
        if (!recipientId || !content?.trim()) {
          socket.emit('error', { message: 'Invalid message data' });
          return;
        }

        // Check friendship
        const { data: friendship, error: friendshipError } = await supabase
          .from('user_friendships')
          .select('id')
          .or(`and(requester_id.eq.${senderId},addressee_id.eq.${recipientId},status.eq.accepted),and(requester_id.eq.${recipientId},addressee_id.eq.${senderId},status.eq.accepted)`)
          .single();

        if (friendshipError || !friendship) {
          socket.emit('error', { message: 'Not friends with this user' });
          return;
        }

        // Insert message
        const { data: message, error } = await supabase
          .from('friend_messages')
          .insert({
            sender_id: senderId,
            recipient_id: recipientId,
            content: content.trim()
          })
          .select()
          .single();

        if (error) {
          socket.emit('error', { message: 'Failed to send message' });
          return;
        }

        // ✅ OPTIMIZATION: Parallel emit (don't wait)
        io.to(`user_${recipientId}`).emit('friend_message', {
          senderId,
          message
        });

        socket.emit('friend_message_sent', { message });

      } catch (error) {
        console.error('❌ [Friend Message] Error:', error.message);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ============== PROJECT ROOMS ==============
    socket.on('join_project_rooms', async (projectId) => {
      try {
        // ✅ OPTIMIZATION: Parallel queries
        const [membershipResult, roomsResult] = await Promise.all([
          supabase
            .from('project_members')
            .select('id')
            .eq('project_id', projectId)
            .eq('user_id', socket.userId)
            .single(),
          supabase
            .from('chat_rooms')
            .select('id, name')
            .eq('project_id', projectId)
            .limit(50)
        ]);

        if (membershipResult.error || !membershipResult.data) {
          socket.emit('error', { message: 'Not a project member' });
          return;
        }

        if (roomsResult.error) {
          socket.emit('error', { message: 'Failed to fetch chat rooms' });
          return;
        }

        const projectRoom = `project_${projectId}`;
        socket.join(projectRoom);
        connectionManager.addRoom(socket.id, projectRoom);

        // ✅ OPTIMIZATION: Batch join rooms
        const rooms = roomsResult.data || [];
        if (rooms.length > 0) {
          const roomNames = rooms.map(room => `room_${room.id}`);
          socket.join(roomNames);
          roomNames.forEach(roomName => {
            connectionManager.addRoom(socket.id, roomName);
          });
        }

        socket.emit('rooms_joined', { projectId, rooms });

      } catch (error) {
        console.error('❌ [Join Rooms] Error:', error.message);
        socket.emit('error', { message: 'Failed to join project rooms' });
      }
    });

    // ============== MESSAGE HANDLING ==============
    const MESSAGE_RATE_LIMIT = 10;
    const messageTimestamps = [];

    socket.on('send_message', async (data) => {
      try {
        // ✅ OPTIMIZATION: Rate limiting (fail fast)
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        const recentMessages = messageTimestamps.filter(t => t > oneMinuteAgo);
        
        if (recentMessages.length >= MESSAGE_RATE_LIMIT) {
          socket.emit('error', { message: 'Message rate limit exceeded' });
          return;
        }
        
        messageTimestamps.push(now);
        while (messageTimestamps.length > 0 && messageTimestamps[0] < oneMinuteAgo) {
          messageTimestamps.shift();
        }

        const { roomId, projectId, content, messageType = 'text', replyToMessageId = null } = data;

        // ✅ OPTIMIZATION: Validate all inputs first
        if (!roomId || !content?.trim() || !projectId) {
          socket.emit('error', { message: 'Invalid message data' });
          return;
        }

        const MAX_MESSAGE_LENGTH = 5000;
        const trimmedContent = content.slice(0, MAX_MESSAGE_LENGTH);

        // ✅ OPTIMIZATION: Parallel verification queries
        const [roomResult, membershipResult] = await Promise.all([
          supabase
            .from('chat_rooms')
            .select('project_id')
            .eq('id', roomId)
            .single(),
          supabase
            .from('project_members')
            .select('id')
            .eq('project_id', projectId)
            .eq('user_id', socket.userId)
            .single()
        ]);

        if (roomResult.error || !roomResult.data) {
          socket.emit('error', { message: 'Chat room not found' });
          return;
        }

        if (membershipResult.error || !membershipResult.data) {
          socket.emit('error', { message: 'Not a project member' });
          return;
        }

        // Insert message
        const { data: newMessage, error: insertError } = await supabase
          .from('chat_messages')
          .insert({
            room_id: roomId,
            user_id: socket.userId,
            message_type: messageType,
            content: trimmedContent,
            reply_to_message_id: replyToMessageId
          })
          .select(`
            *,
            users!inner(id, username, full_name, avatar_url)
          `)
          .single();

        if (insertError) {
          socket.emit('error', { message: 'Failed to send message' });
          return;
        }

        // Format message
        const processedMessage = {
          ...newMessage,
          user: Array.isArray(newMessage.users) ? newMessage.users[0] : newMessage.users
        };
        delete processedMessage.users;

        // ✅ OPTIMIZATION: Fetch reply data only if needed
        if (replyToMessageId) {
          const { data: replyToMessage } = await supabase
            .from('chat_messages')
            .select('*, users!inner(id, username, full_name, avatar_url)')
            .eq('id', replyToMessageId)
            .single();

          if (replyToMessage) {
            processedMessage.reply_to = {
              ...replyToMessage,
              user: Array.isArray(replyToMessage.users) ? replyToMessage.users[0] : replyToMessage.users
            };
            delete processedMessage.reply_to.users;
          }
        }

        // ✅ OPTIMIZATION: Non-blocking broadcast
        socket.to(`room_${roomId}`).emit('new_message', {
          message: processedMessage,
          roomId,
          projectId: roomResult.data.project_id
        });

        socket.emit('message_sent', {
          message: processedMessage,
          roomId
        });

      } catch (error) {
        console.error('❌ [Send Message] Error:', error.message);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ============== TYPING INDICATORS ==============
    const typingTimeouts = new Map();

    socket.on('typing_start', (data) => {
      const { roomId, projectId } = data;
      
      if (typingTimeouts.has(roomId)) {
        clearTimeout(typingTimeouts.get(roomId));
      }

      socket.to(`room_${roomId}`).emit('user_typing', {
        userId: socket.userId,
        username: socket.user.username,
        roomId,
        projectId
      });

      const timeout = setTimeout(() => {
        socket.to(`room_${roomId}`).emit('user_stopped_typing', {
          userId: socket.userId,
          roomId,
          projectId
        });
        typingTimeouts.delete(roomId);
      }, 5000);

      typingTimeouts.set(roomId, timeout);
    });

    socket.on('typing_stop', (data) => {
      const { roomId, projectId } = data;
      
      if (typingTimeouts.has(roomId)) {
        clearTimeout(typingTimeouts.get(roomId));
        typingTimeouts.delete(roomId);
      }

      socket.to(`room_${roomId}`).emit('user_stopped_typing', {
        userId: socket.userId,
        roomId,
        projectId
      });
    });

    // ============== ONLINE STATUS ==============
    socket.on('get_online_users', (data) => {
      const { projectId } = data;
      const onlineUsers = [];
      
      io.sockets.sockets.forEach((clientSocket) => {
        if (clientSocket.userId && clientSocket.rooms.has(`project_${projectId}`)) {
          onlineUsers.push({
            id: clientSocket.userId,
            username: clientSocket.user.username,
            full_name: clientSocket.user.full_name,
            avatar_url: clientSocket.user.avatar_url
          });
        }
      });

      socket.emit('online_users', { projectId, users: onlineUsers });
    });

    // ============== DISCONNECT ==============
    socket.on('disconnect', (reason) => {
      const userId = socket.userId;
      const username = socket.user?.username;

      if (isDev) {
        console.log(`🔌 [Disconnect] ${username} - ${reason}`);
      }
      
      // Cleanup timeouts
      if (typingTimeouts.size > 0) {
        typingTimeouts.forEach(timeout => clearTimeout(timeout));
        typingTimeouts.clear();
      }

      // Update connection count
      if (userId) {
        const userConnectionCount = activeConnections.get(userId) || 0;
        const newCount = Math.max(0, userConnectionCount - 1);
        
        if (newCount <= 0) {
          activeConnections.delete(userId);
        } else {
          activeConnections.set(userId, newCount);
        }
      }

      // Notify rooms
      const rooms = connectionManager.getRooms(socket.id);
      rooms.forEach(roomName => {
        if (roomName.startsWith('project_')) {
          const projectId = roomName.replace('project_', '');
          socket.to(roomName).emit('user_offline', {
            userId,
            projectId
          });
        }
      });

      connectionManager.removeConnection(socket.id);
    });

    socket.on('error', (error) => {
      console.error(`❌ [Socket Error] ${socket.user?.username}:`, error.message);
    });

  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Socket] Shutting down...');
    clearInterval(globalCleanupInterval);
    connectionManager.stopCleanup();
    io.close(() => {
      console.log('[Socket] Closed all connections');
    });
  });

  console.log('✅ Production-optimized Socket.io handlers ready');
};

module.exports = setupSocketHandlers;