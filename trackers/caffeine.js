// trackers/caffeine.js

let caffeineScore = 0;
const maxCaffeine = 1000; // Maximum mg displayed on mug
let isLiquidPink = false; // Track if liquid is pink

function setCaffeineDoneState(done) {
    isLiquidPink = !!done;
    const mugLiquid = document.querySelector('.mug-liquid');
    const floatingStars = document.querySelectorAll('.floating-star');
    if (mugLiquid) {
        mugLiquid.classList.toggle('done', !!done);
    }
    floatingStars.forEach(star => {
        star.classList.toggle('done', !!done);
    });
}

function setCaffeineScoreValue(value, done) {
    const parsed = Number(value);
    caffeineScore = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    const scoreEl = document.getElementById('scoreValue');
    const finalInput = document.getElementById('finalScoreInput');
    if (scoreEl) scoreEl.innerText = caffeineScore;
    if (finalInput) finalInput.value = caffeineScore > 0 ? String(caffeineScore) : '';
    updateMugFill();
    setCaffeineDoneState(done);
}

function addCaffeine(amount) {
    if (caffeineScore < maxCaffeine) {
        caffeineScore = Math.min(caffeineScore + amount, maxCaffeine);
        document.getElementById('scoreValue').innerText = caffeineScore;
        document.getElementById('finalScoreInput').value = caffeineScore;
        updateMugFill();
        if (typeof window.queueSymptomAutosave === 'function') window.queueSymptomAutosave();
    }
}

function resetCaffeine() {
    setCaffeineScoreValue(0, false);
    if (typeof window.queueSymptomAutosave === 'function') window.queueSymptomAutosave();
}

function saveCaffeine() {
    const finalScore = document.getElementById('finalScoreInput').value;
    if (finalScore) {
        setCaffeineScoreValue(parseInt(finalScore, 10), true);
        if (typeof window.queueSymptomAutosave === 'function') window.queueSymptomAutosave();
        console.log('Caffeine score saved:', caffeineScore);
    }
}

function updateMugFill() {
    const fillPercentage = Math.max(0, Math.min(100, (caffeineScore / maxCaffeine) * 100));
    const mugLiquid = document.querySelector('.mug-liquid');
    if (mugLiquid) {
        const insetTop = 100 - fillPercentage;
        const insetValue = `inset(${insetTop}% 0 0 0)`;
        mugLiquid.style.clipPath = insetValue;
        mugLiquid.style.webkitClipPath = insetValue;
    }
}

// Allow manual input to update the mug
document.addEventListener('DOMContentLoaded', function() {
    const finalScoreInput = document.getElementById('finalScoreInput');
    
    if (finalScoreInput) {
        finalScoreInput.addEventListener('input', function(e) {
            const value = parseInt(this.value) || 0;
            if (value >= 0 && value <= maxCaffeine * 2) {
                setCaffeineScoreValue(value, isLiquidPink);
                if (typeof window.queueSymptomAutosave === 'function') window.queueSymptomAutosave();
            }
        });
    }
});

window.setCaffeineScoreValue = setCaffeineScoreValue;
