// trackers/caffeine.js

let caffeineScore = 0;
const maxCaffeine = 1000; // Maximum mg displayed on mug
let isLiquidPink = false; // Track if liquid is pink

function addCaffeine(amount) {
    if (caffeineScore < maxCaffeine) {
        caffeineScore = Math.min(caffeineScore + amount, maxCaffeine);
        document.getElementById('scoreValue').innerText = caffeineScore;
        document.getElementById('finalScoreInput').value = caffeineScore;
        updateMugFill();
    }
}

function resetCaffeine() {
    caffeineScore = 0;
    isLiquidPink = false;
    document.getElementById('scoreValue').innerText = caffeineScore;
    document.getElementById('finalScoreInput').value = '';
    updateMugFill();
    // Reset liquid color to blue
    const mugLiquid = document.querySelector('.mug-liquid');
    if (mugLiquid) {
        mugLiquid.style.fill = '#8DB8DC';
    }
}

function saveCaffeine() {
    const finalScore = document.getElementById('finalScoreInput').value;
    if (finalScore) {
        caffeineScore = parseInt(finalScore);
        document.getElementById('scoreValue').innerText = caffeineScore;
        updateMugFill();
        // Change liquid to pink
        isLiquidPink = true;
        const mugLiquid = document.querySelector('.mug-liquid');
        if (mugLiquid) {
            mugLiquid.style.fill = '#EDBFE7';
        }
        // TODO: Save score to database or localStorage
        console.log('Caffeine score saved:', caffeineScore);
    }
}

function updateMugFill() {
    const fillPercentage = (caffeineScore / maxCaffeine) * 100;
    const mugLiquid = document.querySelector('.mug-liquid');
    if (mugLiquid) {
        const insetTop = 100 - fillPercentage;
        mugLiquid.style.clipPath = `inset(${insetTop}% 0 0 0)`;
    }
}

// Allow manual input to update the mug
document.addEventListener('DOMContentLoaded', function() {
    const finalScoreInput = document.getElementById('finalScoreInput');
    
    if (finalScoreInput) {
        finalScoreInput.addEventListener('input', function(e) {
            const value = parseInt(this.value) || 0;
            if (value >= 0 && value <= maxCaffeine * 2) {
                caffeineScore = value;
                document.getElementById('scoreValue').innerText = caffeineScore;
                updateMugFill();
            }
        });
    }
});