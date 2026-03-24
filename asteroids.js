const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const highScoreEl = document.getElementById('highScore');
const finalScoreEl = document.getElementById('finalScore');
const gameOverTitle = document.getElementById('gameOverTitle');
const highScoreText = document.getElementById('highScoreText');

let gameRunning = false;
let gamePaused = false;
let score = 0;
let lives = 3;
let level = 1;
let highScore = localStorage.getItem('asteroids_highscore') || 0;
highScoreEl.innerText = highScore;

// Audio context for sound effects
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

// Sound effects
function playSound(type) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'shoot') {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'explosion') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'thrust') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(100, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'gameover') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
        oscillator.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 1);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 1);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 1);
    }
}

// Player ship
const ship = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 20,
    angle: 0,
    thrusting: false,
    thrustSpeed: 0.5,
    rotationSpeed: 0.08,
    friction: 0.99,
    vx: 0,
    vy: 0,
    invulnerable: false,
    invulnerableTime: 0
};

let asteroids = [];
let bullets = [];
let particles = [];
let stars = [];

// Initialize stars
function initStars() {
    stars = [];
    for (let i = 0; i < 150; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 0.5,
            alpha: Math.random() * 0.5 + 0.3,
            twinkle: Math.random() * 0.02
        });
    }
}

// Draw stars with twinkle effect
function drawStars() {
    ctx.fillStyle = '#fff';
    stars.forEach(star => {
        ctx.globalAlpha = star.alpha + Math.sin(Date.now() * star.twinkle) * 0.2;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

// Create explosion particles
function createExplosion(x, y, color, count = 15) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 1,
            color: color,
            size: Math.random() * 3 + 2
        });
    }
}

// Update and draw particles
function updateParticles() {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

// Draw ship
function drawShip() {
    if (ship.invulnerable && Math.floor(Date.now() / 100) % 2 === 0) return;
    
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);
    
    // Ship body - bright cyan
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-15, 10);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-15, -10);
    ctx.closePath();
    ctx.stroke();
    
    // Thrust flame
    if (ship.thrusting) {
        ctx.strokeStyle = '#f80';
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(-25, 0);
        ctx.stroke();
    }
    
    ctx.restore();
}

// Create asteroid
function createAsteroid(x, y, size) {
    const vertices = [];
    const numVertices = 8 + Math.floor(Math.random() * 5);
    
    for (let i = 0; i < numVertices; i++) {
        const angle = (i / numVertices) * Math.PI * 2;
        const radius = size * (0.7 + Math.random() * 0.3);
        vertices.push({
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius
        });
    }
    
    return {
        x: x,
        y: y,
        size: size,
        vx: (Math.random() - 0.5) * 2 * (3 - size) / 3,
        vy: (Math.random() - 0.5) * 2 * (3 - size) / 3,
        vertices: vertices,
        angle: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.05,
        color: `hsl(${Math.random() * 60 + 200}, 70%, 50%)`
    };
}

// Draw asteroid
function drawAsteroid(asteroid) {
    ctx.save();
    ctx.translate(asteroid.x, asteroid.y);
    ctx.rotate(asteroid.angle);
    
    ctx.strokeStyle = asteroid.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(asteroid.vertices[0].x, asteroid.vertices[0].y);
    for (let i = 1; i < asteroid.vertices.length; i++) {
        ctx.lineTo(asteroid.vertices[i].x, asteroid.vertices[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    
    // Add inner glow
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.restore();
}

// Draw bullets
function drawBullets() {
    ctx.fillStyle = '#f0f';
    bullets.forEach(bullet => {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow effect
        ctx.fillStyle = `rgba(255, 0, 255, ${0.5 * bullet.life})`;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f0f';
    });
}

// Spawn asteroids
function spawnAsteroids() {
    asteroids = [];
    const numAsteroids = 3 + level * 2;
    
    for (let i = 0; i < numAsteroids; i++) {
        let x, y;
        do {
            x = Math.random() * canvas.width;
            y = Math.random() * canvas.height;
        } while (Math.hypot(x - ship.x, y - ship.y) < 150);
        
        asteroids.push(createAsteroid(x, y, 3));
    }
}

// Check collision between two objects
function checkCollision(obj1, obj2, radius1, radius2) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    const distance = Math.hypot(dx, dy);
    return distance < radius1 + radius2;
}

// Update game state
function update() {
    // Ship movement
    if (ship.thrusting) {
        ship.vx += Math.cos(ship.angle) * ship.thrustSpeed;
        ship.vy += Math.sin(ship.angle) * ship.thrustSpeed;
    }
    
    ship.vx *= ship.friction;
    ship.vy *= ship.friction;
    ship.x += ship.vx;
    ship.y += ship.vy;
    
    // Wrap around screen
    if (ship.x < 0) ship.x = canvas.width;
    if (ship.x > canvas.width) ship.x = 0;
    if (ship.y < 0) ship.y = canvas.height;
    if (ship.y > canvas.height) ship.y = 0;
    
    // Update invulnerability
    if (ship.invulnerable) {
        ship.invulnerableTime--;
        if (ship.invulnerableTime <= 0) {
            ship.invulnerable = false;
        }
    }
    
    // Update asteroids
    asteroids.forEach(asteroid => {
        asteroid.x += asteroid.vx;
        asteroid.y += asteroid.vy;
        asteroid.angle += asteroid.rotationSpeed;
        
        // Wrap around screen
        if (asteroid.x < -asteroid.size) asteroid.x = canvas.width + asteroid.size;
        if (asteroid.x > canvas.width + asteroid.size) asteroid.x = -asteroid.size;
        if (asteroid.y < -asteroid.size) asteroid.y = canvas.height + asteroid.size;
        if (asteroid.y > canvas.height + asteroid.size) asteroid.y = -asteroid.size;
    });
    
    // Update bullets
    bullets = bullets.filter(bullet => bullet.life > 0);
    bullets.forEach(bullet => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        bullet.life--;
        
        // Wrap around screen
        if (bullet.x < 0) bullet.x = canvas.width;
        if (bullet.x > canvas.width) bullet.x = 0;
        if (bullet.y < 0) bullet.y = canvas.height;
        if (bullet.y > canvas.height) bullet.y = 0;
    });
    
    // Check bullet-asteroid collisions
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = asteroids.length - 1; j >= 0; j--) {
            if (checkCollision(bullets[i], asteroids[j], 3, asteroids[j].size * 8)) {
                playSound('explosion');
                createExplosion(asteroids[j].x, asteroids[j].y, asteroids[j].color, 20);
                
                // Split asteroid if large enough
                if (asteroids[j].size > 1) {
                    for (let k = 0; k < 2; k++) {
                        asteroids.push(createAsteroid(asteroids[j].x, asteroids[j].y, asteroids[j].size - 1));
                    }
                }
                
                score += asteroids[j].size * 100;
                scoreEl.innerText = score;
                asteroids.splice(j, 1);
                bullets.splice(i, 1);
                break;
            }
        }
    }
    
    // Check ship-asteroid collisions
    if (!ship.invulnerable) {
        for (let asteroid of asteroids) {
            if (checkCollision(ship, asteroid, 10, asteroid.size * 8)) {
                playSound('explosion');
                createExplosion(ship.x, ship.y, '#0ff', 30);
                lives--;
                livesEl.innerText = lives;
                
                if (lives <= 0) {
                    gameOver();
                    return;
                } else {
                    ship.invulnerable = true;
                    ship.invulnerableTime = 180;
                    ship.x = canvas.width / 2;
                    ship.y = canvas.height / 2;
                    ship.vx = 0;
                    ship.vy = 0;
                }
                break;
            }
        }
    }
    
    // Check level complete
    if (asteroids.length === 0) {
        level++;
        levelEl.innerText = level;
        spawnAsteroids();
    }
}

// Fire bullet
function fireBullet() {
    if (bullets.length < 10) {
        playSound('shoot');
        bullets.push({
            x: ship.x + Math.cos(ship.angle) * 20,
            y: ship.y + Math.sin(ship.angle) * 20,
            vx: Math.cos(ship.angle) * 10,
            vy: Math.sin(ship.angle) * 10,
            life: 60
        });
    }
}

// Main game loop
function gameLoop() {
    if (!gameRunning || gamePaused) return;
    
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    drawStars();
    
    // Update and draw game objects
    update();
    drawShip();
    
    asteroids.forEach(drawAsteroid);
    drawBullets();
    updateParticles();
    
    if (gameRunning && !gamePaused) {
        requestAnimationFrame(gameLoop);
    }
}

// Start game
function startGame() {
    score = 0;
    lives = 3;
    level = 1;
    scoreEl.innerText = score;
    livesEl.innerText = lives;
    levelEl.innerText = level;
    
    ship.x = canvas.width / 2;
    ship.y = canvas.height / 2;
    ship.vx = 0;
    ship.vy = 0;
    ship.angle = 0;
    ship.invulnerable = true;
    ship.invulnerableTime = 180;
    
    bullets = [];
    particles = [];
    
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    
    initStars();
    spawnAsteroids();
    
    gameRunning = true;
    gamePaused = false;
    gameLoop();
}

// Game over
function gameOver() {
    playSound('gameover');
    gameRunning = false;
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('asteroids_highscore', highScore);
        highScoreEl.innerText = highScore;
        gameOverTitle.innerText = 'NEW HIGH SCORE!';
        highScoreText.innerText = `You set a new high score of ${score}!`;
    } else {
        gameOverTitle.innerText = 'GAME OVER';
        highScoreText.innerText = `High Score: ${highScore}`;
    }
    
    finalScoreEl.innerText = score;
    gameOverScreen.style.display = 'block';
}

// Event listeners
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
        ship.angle -= ship.rotationSpeed;
    } else if (e.key === 'ArrowRight') {
        ship.angle += ship.rotationSpeed;
    } else if (e.key === 'ArrowUp') {
        ship.thrusting = true;
    } else if (e.key === ' ') {
        e.preventDefault();
        fireBullet();
    } else if (e.key === 'p' || e.key === 'P') {
        gamePaused = !gamePaused;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp') {
        ship.thrusting = false;
    }
});

// Initialize
initStars();
spawnAsteroids();
drawStars();
asteroids.forEach(drawAsteroid);
