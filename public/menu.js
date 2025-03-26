const token = localStorage.getItem('token');
if (!token) window.location.href = 'login.html';

fetch('/api/score', {
    headers: { 'Authorization': token }
})
    .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
    })
    .then(data => {
        document.getElementById('highScore').textContent = `High Score: ${data.highScore || 0}`;
    })
    .catch(err => {
        console.error('Error fetching high score:', err);
        if (err.message.includes('401') || err.message.includes('403')) {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
        }
    });

document.getElementById('startBtn').addEventListener('click', () => {
    window.location.href = 'game.html';
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
});