// trackers/caffeine.js

let caffeineScore = 0;
const maxCaffeine = 1000; // Maximum mg displayed on mug

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
    document.getElementById('scoreValue').innerText = caffeineScore;
    document.getElementById('finalScoreInput').value = '';
    updateMugFill();
}

function saveCaffeine() {
    const finalScore = document.getElementById('finalScoreInput').value;
    if (finalScore) {
        caffeineScore = parseInt(finalScore);
        document.getElementById('scoreValue').innerText = caffeineScore;
        updateMugFill();
        // TODO: Save score to database or localStorage
        console.log('Caffeine score saved:', caffeineScore);
    }
}

function updateMugFill() {
    const fillPercentage = (caffeineScore / maxCaffeine) * 100;
    const mugMask = document.getElementById('mugClipRect');
    if (mugMask) {
        // inset(top right bottom left) - we want to clip from top, so top = (100% - fillPercentage)
        const insetTop = 100 - fillPercentage;
        const mugLiquid = document.querySelector('.mug-liquid');
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