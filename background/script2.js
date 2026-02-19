const words = ['⋆˚✿ ˖°♡₊˚', '/ᐠ - ˕-マ｡˚ᶻ', '*⸜( •ᴗ• )⸝*', '(╥_╥)', 'ヾ(·`⌓´·)ﾉﾞ', ' ་⁺₊♡', '⋆⭒˚｡⋆', 'happy', 'HAPPY', 'sad', 'SAD', 'cute!', 'the universe said i love you', 'the universe said you are love', 'everything you need is within you', 'i am safe', 'i am ME', 'i am protected by magic', '✶', '✧', '✧', '♡', '✩', '✩', '✶' ];
const colors = ['#EDB68C', '#F4E3B3', '#C5E6A8', '#A8E6D9', '#B7BEFA', '#C3A5F3','#E48BA6'];
const bgColors = ['#EDB68C', '#F4E3B3', '#C5E6A8', '#A8E6D9', '#B7BEFA', '#C3A5F3','#E48BA6'];
const recentYPositions = []; // Track recent Y positions to prevent overlaps
const positionMemoryTime = 2000; // Remember positions for 2 seconds
let isTransitioning = false; // Flag for page transition animation

// Environment / accessibility flags
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function isMobileViewport() {
    return /Mobi|Android|iPhone|iPad/.test(navigator.userAgent) || window.innerWidth <= 768;
}

function getAvailableYPosition() {
    const minSpacing = 80; // Minimum pixels between words
    let attempts = 0;
    let randomY;
    let isValid = false;

    while (!isValid && attempts < 10) {
        randomY = Math.random() * (window.innerHeight - 80);
        isValid = true;

        // Check if this position conflicts with recent spawns
        for (let pos of recentYPositions) {
            if (Math.abs(randomY - pos) < minSpacing) {
                isValid = false;
                break;
            }
        }
        attempts++;
    }

    // Add to recent positions
    recentYPositions.push(randomY);
    if (recentYPositions.length > 8) {
        recentYPositions.shift();
    }

    return randomY;
}

function createWord() {
    const background = document.getElementById('background');
    if (!background) return;
    const isMobile = isMobileViewport();

    const word = document.createElement('div');
    word.classList.add('word');

    const randomWord = words[Math.floor(Math.random() * words.length)];
    word.textContent = randomWord;

    // Set random font size. Use smaller sizes on mobile for performance
    const baseSize = isMobile ? 12 : 16;
    const sizeVariance = isMobile ? 10 : 30;
    word.style.fontSize = `${Math.random() * sizeVariance + baseSize}px`;

    // Randomly pick italic or normal, and occasionally make bold
    const fontStyleOptions = ['normal', 'italic'];
    word.style.fontStyle = fontStyleOptions[Math.floor(Math.random() * fontStyleOptions.length)];
    word.style.fontWeight = Math.random() < 0.28 ? '700' : '400';

    // Optionally give the word a colorful background
    if (Math.random() < 0.30) { // ~30% of words get a colored background
        const bg = bgColors[Math.floor(Math.random() * bgColors.length)];
        word.classList.add('bg');
        word.style.backgroundColor = bg;
        word.style.color = '#14141f';
    } else {
        // Set random color for text
        word.style.color = colors[Math.floor(Math.random() * colors.length)];
    }

    // Position the word randomly on the Y axis, avoiding overlaps
    const randomY = getAvailableYPosition();
    word.style.top = `${randomY}px`;

    // Randomly decide if word starts from left or random position
    let startPosition;
    if (Math.random() < 0.5) {
        // 50% start from left edge
        startPosition = '-12vw';
    } else {
        // 50% start from random position
        startPosition = `${Math.random() * 60 - 12}vw`;
    }
    word.style.left = startPosition;
    // Use translate3d for GPU acceleration
    word.style.transform = 'translate3d(0,0,0)';
    word.style.willChange = 'transform, opacity';

    background.appendChild(word);


    // Randomize duration (in seconds). Shorter on mobile to reduce element lifetime
    const duration = (Math.random() * (isMobile ? 2 : 3) + (isMobile ? 6 : 9)).toFixed(2);

    // Favor the end-reaching animation for most words - linear for subtler ease
    if (Math.random() < 0.35) { // 35% have gradient fade-in
        word.style.animation = `moveWithFadeIn ${duration}s linear forwards`;
    } else if (Math.random() < 0.6) { // 60% reach the end
        word.style.animation = `moveToEnd ${duration}s linear forwards`;
    } else {
        word.style.animation = `move ${duration}s linear forwards`;
    }

    // Don't force-opacity via JS; let CSS animation control visual states to avoid layout thrash.

    // Remove word after animation
    word.addEventListener('animationend', () => {
        word.remove();
    });
}

function speedUpAndFadeWords() {
    isTransitioning = true;
    clearInterval(wordInterval); // Stop creating new words
    const allWords = document.querySelectorAll('.word');
    // Let words continue their animations but make them fade out
    allWords.forEach(word => {
        word.style.transition = 'opacity 2.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        word.style.opacity = 0;
    });
}

// Create words at intervals (two words spawn together)
// Respect reduced motion preference by not spawning animated words
let wordInterval = null;
function startWordInterval() {
    if (prefersReducedMotion || wordInterval) return;

    wordInterval = setInterval(() => {
        createWord();
        createWord();
    }, 900);
}

startWordInterval();

// Export function for HTML to use
window.speedUpAndFadeWords = speedUpAndFadeWords;
window.stopWordCreation = () => {
    clearInterval(wordInterval);
    wordInterval = null;
};
window.resumeWordCreation = () => {
    // Restart with the appropriate spawn rate, but never duplicate intervals
    startWordInterval();
};

// Pause animations when the page is hidden to save battery
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        clearInterval(wordInterval);
        wordInterval = null;
    } else if (!wordInterval && !prefersReducedMotion) {
        startWordInterval();
    }
});

// If user prefers reduced motion, clear existing words and stop creating new ones
if (prefersReducedMotion) {
    clearInterval(wordInterval);
    wordInterval = null;
    // Show any existing words statically and remove animations
    document.querySelectorAll('.word').forEach(w => {
        w.style.animation = 'none';
        w.style.opacity = 1;
        w.style.transform = 'none';
    });
}

