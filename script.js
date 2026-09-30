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
const schedulingQuestion = document.querySelector("#schedulingQuestion");
const mapQuestion = document.querySelector("#mapQuestion");
const questionProgress = document.querySelector("#questionProgress");
const mapRegions = [...document.querySelectorAll(".map-region")];
const colorSwatches = [...document.querySelectorAll(".color-swatch")];
const mapFeedback = document.querySelector("#mapFeedback");
const checkMapButton = document.querySelector("#checkMapButton");
const resetMapButton = document.querySelector("#resetMapButton");
const districtQuestion = document.querySelector("#districtQuestion");
const districtRegions = [...document.querySelectorAll(".district-region")];
const districtSwatches = [...document.querySelectorAll(".district-color-swatch")];
const districtFeedback = document.querySelector("#districtFeedback");
const checkDistrictButton = document.querySelector("#checkDistrictButton");
const resetDistrictButton = document.querySelector("#resetDistrictButton");

let activeCard = null;
let selectedCard = null;
let startTime = null;
let timerInterval = null;
let checks = 0;
let studentName = "";
let solvedSchedule = null;
let solvedAustraliaColoring = null;
let solvedDistrictColoring = null;
let selectedColor = null;
let draggedColor = null;
let selectedDistrictColor = null;
let draggedDistrictColor = null;

const MAP_COLORS = {
  red: "#ef5350",
  green: "#43a047",
  blue: "#4285f4",
  orange: "#f28c28"
};

const MAP_ADJACENCIES = [
  ["WA", "NT"], ["WA", "SA"], ["NT", "SA"], ["NT", "QLD"],
  ["SA", "QLD"], ["SA", "NSW"], ["SA", "VIC"], ["QLD", "NSW"],
  ["NSW", "VIC"]
];

const DISTRICT_ADJACENCIES = [
  ["NW", "N"], ["N", "NE"], ["NE", "E"], ["E", "S"],
  ["S", "SW"], ["SW", "W"], ["W", "NW"],
  ["C", "NW"], ["C", "N"], ["C", "NE"], ["C", "E"],
  ["C", "S"], ["C", "SW"], ["C", "W"]
];

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
  successScreen.hidden = true;
  gameScreen.hidden = false;
  mapQuestion.hidden = false;
  districtQuestion.hidden = true;
  schedulingQuestion.hidden = true;
  questionProgress.textContent = "Question 1 of 3";
  startTime = Date.now();
  window.clearInterval(timerInterval);
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
  solvedSchedule = { ...assignments };
  window.setTimeout(() => showSuccess(solvedSchedule, solvedAustraliaColoring, solvedDistrictColoring), 650);
});

function showSchedulingQuestion() {
  districtQuestion.hidden = true;
  schedulingQuestion.hidden = false;
  questionProgress.textContent = "Question 3 of 3";
  schedulingQuestion.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetSchedule() {
  employeeCards.forEach((card) => employeeBank.querySelector(".bank-cards").append(card));
  employeeCards.forEach((card) => card.classList.remove("selected"));
  selectedCard = null;
  updateSlotAppearance();
  clearRuleMarks();
  setFeedback("Assign all five employees, then check your schedule.", "");
}

resetButton.addEventListener("click", resetSchedule);

function setMapFeedback(message, type = "") {
  mapFeedback.textContent = message;
  mapFeedback.className = `feedback${type ? ` ${type}` : ""}`;
}

function chooseColor(color) {
  selectedColor = color;
  colorSwatches.forEach((swatch) => {
    swatch.classList.toggle("selected", swatch.dataset.color === color);
    swatch.setAttribute("aria-pressed", String(swatch.dataset.color === color));
  });
}

function applyColor(regionElement, color) {
  if (!regionElement || !MAP_COLORS[color]) return;
  regionElement.dataset.color = color;
  regionElement.querySelector("polygon").style.fill = MAP_COLORS[color];
  regionElement.classList.remove("conflict");
  regionElement.setAttribute("aria-label", `${regionElement.dataset.region}, colored ${color}`);
  setMapFeedback("Map changed. Color every region, then check your map.");
}

colorSwatches.forEach((swatch) => {
  swatch.setAttribute("aria-pressed", "false");
  swatch.addEventListener("click", () => chooseColor(swatch.dataset.color));
  swatch.addEventListener("dragstart", (event) => {
    draggedColor = swatch.dataset.color;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", draggedColor);
  });
  swatch.addEventListener("dragend", () => { draggedColor = null; });
});

mapRegions.forEach((region) => {
  region.addEventListener("click", () => {
    if (selectedColor) applyColor(region, selectedColor);
    else setMapFeedback("Choose a color first, then select a region.", "error");
  });
  region.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && selectedColor) {
      event.preventDefault();
      applyColor(region, selectedColor);
    }
  });
  region.addEventListener("dragover", (event) => {
    event.preventDefault();
    region.classList.add("drag-over");
  });
  region.addEventListener("dragleave", () => region.classList.remove("drag-over"));
  region.addEventListener("drop", (event) => {
    event.preventDefault();
    region.classList.remove("drag-over");
    const color = event.dataTransfer.getData("text/plain") || draggedColor;
    applyColor(region, color);
  });
});

function getMapColoring() {
  return Object.fromEntries(mapRegions.map((region) => [region.dataset.region, region.dataset.color || ""]));
}

function evaluateMap(coloring) {
  const incomplete = Object.entries(coloring).filter(([, color]) => !color).map(([region]) => region);
  const conflicts = MAP_ADJACENCIES.filter(([first, second]) => coloring[first] && coloring[first] === coloring[second]);
  return { incomplete, conflicts };
}

function resetMap() {
  selectedColor = null;
  draggedColor = null;
  colorSwatches.forEach((swatch) => {
    swatch.classList.remove("selected");
    swatch.setAttribute("aria-pressed", "false");
  });
  mapRegions.forEach((region) => {
    delete region.dataset.color;
    region.classList.remove("conflict", "drag-over");
    region.querySelector("polygon").style.removeProperty("fill");
    region.setAttribute("aria-label", `${region.dataset.region}, not colored`);
  });
  setMapFeedback("Color all seven regions, then check your map.");
}

resetMapButton.addEventListener("click", resetMap);

checkMapButton.addEventListener("click", () => {
  checks += 1;
  attemptCount.textContent = String(checks);
  mapRegions.forEach((region) => region.classList.remove("conflict"));
  const coloring = getMapColoring();
  const results = evaluateMap(coloring);

  if (results.incomplete.length) {
    setMapFeedback(`Color every region first. Still missing: ${results.incomplete.join(", ")}.`, "error");
    return;
  }

  if (results.conflicts.length) {
    const names = new Set(results.conflicts.flat());
    mapRegions.filter((region) => names.has(region.dataset.region)).forEach((region) => region.classList.add("conflict"));
    const pairs = results.conflicts.map(([first, second]) => `${first}–${second}`).join(", ");
    setMapFeedback(`Not consistent yet. These neighboring regions share a color: ${pairs}.`, "error");
    return;
  }

  setMapFeedback("Excellent—every region is colored and all neighboring regions differ!", "good");
  solvedAustraliaColoring = { ...coloring };
  window.setTimeout(showDistrictQuestion, 650);
});

function showDistrictQuestion() {
  mapQuestion.hidden = true;
  districtQuestion.hidden = false;
  questionProgress.textContent = "Question 2 of 3";
  districtQuestion.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setDistrictFeedback(message, type = "") {
  districtFeedback.textContent = message;
  districtFeedback.className = `feedback${type ? ` ${type}` : ""}`;
}

function chooseDistrictColor(color) {
  selectedDistrictColor = color;
  districtSwatches.forEach((swatch) => {
    swatch.classList.toggle("selected", swatch.dataset.color === color);
    swatch.setAttribute("aria-pressed", String(swatch.dataset.color === color));
  });
}

function applyDistrictColor(regionElement, color) {
  if (!regionElement || !MAP_COLORS[color]) return;
  regionElement.dataset.color = color;
  regionElement.querySelector("polygon").style.fill = MAP_COLORS[color];
  regionElement.classList.remove("conflict");
  regionElement.setAttribute("aria-label", `${regionElement.dataset.district} district, colored ${color}`);
  setDistrictFeedback("Map changed. Color every district, then check your map.");
}

districtSwatches.forEach((swatch) => {
  swatch.setAttribute("aria-pressed", "false");
  swatch.addEventListener("click", () => chooseDistrictColor(swatch.dataset.color));
  swatch.addEventListener("dragstart", (event) => {
    draggedDistrictColor = swatch.dataset.color;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", draggedDistrictColor);
  });
  swatch.addEventListener("dragend", () => { draggedDistrictColor = null; });
});

districtRegions.forEach((region) => {
  region.addEventListener("click", () => {
    if (selectedDistrictColor) applyDistrictColor(region, selectedDistrictColor);
    else setDistrictFeedback("Choose a color first, then select a district.", "error");
  });
  region.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && selectedDistrictColor) {
      event.preventDefault();
      applyDistrictColor(region, selectedDistrictColor);
    }
  });
  region.addEventListener("dragover", (event) => {
    event.preventDefault();
    region.classList.add("drag-over");
  });
  region.addEventListener("dragleave", () => region.classList.remove("drag-over"));
  region.addEventListener("drop", (event) => {
    event.preventDefault();
    region.classList.remove("drag-over");
    const color = event.dataTransfer.getData("text/plain") || draggedDistrictColor;
    applyDistrictColor(region, color);
  });
});

function getDistrictColoring() {
  return Object.fromEntries(districtRegions.map((region) => [region.dataset.district, region.dataset.color || ""]));
}

function evaluateDistrictMap(coloring) {
  const incomplete = Object.entries(coloring).filter(([, color]) => !color).map(([district]) => district);
  const conflicts = DISTRICT_ADJACENCIES.filter(([first, second]) => coloring[first] && coloring[first] === coloring[second]);
  const restrictions = [];
  if (coloring.C && coloring.C !== "orange") restrictions.push(["C", "must be orange"]);
  if (coloring.E && coloring.E !== "blue") restrictions.push(["E", "must be blue"]);
  if (coloring.NW && coloring.E && coloring.NW !== coloring.E) restrictions.push(["NW", "must use the same color as E"]);
  if (coloring.N === "red") restrictions.push(["N", "cannot be red"]);
  if (coloring.W === "green") restrictions.push(["W", "cannot be green"]);
  if (coloring.S === "green") restrictions.push(["S", "cannot be green"]);
  if (coloring.SW === "blue") restrictions.push(["SW", "cannot be blue"]);
  return { incomplete, conflicts, restrictions };
}

function resetDistrictMap() {
  selectedDistrictColor = null;
  draggedDistrictColor = null;
  districtSwatches.forEach((swatch) => {
    swatch.classList.remove("selected");
    swatch.setAttribute("aria-pressed", "false");
  });
  districtRegions.forEach((region) => {
    delete region.dataset.color;
    region.classList.remove("conflict", "drag-over");
    region.querySelector("polygon").style.removeProperty("fill");
    region.setAttribute("aria-label", `${region.dataset.district} district, not colored`);
  });
  setDistrictFeedback("Color all eight districts, then check your map.");
}

resetDistrictButton.addEventListener("click", resetDistrictMap);

checkDistrictButton.addEventListener("click", () => {
  checks += 1;
  attemptCount.textContent = String(checks);
  districtRegions.forEach((region) => region.classList.remove("conflict"));
  const coloring = getDistrictColoring();
  const results = evaluateDistrictMap(coloring);

  if (results.incomplete.length) {
    setDistrictFeedback(`Color every district first. Still missing: ${results.incomplete.join(", ")}.`, "error");
    return;
  }

  if (results.conflicts.length || results.restrictions.length) {
    const names = new Set([
      ...results.conflicts.flat(),
      ...results.restrictions.map(([district]) => district)
    ]);
    districtRegions.filter((region) => names.has(region.dataset.district)).forEach((region) => region.classList.add("conflict"));
    const messages = [];
    if (results.conflicts.length) messages.push(`same-color borders: ${results.conflicts.map(([first, second]) => `${first}–${second}`).join(", ")}`);
    if (results.restrictions.length) messages.push(`district restrictions: ${results.restrictions.map(([district, rule]) => `${district} ${rule}`).join(", ")}`);
    setDistrictFeedback(`Not consistent yet. ${messages.join("; ")}.`, "error");
    return;
  }

  setDistrictFeedback("Excellent—this more connected map is complete and consistent!", "good");
  solvedDistrictColoring = { ...coloring };
  window.setTimeout(showSchedulingQuestion, 650);
});

function showSuccess(assignments, australiaColoring, districtColoring) {
  window.clearInterval(timerInterval);
  const elapsed = Date.now() - startTime;
  const completedAt = new Date();
  const scheduleByShift = Object.entries(assignments)
    .sort(([, shiftA], [, shiftB]) => shiftA - shiftB)
    .map(([employee, shift]) => `${employee}→${shift}`)
    .join(", ");
  const mapColoring = ["WA", "NT", "SA", "QLD", "NSW", "VIC", "TAS"]
    .map((region) => `${region}→${australiaColoring[region][0].toUpperCase()}`)
    .join(", ");
  const districtMapColoring = ["NW", "N", "NE", "E", "S", "SW", "W", "C"]
    .map((district) => `${district}→${districtColoring[district][0].toUpperCase()}`)
    .join(", ");

  document.querySelector("#certificateName").textContent = studentName;
  document.querySelector("#completionDate").textContent = completedAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  document.querySelector("#completionTime").textContent = formatElapsed(elapsed);
  document.querySelector("#finalSchedule").textContent = scheduleByShift;
  document.querySelector("#finalMapColoring").textContent = mapColoring;
  document.querySelector("#finalDistrictColoring").textContent = districtMapColoring;
  gameScreen.hidden = true;
  successScreen.hidden = false;
  successScreen.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.querySelector("#printButton").addEventListener("click", () => window.print());
document.querySelector("#playAgainButton").addEventListener("click", () => {
  resetSchedule();
  resetMap();
  resetDistrictMap();
  solvedSchedule = null;
  solvedAustraliaColoring = null;
  solvedDistrictColoring = null;
  checks = 0;
  attemptCount.textContent = "0";
  startTime = Date.now();
  timerInterval = window.setInterval(updateTimer, 1000);
  successScreen.hidden = true;
  gameScreen.hidden = false;
  schedulingQuestion.hidden = true;
  districtQuestion.hidden = true;
  mapQuestion.hidden = false;
  questionProgress.textContent = "Question 1 of 3";
  updateTimer();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

updateSlotAppearance();
