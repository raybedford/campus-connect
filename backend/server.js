const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const config = require('./config');
const socketHandler = require('./socket');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');
const keyRoutes = require('./routes/keys');
const fileRoutes = require('./routes/files');
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');

const helmet = require('helmet');

const app = express();
const server = http.createServer(app);

// Security Middlewares
app.use(helmet());
app.use(cors({ origin: config.CORS_ORIGINS }));
app.use(express.json());

// Request logging middleware (optional, but recommended)
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/conversations', conversationRoutes);
app.use('/messages', messageRoutes);
app.use('/keys', keyRoutes);
app.use('/files', fileRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Error handling
app.use(errorHandler);

// Initialize Socket.io
socketHandler(io);

// Database connection
mongoose.connect(config.MONGO_URI)
  .then(() => {
    logger.info('Connected to MongoDB');
    server.listen(config.PORT, () => {
      logger.info(`Server running on port ${config.PORT}`);
    });
  })
  .catch(err => {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Cleanup tasks
const { cleanupOldFiles } = require('./services/fileService');
const { cleanupDeletedAccounts } = require('./services/userService');

setInterval(() => {
  cleanupOldFiles()
    .then(deletedCount => {
      if (deletedCount > 0) logger.info(`Cleaned up ${deletedCount} expired file(s)`);
    })
    .catch(err => logger.error('File cleanup error:', err));
}, 3600000); // Hourly

setInterval(() => {
  cleanupDeletedAccounts()
    .then(deletedCount => {
      if (deletedCount > 0) logger.info(`Permanently removed ${deletedCount} scheduled accounts`);
    })
    .catch(err => logger.error('Account cleanup error:', err));
}, 86400000); // Daily (24h)
