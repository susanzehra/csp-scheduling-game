"use strict";

const welcomeScreen = document.querySelector("#welcomeScreen");
const gameScreen = document.querySelector("#gameScreen");
const successScreen = document.querySelector("#successScreen");
const nameForm = document.querySelector("#nameForm");
const studentNameInput = document.querySelector("#studentName");
const nameError = document.querySelector("#nameError");
const playerName = document.querySelector("#playerName");
const timerDisplay = document.querySelector("#timer");
const attemptCount = document.querySelector("#attemptCount");
const employeeBank = document.querySelector("#employeeBank");
const shiftSlots = [...document.querySelectorAll(".shift-slot")];
const employeeCards = [...document.querySelectorAll(".employee-card")];
const feedback = document.querySelector("#feedback");
const checkButton = document.querySelector("#checkButton");
const resetButton = document.querySelector("#resetButton");

let activeCard = null;
let selectedCard = null;
let startTime = null;
let timerInterval = null;
let checks = 0;
let studentName = "";

function cleanName(value) {
  return value.replace(/\s+/g, " ").trim();
}

function formatElapsed(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateTimer() {
  if (startTime) timerDisplay.textContent = formatElapsed(Date.now() - startTime);
}

nameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  studentName = cleanName(studentNameInput.value);
  if (studentName.length < 2) {
    nameError.textContent = "Please enter your name before starting.";
    studentNameInput.focus();
    return;
  }

  nameError.textContent = "";
  playerName.textContent = studentName;
  welcomeScreen.hidden = true;
  gameScreen.hidden = false;
  startTime = Date.now();
  timerInterval = window.setInterval(updateTimer, 1000);
  updateTimer();
});

function getCardFromEvent(event) {
  const employee = event.dataTransfer?.getData("text/plain");
  return employee ? document.querySelector(`[data-employee="${employee}"]`) : activeCard;
}

function updateSlotAppearance() {
  shiftSlots.forEach((slot) => {
    const content = slot.querySelector(".slot-content");
    const card = content.querySelector(".employee-card");
    slot.classList.toggle("filled", Boolean(card));
    if (!card) content.textContent = "Drop employee here";
  });
}

function moveCard(card, destination) {
  if (!card || !destination) return;

  if (destination.classList.contains("shift-slot")) {
    const destinationContent = destination.querySelector(".slot-content");
    const existing = destinationContent.querySelector(".employee-card");
    if (existing && existing !== card) {
      const sourceSlot = card.closest(".shift-slot");
      if (sourceSlot) sourceSlot.querySelector(".slot-content").append(existing);
      else employeeBank.querySelector(".bank-cards").append(existing);
    }
    destinationContent.textContent = "";
    destinationContent.append(card);
  } else {
    employeeBank.querySelector(".bank-cards").append(card);
  }

  selectedCard?.classList.remove("selected");
  selectedCard = null;
  updateSlotAppearance();
  clearRuleMarks();
  setFeedback("Schedule changed. Check it when all four shifts are filled.", "");
}

employeeCards.forEach((card) => {
  card.addEventListener("dragstart", (event) => {
    activeCard = card;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", card.dataset.employee);
  });
  card.addEventListener("dragend", () => { activeCard = null; });
  card.addEventListener("click", (event) => {
    event.stopPropagation();
    employeeCards.forEach((item) => item.classList.remove("selected"));
    selectedCard = selectedCard === card ? null : card;
    selectedCard?.classList.add("selected");
  });
});

[...shiftSlots, employeeBank].forEach((zone) => {
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("drag-over");
    moveCard(getCardFromEvent(event), zone);
  });
  zone.addEventListener("click", () => {
    if (selectedCard) moveCard(selectedCard, zone);
  });
});

function getAssignments() {
  const assignments = {};
  shiftSlots.forEach((slot) => {
    const card = slot.querySelector(".employee-card");
    if (card) assignments[card.dataset.employee] = Number(slot.dataset.shift);
  });
  return assignments;
}

function evaluate(assignments) {
  const complete = Object.keys(assignments).length === 4;
  return {
    complete,
    A: complete && [2, 3].includes(assignments.A),
    C: complete && assignments.C + 1 === assignments.A,
    D: complete && assignments.D < assignments.A,
    B: complete && Math.abs(assignments.B - assignments.D) > 1
  };
}

function clearRuleMarks() {
  document.querySelectorAll("#constraintList li").forEach((item) => {
    item.classList.remove("valid", "invalid");
    item.querySelector(".rule-icon").textContent = "○";
  });
}

function showRuleMarks(results) {
  Object.entries(results).forEach(([rule, passed]) => {
    const item = document.querySelector(`[data-rule="${rule}"]`);
    item.classList.add(passed ? "valid" : "invalid");
    item.querySelector(".rule-icon").textContent = passed ? "✓" : "✕";
  });
}

function setFeedback(message, type) {
  feedback.textContent = message;
  feedback.className = `feedback${type ? ` ${type}` : ""}`;
}

checkButton.addEventListener("click", () => {
  checks += 1;
  attemptCount.textContent = String(checks);
  const assignments = getAssignments();
  const results = evaluate(assignments);
  clearRuleMarks();
  showRuleMarks(results);

  if (!results.complete) {
    setFeedback("The assignment is incomplete. Place one employee in every shift, then check again.", "error");
    return;
  }

  const failedRules = Object.entries(results).filter(([, passed]) => !passed).map(([rule]) => rule);
  if (failedRules.length) {
    setFeedback(`Not consistent yet. ${failedRules.length} constraint${failedRules.length > 1 ? "s are" : " is"} violated. Use the red rule marker${failedRules.length > 1 ? "s" : ""} as a hint and revise the schedule.`, "error");
    return;
  }

  setFeedback("Excellent—your assignment is complete and consistent!", "good");
  window.setTimeout(() => showSuccess(assignments), 600);
});

function resetSchedule() {
  employeeCards.forEach((card) => employeeBank.querySelector(".bank-cards").append(card));
  employeeCards.forEach((card) => card.classList.remove("selected"));
  selectedCard = null;
  updateSlotAppearance();
  clearRuleMarks();
  setFeedback("Assign all four employees, then check your schedule.", "");
}

resetButton.addEventListener("click", resetSchedule);

function showSuccess(assignments) {
  window.clearInterval(timerInterval);
  const elapsed = Date.now() - startTime;
  const completedAt = new Date();
  const scheduleByShift = Object.entries(assignments)
    .sort(([, shiftA], [, shiftB]) => shiftA - shiftB)
    .map(([employee, shift]) => `${employee}→${shift}`)
    .join(", ");

  document.querySelector("#certificateName").textContent = studentName;
  document.querySelector("#completionDate").textContent = completedAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  document.querySelector("#completionTime").textContent = formatElapsed(elapsed);
  document.querySelector("#finalSchedule").textContent = scheduleByShift;
  gameScreen.hidden = true;
  successScreen.hidden = false;
  successScreen.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.querySelector("#printButton").addEventListener("click", () => window.print());
document.querySelector("#playAgainButton").addEventListener("click", () => {
  resetSchedule();
  checks = 0;
  attemptCount.textContent = "0";
  startTime = Date.now();
  timerInterval = window.setInterval(updateTimer, 1000);
  successScreen.hidden = true;
  gameScreen.hidden = false;
  updateTimer();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

updateSlotAppearance();
