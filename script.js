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
const visitCount = document.querySelector("#visitCount");
const playCount = document.querySelector("#playCount");
const recordStatus = document.querySelector("#recordStatus");
const config = window.CSP_GAME_CONFIG || {};

let activeCard = null;
let selectedCard = null;
let startTime = null;
let timerInterval = null;
let checks = 0;
let studentName = "";

function apiConfigured() {
  return typeof config.API_BASE_URL === "string" &&
    config.API_BASE_URL.startsWith("https://") &&
    !config.API_BASE_URL.includes("PASTE_YOUR");
}

function getVisitorId() {
  const key = "csp-game-anonymous-visitor";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

async function apiRequest(path, options = {}) {
  if (!apiConfigured()) throw new Error("Tracking is not configured yet.");
  const response = await fetch(`${config.API_BASE_URL.replace(/\/$/, "")}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`Tracking request failed (${response.status}).`);
  return response.json();
}

async function refreshStats() {
  try {
    const stats = await apiRequest("/stats");
    visitCount.textContent = Number(stats.visitors).toLocaleString();
    playCount.textContent = Number(stats.completions).toLocaleString();
  } catch {
    visitCount.textContent = "—";
    playCount.textContent = "—";
  }
}

async function recordVisit() {
  try {
    await apiRequest("/visit", {
      method: "POST",
      body: JSON.stringify({ visitorId: getVisitorId() })
    });
    await refreshStats();
  } catch {
    await refreshStats();
  }
}

function pemToArrayBuffer(pem) {
  const clean = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, "");
  if (!clean || clean.includes("PASTE_YOUR")) throw new Error("Encryption key is not configured.");
  const binary = atob(clean);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
}

async function encryptCompletion(record) {
  const publicKey = await crypto.subtle.importKey(
    "spki",
    pemToArrayBuffer(config.PUBLIC_KEY_PEM || ""),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
  const aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(record));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, plaintext);
  const wrappedKey = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, rawAesKey);

  const toBase64 = (value) => {
    let binary = "";
    new Uint8Array(value).forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  };
  const encryptedPackage = JSON.stringify({
    version: 1,
    algorithm: "RSA-OAEP-3072/AES-256-GCM",
    wrappedKey: toBase64(wrappedKey),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext)
  });
  return btoa(encryptedPackage);
}

async function saveEncryptedCompletion(record) {
  const encryptedRecord = await encryptCompletion(record);
  return apiRequest("/complete", {
    method: "POST",
    body: JSON.stringify({
      completionId: crypto.randomUUID(),
      encryptedRecord
    })
  });
}

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
  recordVisit();
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
  setFeedback("Schedule changed. Check it when all five shifts are filled.", "");
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
  const complete = Object.keys(assignments).length === 5;
  return {
    complete,
    A: complete && [2, 3, 4].includes(assignments.A),
    C: complete && assignments.C + 1 === assignments.A,
    D: complete && assignments.D < assignments.C,
    B: complete && assignments.B > assignments.A,
    E: complete && assignments.E < assignments.B,
    adjacent: complete && Math.abs(assignments.D - assignments.E) > 1
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
    setFeedback("The assignment is incomplete. Place one employee in all five shifts, then check again.", "error");
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
  setFeedback("Assign all five employees, then check your schedule.", "");
}

resetButton.addEventListener("click", resetSchedule);

async function showSuccess(assignments) {
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
  recordStatus.textContent = "Securely recording this completion…";
  gameScreen.hidden = true;
  successScreen.hidden = false;
  successScreen.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    await saveEncryptedCompletion({
      name: studentName,
      completedAt: completedAt.toISOString(),
      completedAtLocal: completedAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
      elapsedSeconds: Math.max(0, Math.floor(elapsed / 1000)),
      schedule: scheduleByShift
    });
    recordStatus.textContent = "✓ Your encrypted completion record was saved successfully.";
    await refreshStats();
  } catch (error) {
    recordStatus.textContent = `Your certificate is valid, but the encrypted online record could not be saved: ${error.message}`;
  }
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
refreshStats();
