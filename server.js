require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ['http://localhost:3000', 'https://car-dodge-game-alpha.vercel.app'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

const port = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/car-game';
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';
const EMAIL_USER = process.env.EMAIL_USER || 'your_email@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'your_email_password';

app.use(cors({
    origin: ['http://localhost:3000', 'https://car-dodge-game-alpha.vercel.app'],
    credentials: true
}));
app.use(express.static('public'));
app.use(express.json());

console.log('Attempting to connect to MongoDB...');
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
})
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err.message));

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
    highScore: { type: Number, default: 0 },
    otp: String,
    otpExpiresAt: Date
});
const User = mongoose.model('User', UserSchema);

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// LOGIN
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiresAt = Date.now() + 5 * 60 * 1000; // 5 mins
        await user.save();

        await transporter.sendMail({
            from: EMAIL_USER,
            to: user.username,
            subject: 'Your Car Dodge Game OTP',
            text: `Your OTP is: ${otp}`
        });

        res.json({ tempToken: jwt.sign({ username }, SECRET_KEY, { expiresIn: '5m' }) });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// VERIFY OTP
app.post('/api/verify-otp', async (req, res) => {
    const { otp, tempToken } = req.body;
    try {
        const { username } = jwt.verify(tempToken, SECRET_KEY);
        const user = await User.findOne({ username });

        if (!user || user.otp !== otp || user.otpExpiresAt < Date.now()) {
            return res.status(401).json({ message: 'Invalid or expired OTP' });
        }

        const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        console.error('OTP verification error:', err);
        res.status(403).json({ message: 'Invalid token or OTP' });
    }
});

// REGISTER
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

// GET SCORE
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

// POST SCORE
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

// SOCKET.IO MULTIPLAYER
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

// START SERVER
server.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
