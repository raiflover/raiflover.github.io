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
        if (typeof window.queueSymptomAutosave === 'function') window.queueSymptomAutosave();
    }
}

function resetCaffeine() {
    caffeineScore = 0;
    isLiquidPink = false;
    document.getElementById('scoreValue').innerText = caffeineScore;
    document.getElementById('finalScoreInput').value = '';
    updateMugFill();
    if (typeof window.queueSymptomAutosave === 'function') window.queueSymptomAutosave();
    
    // Reset liquid and stars to pink (remove done class)
    const mugLiquid = document.querySelector('.mug-liquid');
    const floatingStars = document.querySelectorAll('.floating-star');
    if (mugLiquid) {
        mugLiquid.classList.remove('done');
    }
    floatingStars.forEach(star => {
        star.classList.remove('done');
    });
}

function saveCaffeine() {
    const finalScore = document.getElementById('finalScoreInput').value;
    if (finalScore) {
        caffeineScore = parseInt(finalScore);
        document.getElementById('scoreValue').innerText = caffeineScore;
        updateMugFill();
        
        // Change liquid to yellow with glowing stars when done
        isLiquidPink = true;
        const mugLiquid = document.querySelector('.mug-liquid');
        const floatingStars = document.querySelectorAll('.floating-star');
        if (mugLiquid) {
            mugLiquid.classList.add('done');
        }
        floatingStars.forEach(star => {
            star.classList.add('done');
        });
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
                caffeineScore = value;
                document.getElementById('scoreValue').innerText = caffeineScore;
                updateMugFill();
                if (typeof window.queueSymptomAutosave === 'function') window.queueSymptomAutosave();
            }
        });
    }
});
