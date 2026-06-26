const pipesLayer = document.getElementById("pipesLayer");
const scoreDisplay = document.getElementById("score");
const levelDisplay = document.getElementById("level");
const movesDisplay = document.getElementById("moves");
const message = document.getElementById("message");
const statusPanel = document.querySelector(".status-panel");
const introOverlay = document.getElementById("introOverlay");
const winScreen = document.getElementById("winScreen");
const loseScreen = document.getElementById("loseScreen");
const infoPopup = document.getElementById("infoPopup");
const finalScore = document.getElementById("finalScore");
const finalMoves = document.getElementById("finalMoves");
const sourceNode = document.querySelector(".source");
const villageNode = document.querySelector(".village");

const startBtn = document.getElementById("startBtn");
const overlayStartBtn = document.getElementById("overlayStartBtn");
const resetBtn = document.getElementById("resetBtn");
const nextLevelBtn = document.getElementById("nextLevel");
const retryBtn = document.getElementById("retryBtn");
const closeInfoBtn = document.getElementById("closeInfoBtn");

const rotateSound = document.getElementById("rotateSound");
const winSound = document.getElementById("winSound");

const MAX_LEVEL = 5;
const GRID_SIZE = 5;
const START_PIPE = 0;
const END_PIPE = 24;
const MOVE_LIMIT = 13;
const BANNER_HIDE_MS = 5000;

const TOTAL_PIPES = GRID_SIZE * GRID_SIZE;
const LEVEL_BLUEPRINTS = [
  {
    path: [0, 1, 2, 3, 4, 9, 14, 19, 24],
    contaminated: [6, 13]
  },
  {
    path: [0, 5, 10, 15, 20, 21, 22, 23, 24],
    contaminated: [7, 13]
  },
  {
    path: [0, 1, 6, 11, 12, 17, 22, 23, 24],
    contaminated: [8, 13]
  },
  {
    path: [0, 5, 6, 7, 12, 17, 18, 19, 24],
    contaminated: [11, 16]
  },
  {
    path: [0, 1, 2, 7, 12, 13, 18, 23, 24],
    contaminated: [6, 16]
  }
];

const oppositeDirection = {
  top: "bottom",
  right: "left",
  bottom: "top",
  left: "right"
};

const pipeShapes = {
  straight: [
    ["top", "bottom"],
    ["left", "right"],
    ["top", "bottom"],
    ["left", "right"]
  ],
  corner: [
    ["top", "right"],
    ["right", "bottom"],
    ["bottom", "left"],
    ["left", "top"]
  ]
};

const DEFAULT_ROTATIONS = [0, 90, 180, 270];
const pipes = [];
const rotations = new Array(TOTAL_PIPES).fill(0);

let pipeLayout = [];
let targetRotations = new Array(TOTAL_PIPES).fill(0);
let solutionPath = [];
let contaminatedPipes = [];

let score = 0;
let level = 1;
let moves = 0;
let gameStarted = false;
let bannerHideTimeout = null;

function showBottomBanner(text) {
  if (!message || !statusPanel) return;

  message.textContent = text;
  statusPanel.classList.remove("hidden");

  if (bannerHideTimeout) {
    clearTimeout(bannerHideTimeout);
  }

  bannerHideTimeout = setTimeout(() => {
    statusPanel.classList.add("hidden");
  }, BANNER_HIDE_MS);
}

function updateScore(points) {
  score = Math.max(0, score + points);
  scoreDisplay.textContent = String(score);
}

function updateLevel() {
  levelDisplay.textContent = String(level);
}

function getMovesRemaining() {
  return Math.max(0, MOVE_LIMIT - moves);
}

function updateMoves() {
  movesDisplay.textContent = String(getMovesRemaining());
}

function playAudio(audioEl) {
  if (!audioEl) return;
  audioEl.currentTime = 0;
  audioEl.play().catch(() => {});
}

function hidePopups() {
  winScreen.classList.add("hidden");
  loseScreen.classList.add("hidden");
  infoPopup.classList.add("hidden");
}

function getLevelBlueprint() {
  return LEVEL_BLUEPRINTS[(level - 1) % LEVEL_BLUEPRINTS.length];
}

function getTileDirectionSet(index, path) {
  const position = path.indexOf(index);
  if (position === -1) {
    return [];
  }

  const directions = [];
  if (position === 0) {
    directions.push("left");
  } else {
    directions.push(getDirectionBetween(index, path[position - 1]));
  }

  if (position === path.length - 1) {
    directions.push("right");
  } else {
    directions.push(getDirectionBetween(index, path[position + 1]));
  }

  return directions;
}

function getPipeDefinitionFromDirections(directions) {
  const key = [...directions].sort().join("-");

  switch (key) {
    case "bottom-top":
      return { type: "straight", rotation: 0, imageVariant: "open-a" };
    case "left-right":
      return { type: "straight", rotation: 90, imageVariant: "open-a" };
    case "right-top":
      return { type: "corner", rotation: 0, imageVariant: "open-b" };
    case "bottom-right":
      return { type: "corner", rotation: 90, imageVariant: "open-b" };
    case "bottom-left":
      return { type: "corner", rotation: 180, imageVariant: "open-b" };
    case "left-top":
      return { type: "corner", rotation: 270, imageVariant: "open-b" };
    default:
      return { type: "straight", rotation: 0, imageVariant: "open-a" };
  }
}

function getFillerTile(index) {
  return index % 2 === 0
    ? { type: "straight", imageVariant: "open-a" }
    : { type: "corner", imageVariant: "open-b" };
}

function getScrambledRotation(targetRotation, enforceMismatch) {
  if (!enforceMismatch) {
    return DEFAULT_ROTATIONS[Math.floor(Math.random() * DEFAULT_ROTATIONS.length)];
  }

  const options = DEFAULT_ROTATIONS.filter((rotation) => rotation !== targetRotation);
  return options[Math.floor(Math.random() * options.length)];
}

function buildLevelBoard() {
  const blueprint = getLevelBlueprint();
  const pathSet = new Set(blueprint.path);
  const contaminatedSet = new Set(blueprint.contaminated);

  solutionPath = blueprint.path;
  contaminatedPipes = blueprint.contaminated;
  pipeLayout = Array.from({ length: TOTAL_PIPES }, (_, index) => {
    if (contaminatedSet.has(index)) {
      return {
        type: index % 2 === 0 ? "straight" : "corner",
        contaminated: true,
        imageVariant: "non-potable"
      };
    }

    if (!pathSet.has(index)) {
      return getFillerTile(index);
    }

    const definition = getPipeDefinitionFromDirections(getTileDirectionSet(index, blueprint.path));
    return {
      ...definition,
      contaminated: false
    };
  });

  targetRotations = pipeLayout.map((tile) => tile.rotation ?? 0);
}

function getPipeImage(type, contaminated, imageVariant) {
  if (imageVariant === "non-potable") {
    return "images/non-potable-water-svgrepo-com.svg";
  }

  if (imageVariant === "open-b") {
    return "images/pipes-pipe-svgrepo-com-1.svg";
  }

  return "images/pipes-pipe-svgrepo-com-2.svg";
}

function createBoard() {
  pipesLayer.innerHTML = "";
  pipes.length = 0;

  Array.from({ length: TOTAL_PIPES }, (_, index) => index).forEach((index) => {
    const pipe = document.createElement("button");
    pipe.type = "button";
    pipe.className = "pipe";

    pipe.dataset.index = String(index);
    pipe.setAttribute("aria-label", `Rotate pipe ${index + 1}`);
    pipe.addEventListener("click", rotatePipe);

    pipesLayer.appendChild(pipe);
    pipes.push(pipe);
  });
}

function renderBoardArt() {
  pipes.forEach((pipe, index) => {
    const pipeData = pipeLayout[index];
    pipe.classList.toggle("start-tile", index === START_PIPE);
    pipe.classList.toggle("end-tile", index === END_PIPE);
    pipe.classList.remove("completed-goal");
    pipe.classList.toggle("contaminated", Boolean(pipeData.contaminated));
    pipe.style.backgroundImage = `url("${getPipeImage(pipeData.type, Boolean(pipeData.contaminated), pipeData.imageVariant)}")`;
    pipe.setAttribute("aria-label", index === START_PIPE ? "Start pipe" : index === END_PIPE ? "End pipe" : `Rotate pipe ${index + 1}`);
  });
}

function celebrateGoalTile() {
  const goalTile = pipes[END_PIPE];
  if (!goalTile) return;

  goalTile.classList.add("completed-goal");
  goalTile.style.backgroundImage = 'url("images/village-svgrepo-com-1.svg")';
  goalTile.setAttribute("aria-label", "Village reached");
}

function resetMapHighlights() {
  if (sourceNode) {
    sourceNode.classList.remove("source-active");
  }
  if (villageNode) {
    villageNode.classList.remove("village-watered");
  }
}

function resetPipeClasses() {
  pipes.forEach((pipe, index) => {
    pipe.classList.remove("active", "watered", "path-preview", "busted");
    pipe.classList.toggle("start-tile", index === START_PIPE);
    pipe.classList.toggle("end-tile", index === END_PIPE);
    pipe.classList.toggle("contaminated", contaminatedPipes.includes(index));
  });
}

function initializeBoard() {
  buildLevelBoard();
  renderBoardArt();
  resetPipeClasses();
  resetMapHighlights();

  pipes.forEach((pipe, index) => {
    const rotation = getScrambledRotation(targetRotations[index], solutionPath.includes(index));
    rotations[index] = rotation;
    pipe.style.transform = `rotate(${rotation}deg)`;
  });
}

function getDirectionBetween(a, b) {
  if (b === a - GRID_SIZE) return "top";
  if (b === a + GRID_SIZE) return "bottom";
  if (b === a - 1) return "left";
  if (b === a + 1) return "right";
  return null;
}

function getOpenings(index) {
  const type = pipeLayout[index].type;
  const quarterTurns = (rotations[index] / 90) % 4;
  return pipeShapes[type][quarterTurns];
}

function markContamination(index) {
  const pipe = pipes[index];
  pipe.classList.add("busted");
}

function getNeighbors(index) {
  const neighbors = [];
  const row = Math.floor(index / GRID_SIZE);
  const col = index % GRID_SIZE;

  if (row > 0) neighbors.push(index - GRID_SIZE);
  if (row < GRID_SIZE - 1) neighbors.push(index + GRID_SIZE);
  if (col > 0) neighbors.push(index - 1);
  if (col < GRID_SIZE - 1) neighbors.push(index + 1);

  return neighbors;
}

function isAlignedConnection(a, b) {
  const directionAB = getDirectionBetween(a, b);
  if (!directionAB) {
    return false;
  }

  const directionBA = oppositeDirection[directionAB];
  const openingsA = getOpenings(a);
  const openingsB = getOpenings(b);

  return openingsA.includes(directionAB) && openingsB.includes(directionBA);
}

function pipesConnect(a, b, ctx) {
  if (!isAlignedConnection(a, b)) {
    return false;
  }

  if (contaminatedPipes.includes(a) || contaminatedPipes.includes(b)) {
    if (!ctx.penaltyApplied) {
      updateScore(-10);
      showBottomBanner("Dirty water reached the system!");
      if (contaminatedPipes.includes(a)) {
        markContamination(a);
      }
      if (contaminatedPipes.includes(b)) {
        markContamination(b);
      }
      ctx.penaltyApplied = true;
    }

    return false;
  }

  return true;
}

function pathUsesContaminatedBranch(index, ctx) {
  const neighbors = getNeighbors(index);

  for (const neighbor of neighbors) {
    if (!contaminatedPipes.includes(neighbor)) {
      continue;
    }

    pipesConnect(index, neighbor, ctx);
    if (ctx.penaltyApplied) {
      return true;
    }
  }

  return false;
}

function evaluatePath() {
  resetPipeClasses();
  resetMapHighlights();

  const previewPath = [solutionPath[0]];
  const ctx = { penaltyApplied: false };

  const startOpenings = getOpenings(solutionPath[0]);
  if (!startOpenings.includes("left")) {
    return { success: false, previewPath };
  }

  for (let index = 0; index < solutionPath.length - 1; index += 1) {
    const current = solutionPath[index];
    const next = solutionPath[index + 1];

    if (!pipesConnect(current, next, ctx)) {
      break;
    }

    previewPath.push(next);
    if (pathUsesContaminatedBranch(current, ctx)) {
      return { success: false, previewPath };
    }
  }

  const reachedEnd = previewPath[previewPath.length - 1] === solutionPath[solutionPath.length - 1];
  const endOpenings = getOpenings(solutionPath[solutionPath.length - 1]);
  const success = reachedEnd && endOpenings.includes("right") && !ctx.penaltyApplied;

  previewPath.forEach((index) => {
    if (!contaminatedPipes.includes(index)) {
      pipes[index].classList.add("path-preview");
    }
  });

  if (success) {
    return { success: true, previewPath };
  }

  return { success: false, previewPath };
}

function animateWater(path) {
  if (sourceNode) {
    sourceNode.classList.add("source-active");
  }

  path.forEach((index, order) => {
    setTimeout(() => {
      pipes[index].classList.remove("path-preview");
      pipes[index].classList.add("watered");
      if (index === path.length - 1 && villageNode) {
        villageNode.classList.add("village-watered");
      }
    }, order * 160);
  });
}

function launchConfetti() {
  const colors = ["#ffc907", "#77a8bb", "#003356", "#bf6c46", "#ffffff"];

  for (let i = 0; i < 120; i += 1) {
    const confetti = document.createElement("div");
    confetti.classList.add("confetti");
    confetti.style.left = `${Math.random() * window.innerWidth}px`;
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDuration = `${Math.random() * 3 + 2}s`;
    confetti.style.width = `${Math.random() * 8 + 6}px`;
    confetti.style.height = `${Math.random() * 8 + 6}px`;

    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 5000);
  }
}

function showWinScreen() {
  finalScore.textContent = String(score);
  finalMoves.textContent = String(moves);
  loseScreen.classList.add("hidden");
  winScreen.classList.remove("hidden");
}

function showInfoPopup() {
  infoPopup.classList.remove("hidden");
}

function showLoseScreen() {
  finalScore.textContent = String(score);
  finalMoves.textContent = String(moves);
  loseScreen.classList.remove("hidden");
}

function loseRound() {
  if (!gameStarted) return;

  gameStarted = false;
  updateScore(-3);
  showBottomBanner("You used more than 13 moves. The village is still waiting for clean water.");
  showLoseScreen();
}

function playerWins(path) {
  if (!gameStarted) return;

  gameStarted = false;
  updateScore(100);
  showBottomBanner("Clean water reached the village!");
  animateWater(path);
  celebrateGoalTile();
  launchConfetti();
  playAudio(winSound);
  showWinScreen();
}

function rotatePipe(event) {
  if (!gameStarted) return;

  const pipe = event.currentTarget;
  const index = Number(pipe.dataset.index);
  const isContaminatedTile = contaminatedPipes.includes(index);

  if (isContaminatedTile) {
    showInfoPopup();
    pipe.classList.add("penalty-hit");
    setTimeout(() => pipe.classList.remove("penalty-hit"), 420);
  }

  rotations[index] = (rotations[index] + 90) % 360;
  pipe.style.transform = `rotate(${rotations[index]}deg)`;
  pipe.classList.add("active");
  setTimeout(() => pipe.classList.remove("active"), 220);

  moves += isContaminatedTile ? 2 : 1;
  updateMoves();
  updateScore(isContaminatedTile ? -10 : 5);
  playAudio(rotateSound);
  showBottomBanner(isContaminatedTile
    ? "Contaminated pipe touched. You lost 10 points and 2 moves."
    : "Keep the pipeline aligned toward the village.");

  if (moves > MOVE_LIMIT) {
    loseRound();
    return;
  }

  const result = evaluatePath();
  if (result.success) {
    playerWins(result.previewPath);
  }
}

function hideIntro() {
  introOverlay.classList.add("hidden");
}

function resetForRound() {
  moves = 0;
  updateMoves();
  hidePopups();
  initializeBoard();
}

function startGame() {
  score = 0;
  updateScore(0);
  resetForRound();
  hideIntro();
  gameStarted = true;
  showBottomBanner(`Level ${level} started. Rotate pipes to carry water uphill.`);
}

function fullReset() {
  score = 0;
  level = 1;
  moves = 0;
  gameStarted = false;

  updateScore(0);
  updateLevel();
  updateMoves();
  hidePopups();
  initializeBoard();
  introOverlay.classList.remove("hidden");
  showBottomBanner("Press Start to open the water line to the village.");
}

function gameComplete() {
  gameStarted = false;
  showBottomBanner("Every village on the route now has clean water.");
  loseScreen.classList.add("hidden");
  winScreen.classList.remove("hidden");
  finalScore.textContent = String(score);
  finalMoves.textContent = String(moves);
  nextLevelBtn.textContent = "Play Again";
}

function bonusPoints() {
  updateScore(50);
  showBottomBanner("Bonus! Efficient pipe building earned extra support.");
}

function advanceLevel() {
  if (level === MAX_LEVEL) {
    gameComplete();
    return;
  }

  level += 1;
  updateLevel();
  resetForRound();
  gameStarted = true;
  updateScore(25);
  showBottomBanner(`Level ${level} started. This route is trickier.`);
}

buildLevelBoard();
createBoard();
renderBoardArt();

startBtn.addEventListener("click", startGame);
overlayStartBtn.addEventListener("click", startGame);
resetBtn.addEventListener("click", fullReset);
nextLevelBtn.addEventListener("click", () => {
  if (nextLevelBtn.textContent === "Play Again") {
    nextLevelBtn.textContent = "Next Level";
    fullReset();
    return;
  }

  advanceLevel();
});
retryBtn.addEventListener("click", () => {
  hidePopups();
  resetForRound();
  gameStarted = true;
  showBottomBanner(`Level ${level} restarted. You have ${MOVE_LIMIT} moves left.`);
});
closeInfoBtn.addEventListener("click", () => {
  infoPopup.classList.add("hidden");
});

setInterval(() => {
  if (!gameStarted) return;
  if (Math.random() < 0.1) bonusPoints();
}, 10000);

updateLevel();
updateScore(0);
updateMoves();
initializeBoard();
showBottomBanner("Press Start to open the water line to the village.");
