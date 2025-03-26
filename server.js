const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = 3000;

app.use(express.static('public'));
app.use(express.json());
app.use(cors());

// MongoDB setup with debug logging
console.log('Attempting to connect to MongoDB...');
mongoose.connect('mongodb://127.0.0.1:27017/car-game', { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err.message));
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
    highScore: { type: Number, default: 0 }
});
const User = mongoose.model('User', UserSchema);

const SECRET_KEY = 'your-secret-key';

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Register endpoint
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        if (await User.findOne({ username })) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword });
        await user.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// High score endpoints
app.get('/api/score', async (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    try {
        const { username } = jwt.verify(token, SECRET_KEY);
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ highScore: user.highScore });
    } catch (e) {
        console.error('Get score error:', e);
        res.status(403).json({ message: 'Invalid token' });
    }
});

app.post('/api/score', async (req, res) => {
    const token = req.headers['authorization'];
    const { score } = req.body;
    if (!token) return res.status(401).json({ message: 'No token provided' });
    try {
        const { username } = jwt.verify(token, SECRET_KEY);
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (score > user.highScore) {
            user.highScore = score;
            await user.save();
        }
        res.json({ highScore: user.highScore });
    } catch (e) {
        console.error('Post score error:', e);
        res.status(403).json({ message: 'Invalid token' });
    }
});

// WebSocket for multiplayer
io.on('connection', (socket) => {
    console.log('A player connected:', socket.id);

    socket.on('playerMove', (data) => {
        socket.broadcast.emit('opponentMove', { id: socket.id, x: data.x });
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        io.emit('opponentDisconnect', { id: socket.id });
    });
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});