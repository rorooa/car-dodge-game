const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('highScore');
const restartBtn = document.getElementById('restartBtn');

// Create and style back button
const backBtn = document.createElement('button');
backBtn.textContent = 'Back';
backBtn.id = 'backBtn';
backBtn.style.marginLeft = '10px';
backBtn.style.display = 'none';
document.body.appendChild(backBtn);

canvas.width = 400;
canvas.height = 600;

const token = localStorage.getItem('token');
if (!token) window.location.href = 'login.html';

// Assets
const carImg = new Image();
carImg.src = 'assets/car.png';
const obstacleImg = new Image();
obstacleImg.src = 'assets/obstacle.png';
const engineSound = new Audio('assets/engine.mp3');
engineSound.loop = true;
const crashSound = new Audio('assets/crash.mp3');

// Game variables
const car = { x: canvas.width / 2 - 25, y: canvas.height - 100, width: 50, height: 80, speed: 15 };
let obstacles = [];
let opponents = {};
let score = 0;
let highScore = 0;
let gameOver = false;
let roadY = 0;

// WebSocket setup
const socket = io();
socket.on('opponentMove', (data) => {
    opponents[data.id] = { x: data.x, y: canvas.height - 100 };
});
socket.on('opponentDisconnect', (data) => {
    delete opponents[data.id];
});

// Load initial high score with error handling
fetch('/api/score', { headers: { 'Authorization': token } })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
    })
    .then(data => {
        highScore = data.highScore || 0;
        highScoreDisplay.textContent = `High Score: ${highScore}`;
    })
    .catch(err => {
        console.error('Error fetching high score:', err);
        if (err.message.includes('401') || err.message.includes('403')) {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
        }
    });

// Controls
document.addEventListener('keydown', (e) => {
    if (gameOver) return;
    if (e.key === 'ArrowLeft' && car.x > 50) {
        car.x -= car.speed;
        socket.emit('playerMove', { x: car.x });
    }
    if (e.key === 'ArrowRight' && car.x < canvas.width - car.width - 50) {
        car.x += car.speed;
        socket.emit('playerMove', { x: car.x });
    }
});

// Obstacle spawning
function spawnObstacle() {
    if (Math.random() < 0.005) { // Reduced obstacle frequency
        const width = 50;
        const x = 50 + Math.random() * (canvas.width - 100 - width);
        obstacles.push({ x, y: -50, width, height: 50 });
    }
}

// Collision detection
function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
}

// Game loop
function gameLoop() {
    if (gameOver) {
        restartBtn.style.display = 'block';
        backBtn.style.display = 'inline-block';
        engineSound.pause();
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw moving road
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'gray';
    ctx.fillRect(50, 0, canvas.width - 100, canvas.height);
    ctx.fillStyle = 'white';
    for (let i = 0; i < 10; i++) {
        const y = (roadY + i * 100) % canvas.height;
        ctx.fillRect(canvas.width / 2 - 5, y, 10, 50);
    }
    roadY = (roadY + 3) % 100;

    // Draw car
    if (carImg.complete && carImg.naturalWidth !== 0) {
        ctx.drawImage(carImg, car.x, car.y, car.width, car.height);
    }

    // Draw opponents
    Object.values(opponents).forEach(opponent => {
        if (carImg.complete && carImg.naturalWidth !== 0) {
            ctx.drawImage(carImg, opponent.x, opponent.y, car.width, car.height);
        }
    });

    // Update obstacles
    spawnObstacle();
    obstacles.forEach((obstacle, index) => {
        obstacle.y += 1.5;
        if (obstacleImg.complete && obstacleImg.naturalWidth !== 0) {
            ctx.drawImage(obstacleImg, obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        }

        if (checkCollision(car, obstacle)) {
            gameOver = true;
            crashSound.play().catch(err => console.error('Crash sound error:', err));
            if (score > highScore) {
                highScore = score;
                fetch('/api/score', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify({ score })
                })
                .catch(err => console.error('Error updating high score:', err));
            }
            return;
        }

        if (obstacle.y > canvas.height) {
            obstacles.splice(index, 1);
            score += 10;
            scoreDisplay.textContent = `Score: ${score}`;
            highScoreDisplay.textContent = `High Score: ${highScore}`;
        }
    });

    if (!gameOver) {
        engineSound.play().catch(err => console.error('Engine sound error:', err));
    }
    requestAnimationFrame(gameLoop);
}

// Start game when assets are loaded
Promise.all([
    new Promise(resolve => carImg.onload = resolve),
    new Promise(resolve => obstacleImg.onload = resolve)
]).then(() => gameLoop()).catch(err => console.error('Asset loading error:', err));

restartBtn.addEventListener('click', () => {
    gameOver = false;
    score = 0;
    obstacles = [];
    scoreDisplay.textContent = `Score: ${score}`;
    restartBtn.style.display = 'none';
    backBtn.style.display = 'none';
    engineSound.currentTime = 0;
    gameLoop();
});

backBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
});
