document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const message = document.getElementById('message');

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('token', data.token);
            window.location.href = 'index.html';
        } else {
            message.textContent = data.message || 'Login failed';
        }
    } catch (err) {
        console.error('Login error:', err);
        message.textContent = 'An error occurred. Please try again.';
    }
});

document.getElementById('registerBtn').addEventListener('click', async () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const message = document.getElementById('message');

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        message.textContent = data.message || 'Registration failed';
        if (res.ok) {
            message.style.color = 'green';
        }
    } catch (err) {
        console.error('Register error:', err);
        message.textContent = 'An error occurred. Please try again.';
    }
});