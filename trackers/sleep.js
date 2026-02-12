// trackers/sleep.js

let sleepInitialized = false;
let sleepData = [];

function formatTime(index) {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
}

function initSleepTracker() {
  if (sleepInitialized) return;
  sleepInitialized = true;

  const sleepGrid = document.getElementById("sleepGrid");
  if (!sleepGrid) return;

  sleepData = new Array(48).fill(false);

  for (let i = 0; i < 48; i++) {
    const slot = document.createElement("div");
    slot.className = "sleep-slot";
    slot.title = formatTime(i);

    slot.addEventListener("click", () => {
      sleepData[i] = !sleepData[i];
      slot.classList.toggle("asleep");
    });

    sleepGrid.appendChild(slot);
  }
}

