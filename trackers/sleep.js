// trackers/sleep.js

let sleepInitialized = false;
let sleepData = [];

function formatTime(index) {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = (index % 2) * 30; // 0, 30 minutes
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function initSleepTracker() {
  if (sleepInitialized) return;
  sleepInitialized = true;

  const sleepGrid = document.getElementById("sleepGrid");
  if (!sleepGrid) return;

  sleepData = new Array(48).fill(false); // 24 hours * 2 slots per hour (30-min intervals)

  // Create 48 slots (exactly 24 hours in 30-minute intervals)
  for (let i = 0; i < 48; i++) {
    const slot = document.createElement("div");
    slot.className = "sleep-slot";

    const timeLabel = document.createElement("span");
    timeLabel.className = "sleep-slot-time";
    timeLabel.textContent = formatTime(i);

    slot.appendChild(timeLabel);
    slot.title = formatTime(i);

    const toggleSleepSlot = () => {
      sleepData[i] = !sleepData[i];
      slot.classList.toggle("asleep");
    };

    if (window.PointerEvent) {
      slot.addEventListener("pointerup", toggleSleepSlot);
    } else {
      slot.addEventListener("click", toggleSleepSlot);
    }

    sleepGrid.appendChild(slot);
  }
}

// Calculate sleep duration from sleepData array
function calculateSleepDuration() {
  if (!sleepData || sleepData.length === 0) return 0;

  // Count true values (each represents 30 minutes)
  const sleepSlots = sleepData.filter(slot => slot === true).length;

  // Convert to hours (2 slots = 1 hour)
  return sleepSlots / 2;
}

