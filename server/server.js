const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const socketHandler = require('./socket/socketHandler');
const { limiter, authLimiter } = require('./middleware/rateLimiter');
require('dotenv').config();

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL }
});

app.set('io', io);

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

// Rate limiting
app.use('/api/', limiter);
app.use('/api/auth', authLimiter);

// Static files
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'MeetHub App server is running!' });
});

socketHandler(io);

connectDB().then(() => {
  httpServer.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
  });
});