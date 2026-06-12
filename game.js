"use strict";

// constants
const GRAVITY = 1720;
const FLAP_FORCE = -560;
const GAME_SPEED = 155;
const OBSTACLE_GAP = 218;
const OBSTACLE_WIDTH = 58;
const SPAWN_INTERVAL = 1.66;
const WIN_SCORE = 20;
const PLAYER_WIDTH = 78;
const PLAYER_HEIGHT = 66;
const MAX_DELTA = 0.032;
const DPR_LIMIT = 2;
const MOBILE_DPR_LIMIT = 1.5;
const DEBUG = false;
const DEBUG_PERFORMANCE = false;
const SUPABASE_URL = "https://iecwycdynqcshgrrycyz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_4s9x6ZTxNKMHzbUl-bM4uA_GhVy-n9e";

const MIN_NICKNAME = 3;
const MAX_NICKNAME = 16;
const MAX_OBSTACLES = 12;
const MAX_PARTICLES = 86;
const MAX_BURSTS = 12;
const NICKNAME_PATTERN = /^[A-Za-zА-Яа-яЁё0-9_]{3,16}$/u;

const STORAGE_KEYS = {
  nickname: "flippBull_nickname",
  deviceId: "flippBull_device_id",
  playerId: "flippBull_player_id",
  bestScore: "flippBull_bestScore",
  leaderboard: "flippBull_leaderboard",
  hasWon: "flippBull_hasWon",
  winDate: "flippBull_winDate",
  winnerNickname: "flippBull_winnerNickname",
  winScore: "flippBull_winScore",
  rewardClaimed: "flippBull_rewardClaimed",
};

const MOCK_LEADERBOARD = [
  { nickname: "AlexTyumen", score: 42 },
  { nickname: "NightFly", score: 39 },
  { nickname: "BullRider", score: 36 },
  { nickname: "StageKing", score: 34 },
  { nickname: "RedWings", score: 32 },
  { nickname: "NeonCan", score: 29 },
  { nickname: "TurboBull", score: 26 },
  { nickname: "EnergyKid", score: 24 },
  { nickname: "BarFly", score: 21 },
  { nickname: "OpenAir", score: 18 },
];

const OBSTACLE_TYPES = ["speakers"];
const PARTICLE_COLORS = ["#1EA7FF", "#80E0FF", "#E21B2D", "#FFFFFF"];

const ASSET_PATHS = {
  backgrounds: {
    main: "assets/backgrounds/bg_main_tyumen_openair_v2.png",
  },
  hero: {
    idle: "assets/hero/hero_can_idle.png",
  },
  obstacles: {
    tower: "assets/obstacles/obstacle_speaker_tower_v2_clean.png",
  },
  effects: {
    burst: "assets/effects/energy_spark_burst.png",
  },
};

const supabaseClient = createSupabaseClient();

function createSupabaseClient() {
  const factory = window.supabase?.createClient;
  if (typeof factory !== "function") {
    console.warn("Supabase client is unavailable. Using local leaderboard fallback.");
    return null;
  }

  return factory(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}

// DOM
const $ = (id) => document.getElementById(id);

const dom = {
  gameFrame: $("gameFrame"),
  canvas: $("gameCanvas"),
  gameHud: $("gameHud"),
  nicknameScreen: $("nicknameScreen"),
  startScreen: $("startScreen"),
  pauseScreen: $("pauseScreen"),
  gameOverScreen: $("gameOverScreen"),
  winScreen: $("winScreen"),
  nicknameForm: $("nicknameForm"),
  nicknameInput: $("nicknameInput"),
  nicknameError: $("nicknameError"),
  startButton: $("startButton"),
  leaderboardButton: $("leaderboardButton"),
  rulesButton: $("rulesButton"),
  changeNickButton: $("changeNickButton"),
  pauseButton: $("pauseButton"),
  resumeButton: $("resumeButton"),
  pauseHomeButton: $("pauseHomeButton"),
  retryButton: $("retryButton"),
  homeButton: $("homeButton"),
  gameOverLeaderboardButton: $("gameOverLeaderboardButton"),
  winHomeButton: $("winHomeButton"),
  claimButton: $("claimButton"),
  leaderboardModal: $("leaderboardModal"),
  leaderboardList: $("leaderboardList"),
  closeLeaderboardButton: $("closeLeaderboardButton"),
  rulesModal: $("rulesModal"),
  closeRulesButton: $("closeRulesButton"),
  sideLeaderboard: $("sideLeaderboard"),
  sideRewardStatus: $("sideRewardStatus"),
  sideRewardNickname: $("sideRewardNickname"),
  desktopNickname: $("desktopNickname"),
  desktopBest: $("desktopBest"),
  hudBest: $("hudBest"),
  hudScore: $("hudScore"),
  hudNickname: $("hudNickname"),
  hudProgressText: $("hudProgressText"),
  hudProgressFill: $("hudProgressFill"),
  startNickname: $("startNickname"),
  startBest: $("startBest"),
  newRecordLabel: $("newRecordLabel"),
  loseNickname: $("loseNickname"),
  loseScore: $("loseScore"),
  loseBest: $("loseBest"),
  loseRemaining: $("loseRemaining"),
  resultTitle: $("resultTitle"),
  resultMessage: $("resultMessage"),
  winTitle: $("winTitle"),
  winNickname: $("winNickname"),
  winScore: $("winScore"),
  winBest: $("winBest"),
  winRewardTitle: $("winRewardTitle"),
  rewardTimer: $("rewardTimer"),
  claimCopy: $("claimCopy"),
  rewardCheck: $("rewardCheck"),
};

const screens = {
  nickname: dom.nicknameScreen,
  start: dom.startScreen,
  paused: dom.pauseScreen,
  gameover: dom.gameOverScreen,
  win: dom.winScreen,
};

const ctx = dom.canvas.getContext("2d", { alpha: false });

// asset loading
async function preloadAssets() {
  buildPools();
  const entries = flattenAssetPaths(ASSET_PATHS);
  const loaded = await Promise.all(
    entries.map(([key, path]) =>
      loadImage(path)
        .then((image) => [key, image])
        .catch(() => [key, null]),
    ),
  );

  for (const [key, image] of loaded) {
    setNestedAsset(state.assets, key, image);
  }
}

function flattenAssetPaths(paths, prefix = "") {
  const entries = [];
  Object.entries(paths).forEach(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      entries.push([nextKey, value]);
    } else {
      entries.push(...flattenAssetPaths(value, nextKey));
    }
  });
  return entries;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.decoding = "async";
    image.src = src;
  });
}

function setNestedAsset(target, keyPath, image) {
  const parts = keyPath.split(".");
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    cursor[parts[i]] = cursor[parts[i]] || {};
    cursor = cursor[parts[i]];
  }
  cursor[parts[parts.length - 1]] = image;
}

// game state
const state = {
  screen: "nickname",
  nickname: "",
  deviceId: "",
  playerId: "",
  score: 0,
  bestScore: 0,
  newRecord: false,
  leaderboard: [],
  hasWon: false,
  winDate: "",
  rewardClaimed: false,
  rewardUnlockedThisRun: false,
  rewardNoticeTimer: 0,
  lastTime: 0,
  elapsed: 0,
  worldOffset: 0,
  spawnTimer: 0,
  view: {
    width: 360,
    height: 640,
    dpr: 1,
  },
  obstacles: [],
  particles: [],
  bursts: [],
  assets: {},
  renderCache: {
    backgrounds: [],
    hero: {},
    effects: {},
  },
  backgroundCanvas: null,
  backgroundCtx: null,
  rewardTimerId: 0,
  performance: {
    fps: 0,
    frameCount: 0,
    sampleTime: 0,
  },
};

// player state
const player = {
  x: 120,
  y: 320,
  vy: 0,
  rotation: 0,
  width: PLAYER_WIDTH,
  height: PLAYER_HEIGHT,
  impulse: 0,
  flapAnimationTime: 0,
};

const previewObstacle = {
  active: true,
  x: 0,
  width: OBSTACLE_WIDTH,
  gapY: 0,
  gap: OBSTACLE_GAP,
  type: "speakers",
  accent: 0,
  phase: 0,
  passed: false,
};

// nickname/localStorage
function storageGet(key, fallback = "") {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // localStorage can be unavailable in strict browser modes; the game still runs.
  }
}

function storageGetJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function loadPersistentState() {
  state.leaderboard = readLeaderboard();
  state.deviceId = getOrCreateDeviceId();
  state.playerId = storageGet(STORAGE_KEYS.playerId, "").trim();

  const savedNickname = storageGet(STORAGE_KEYS.nickname, "").trim();
  state.nickname = NICKNAME_PATTERN.test(savedNickname) ? savedNickname : "";
  state.bestScore = state.nickname
    ? Math.max(getBestForNickname(state.nickname), Number(storageGet(STORAGE_KEYS.bestScore, "0")) || 0)
    : 0;
  state.hasWon = storageGet(STORAGE_KEYS.hasWon, "false") === "true";
  state.winDate = storageGet(STORAGE_KEYS.winDate, "");
  state.rewardClaimed = storageGet(STORAGE_KEYS.rewardClaimed, "false") === "true";

  if (state.nickname) {
    storageSet(STORAGE_KEYS.bestScore, String(state.bestScore));
  }
}

function getOrCreateDeviceId() {
  const savedDeviceId = storageGet(STORAGE_KEYS.deviceId, "").trim();
  if (savedDeviceId) {
    return savedDeviceId;
  }

  const deviceId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `device_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  storageSet(STORAGE_KEYS.deviceId, deviceId);
  return deviceId;
}

function warnSupabase(message, error) {
  console.warn(`[Supabase] ${message}`, error);
}

function isSupabaseReady() {
  return Boolean(supabaseClient);
}

async function ensureSupabasePlayer(nickname = state.nickname) {
  if (!isSupabaseReady() || !nickname) {
    return "";
  }

  const safeNickname = nickname.trim();
  if (!NICKNAME_PATTERN.test(safeNickname)) {
    return "";
  }

  try {
    const localPlayerId = storageGet(STORAGE_KEYS.playerId, "").trim();
    const playerId = localPlayerId || state.playerId;

    if (playerId) {
      const { data, error } = await supabaseClient
        .from("players")
        .update({ nickname: safeNickname, device_id: state.deviceId })
        .eq("id", playerId)
        .select("id")
        .maybeSingle();

      if (!error && data?.id) {
        state.playerId = data.id;
        storageSet(STORAGE_KEYS.playerId, data.id);
        return data.id;
      }

      if (error) {
        warnSupabase("Could not update local player_id; trying nickname lookup.", error);
      }
    }

    const { data: existingPlayer, error: lookupError } = await supabaseClient
      .from("players")
      .select("id")
      .eq("nickname", safeNickname)
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      warnSupabase("Could not find player by nickname.", lookupError);
    }

    if (existingPlayer?.id) {
      state.playerId = existingPlayer.id;
      storageSet(STORAGE_KEYS.playerId, existingPlayer.id);
      await supabaseClient.from("players").update({ device_id: state.deviceId }).eq("id", existingPlayer.id);
      return existingPlayer.id;
    }

    const { data: createdPlayer, error: insertError } = await supabaseClient
      .from("players")
      .insert({ nickname: safeNickname, device_id: state.deviceId })
      .select("id")
      .single();

    if (insertError) {
      warnSupabase("Could not create player. Local profile is still available.", insertError);
      return "";
    }

    state.playerId = createdPlayer.id;
    storageSet(STORAGE_KEYS.playerId, createdPlayer.id);
    return createdPlayer.id;
  } catch (error) {
    warnSupabase("Player sync failed. Using local player fallback.", error);
    return "";
  }
}

async function submitScoreToSupabase(score) {
  if (!isSupabaseReady() || !state.nickname) {
    return;
  }

  try {
    const playerId = state.playerId || (await ensureSupabasePlayer(state.nickname));
    if (!playerId) {
      return;
    }

    const safeScore = Math.max(0, Math.floor(score));
    const { error } = await supabaseClient.from("scores").insert({
      player_id: playerId,
      nickname: state.nickname,
      score: safeScore,
    });

    if (error) {
      warnSupabase("Could not submit score. Local leaderboard fallback is still updated.", error);
      return;
    }

    await refreshLeaderboardFromSupabase();
  } catch (error) {
    warnSupabase("Score submit failed. Local leaderboard fallback is still updated.", error);
  }
}

async function refreshLeaderboardFromSupabase() {
  if (!isSupabaseReady()) {
    return false;
  }

  try {
    const { data, error } = await supabaseClient
      .from("leaderboard")
      .select("*")
      .order("best_score", { ascending: false })
      .limit(10);

    if (error) {
      warnSupabase("Could not load leaderboard view. Using local leaderboard fallback.", error);
      return false;
    }

    const remoteLeaderboard = sanitizeLeaderboard(
      (data || []).map((entry) => ({
        nickname: entry.nickname,
        score: entry.best_score ?? entry.score,
      })),
    );

    if (!remoteLeaderboard.length) {
      return false;
    }

    state.leaderboard = remoteLeaderboard;
    saveLeaderboard();
    if (state.nickname) {
      const remoteBestScore = getBestForNickname(state.nickname);
      state.bestScore = Math.max(state.bestScore, remoteBestScore);
      storageSet(STORAGE_KEYS.bestScore, String(state.bestScore));
    }
    renderLeaderboards();
    updateStartScreen();
    return true;
  } catch (error) {
    warnSupabase("Leaderboard sync failed. Using local leaderboard fallback.", error);
    return false;
  }
}

function validateNickname(rawNickname) {
  const nickname = rawNickname.trim();
  if (nickname.length < MIN_NICKNAME || nickname.length > MAX_NICKNAME) {
    return "Ник должен быть от 3 до 16 символов";
  }
  if (!NICKNAME_PATTERN.test(nickname)) {
    return "Можно использовать буквы, цифры и подчёркивание";
  }
  return "";
}

function saveNickname(rawNickname) {
  const nickname = rawNickname.trim();
  const error = validateNickname(nickname);

  if (error) {
    dom.nicknameError.textContent = error;
    return false;
  }

  state.nickname = nickname;
  state.bestScore = getBestForNickname(nickname);
  storageSet(STORAGE_KEYS.nickname, nickname);
  storageSet(STORAGE_KEYS.bestScore, String(state.bestScore));
  updateLeaderboard(nickname, state.bestScore);
  dom.nicknameError.textContent = "";
  updateAllUi();
  showScreen("start");
  ensureSupabasePlayer(nickname).then(() => refreshLeaderboardFromSupabase());
  return true;
}

// leaderboard
function readLeaderboard() {
  const rawList = storageGetJson(STORAGE_KEYS.leaderboard, MOCK_LEADERBOARD);
  const cleanList = sanitizeLeaderboard(rawList);
  if (!cleanList.length) {
    return sanitizeLeaderboard(MOCK_LEADERBOARD);
  }
  return cleanList;
}

function sanitizeLeaderboard(list) {
  const bestByNickname = new Map();
  if (!Array.isArray(list)) {
    return [];
  }

  for (const item of list) {
    const nickname = String(item.nickname || "").trim();
    const score = Number(item.score);
    if (!NICKNAME_PATTERN.test(nickname) || !Number.isFinite(score) || score < 0) {
      continue;
    }

    const normalizedScore = Math.floor(score);
    const existing = bestByNickname.get(nickname);
    if (!existing || normalizedScore > existing.score) {
      bestByNickname.set(nickname, { nickname, score: normalizedScore });
    }
  }

  return Array.from(bestByNickname.values()).sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
}

function saveLeaderboard() {
  state.leaderboard = sanitizeLeaderboard(state.leaderboard);
  storageSet(STORAGE_KEYS.leaderboard, JSON.stringify(state.leaderboard));
}

function getBestForNickname(nickname) {
  const entry = state.leaderboard.find((playerEntry) => playerEntry.nickname === nickname);
  return entry ? entry.score : 0;
}

function updateLeaderboard(nickname, score) {
  if (!nickname) {
    return;
  }

  const safeScore = Math.max(0, Math.floor(score));
  const existing = state.leaderboard.find((entry) => entry.nickname === nickname);

  if (existing) {
    existing.score = Math.max(existing.score, safeScore);
  } else {
    state.leaderboard.push({ nickname, score: safeScore });
  }

  saveLeaderboard();
  renderLeaderboards();
}

function renderLeaderboards() {
  const topTen = state.leaderboard.slice(0, 10);
  dom.leaderboardList.innerHTML = "";
  dom.sideLeaderboard.innerHTML = "";

  topTen.forEach((entry, index) => {
    dom.leaderboardList.appendChild(createLeaderboardItem(entry, index + 1));
  });

  topTen.slice(0, 6).forEach((entry, index) => {
    dom.sideLeaderboard.appendChild(createLeaderboardItem(entry, index + 1));
  });

  const currentIndex = state.leaderboard.findIndex((entry) => entry.nickname === state.nickname);
  if (currentIndex > 9) {
    const pinned = createLeaderboardItem(state.leaderboard[currentIndex], currentIndex + 1);
    pinned.classList.add("pinned");
    dom.leaderboardList.appendChild(pinned);
  }
}

function createLeaderboardItem(entry, rank) {
  const item = document.createElement("li");
  const isCurrent = entry.nickname === state.nickname;
  if (isCurrent) {
    item.classList.add("current");
  }
  item.innerHTML = `<b>${rank}</b><span>${escapeHtml(entry.nickname)}</span><strong>${entry.score}</strong>`;
  return item;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// reward state
function saveWinState() {
  const alreadyClaimed = state.rewardClaimed || storageGet(STORAGE_KEYS.rewardClaimed, "false") === "true";
  state.hasWon = true;
  state.rewardClaimed = alreadyClaimed;
  state.winDate = state.winDate || storageGet(STORAGE_KEYS.winDate, "") || new Date().toISOString();
  storageSet(STORAGE_KEYS.hasWon, "true");
  storageSet(STORAGE_KEYS.winDate, state.winDate);
  storageSet(STORAGE_KEYS.winnerNickname, state.nickname);
  storageSet(STORAGE_KEYS.winScore, String(state.score));
  storageSet(STORAGE_KEYS.rewardClaimed, alreadyClaimed ? "true" : "false");
}

function unlockRewardInRun() {
  if (state.rewardUnlockedThisRun) {
    return;
  }

  state.rewardUnlockedThisRun = true;
  state.rewardNoticeTimer = 2.15;
  saveWinState();
  updateHud();
  updateSideReward();
}

function claimReward() {
  state.rewardClaimed = true;
  storageSet(STORAGE_KEYS.rewardClaimed, "true");
  updateWinScreen();
  updateSideReward();
}

function startRewardTimer() {
  window.clearInterval(state.rewardTimerId);
  updateRewardTimer();
  state.rewardTimerId = window.setInterval(updateRewardTimer, 1000);
}

function stopRewardTimer() {
  window.clearInterval(state.rewardTimerId);
  state.rewardTimerId = 0;
}

function updateRewardTimer() {
  const dateMs = Date.parse(state.winDate || storageGet(STORAGE_KEYS.winDate, ""));
  const base = Number.isFinite(dateMs) ? dateMs : Date.now();
  const remaining = Math.max(0, base + 24 * 60 * 60 * 1000 - Date.now());
  dom.rewardTimer.textContent = formatDuration(remaining);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

// input handling
function bindInputs() {
  dom.nicknameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveNickname(dom.nicknameInput.value);
  });

  dom.startButton.addEventListener("click", startGame);
  dom.retryButton.addEventListener("click", startGame);
  dom.homeButton.addEventListener("click", () => showScreen("start"));
  dom.winHomeButton.addEventListener("click", startGame);
  dom.pauseHomeButton.addEventListener("click", () => showScreen("start"));
  dom.pauseButton.addEventListener("click", pauseGame);
  dom.resumeButton.addEventListener("click", resumeGame);
  dom.claimButton.addEventListener("click", claimReward);

  dom.leaderboardButton.addEventListener("click", openLeaderboard);
  dom.gameOverLeaderboardButton.addEventListener("click", openLeaderboard);
  dom.closeLeaderboardButton.addEventListener("click", closeLeaderboard);
  dom.rulesButton.addEventListener("click", openRules);
  dom.closeRulesButton.addEventListener("click", closeRules);
  dom.changeNickButton.addEventListener("click", () => {
    dom.nicknameInput.value = state.nickname;
    dom.nicknameError.textContent = "";
    showScreen("nickname");
  });

  dom.leaderboardModal.addEventListener("click", (event) => {
    if (event.target === dom.leaderboardModal) {
      closeLeaderboard();
    }
  });

  dom.rulesModal.addEventListener("click", (event) => {
    if (event.target === dom.rulesModal) {
      closeRules();
    }
  });

  dom.gameFrame.addEventListener(
    "pointerdown",
    (event) => {
      if (event.target.closest("button, input, .modal-card")) {
        return;
      }
      if (state.screen === "playing") {
        event.preventDefault();
        flap();
      }
    },
    { passive: false },
  );

  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || document.activeElement === dom.nicknameInput) {
      return;
    }

    event.preventDefault();
    if (state.screen === "playing") {
      flap();
    } else if (state.screen === "paused") {
      resumeGame();
    } else if (state.screen === "start" || state.screen === "gameover") {
      startGame();
    }
  });

  window.addEventListener("resize", debounceResize);
}

let resizeRaf = 0;
function debounceResize() {
  if (resizeRaf) {
    return;
  }
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    resizeCanvas();
  });
}

// physics update
function startGame() {
  if (!state.nickname) {
    showScreen("nickname");
    return;
  }

  resetRun();
  showScreen("playing");
  updateAllUi();
  flap();
}

function pauseGame() {
  if (state.screen !== "playing") {
    return;
  }
  showScreen("paused");
}

function resumeGame() {
  if (state.screen !== "paused") {
    return;
  }
  state.lastTime = performance.now();
  showScreen("playing");
}

function resetRun() {
  state.score = 0;
  state.newRecord = false;
  state.rewardUnlockedThisRun = false;
  state.rewardNoticeTimer = 0;
  state.spawnTimer = 0.86;
  state.worldOffset = 0;
  player.x = state.view.width * 0.34;
  player.y = state.view.height * 0.46;
  player.vy = 0;
  player.rotation = 0;
  player.impulse = 0;
  player.flapAnimationTime = 0;

  for (const obstacle of state.obstacles) {
    obstacle.active = false;
  }
  for (const particle of state.particles) {
    particle.active = false;
  }
  for (const burst of state.bursts) {
    burst.active = false;
  }
}

function flap() {
  player.vy = FLAP_FORCE;
  player.impulse = 1;
  player.flapAnimationTime = 1;
}

function updateGame(dt) {
  const difficultyScore = Math.max(0, state.score - 7);
  const speed = GAME_SPEED + Math.min(difficultyScore, 18) * 1.35;

  state.worldOffset += speed * dt;
  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;

  const targetRotation = clamp(player.vy / 720, -0.55, 0.82);
  const rotationBlend = 1 - Math.exp(-dt * 11);
  player.rotation += (targetRotation - player.rotation) * rotationBlend;
  player.impulse = Math.max(0, player.impulse - dt * 5);
  player.flapAnimationTime = Math.max(0, player.flapAnimationTime - dt * 4.6);
  state.rewardNoticeTimer = Math.max(0, state.rewardNoticeTimer - dt);

  updateObstacleSpawning(dt);
  updateObstacles(dt, speed);
  updateParticles(dt);

  if (state.screen !== "playing") {
    return;
  }

  if (checkBoundsCollision() || checkObstacleCollision()) {
    finishRun();
  }
}

function updateIdle(dt) {
  state.worldOffset += GAME_SPEED * 0.18 * dt;
  player.x += (state.view.width * 0.34 - player.x) * (1 - Math.exp(-dt * 6));
  player.y = state.view.height * 0.47 + Math.sin(state.elapsed * 2.2) * 8;
  player.rotation = Math.sin(state.elapsed * 1.7) * 0.08;
  player.impulse = Math.max(0, player.impulse - dt * 3);
  player.flapAnimationTime = Math.max(0, player.flapAnimationTime - dt * 3.2);
  updateParticles(dt);
}

// obstacle spawning
function buildPools() {
  state.obstacles = Array.from({ length: MAX_OBSTACLES }, () => ({
    active: false,
    x: 0,
    width: OBSTACLE_WIDTH,
    gapY: 0,
    gap: OBSTACLE_GAP,
    type: "gate",
    accent: 0,
    phase: 0,
    passed: false,
    topSprite: null,
    bottomSprite: null,
    portalSprite: null,
  }));

  state.particles = Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0,
    size: 0,
    color: "#1EA7FF",
  }));

  state.bursts = Array.from({ length: MAX_BURSTS }, () => ({
    active: false,
    x: 0,
    y: 0,
    life: 0,
    maxLife: 0,
    size: 0,
    rotation: 0,
  }));
}

function updateObstacleSpawning(dt) {
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) {
    return;
  }

  spawnObstacle();
  const difficultyScore = Math.max(0, state.score - 7);
  state.spawnTimer += Math.max(1.24, SPAWN_INTERVAL - Math.min(difficultyScore, 18) * 0.008);
}

function spawnObstacle() {
  const obstacle = state.obstacles.find((entry) => !entry.active);
  if (!obstacle) {
    return;
  }

  const widthScale = clamp(state.view.width / 390, 0.88, 1.08);
  const difficultyScore = Math.max(0, state.score - 7);
  const earlyBonus = state.score < 7 ? (7 - state.score) * 4 : 0;
  const gap = clamp(OBSTACLE_GAP + earlyBonus - Math.min(difficultyScore, 16) * 0.65, 198, 246);
  const topSafe = Math.max(124, state.view.height * 0.18);
  const bottomSafe = state.view.height - Math.max(104, state.view.height * 0.14);
  const minCenter = topSafe + gap / 2;
  const maxCenter = bottomSafe - gap / 2;
  const travel = Math.max(1, maxCenter - minCenter);

  obstacle.active = true;
  obstacle.x = state.view.width + OBSTACLE_WIDTH;
  obstacle.width = Math.round(OBSTACLE_WIDTH * widthScale);
  obstacle.gap = gap;
  obstacle.gapY = minCenter + Math.random() * travel;
  obstacle.type = OBSTACLE_TYPES[state.score % OBSTACLE_TYPES.length];
  obstacle.accent = state.score % 3;
  obstacle.phase = Math.random() * Math.PI * 2;
  obstacle.passed = false;
  prepareObstacleSprites(obstacle);
}

function prepareObstacleSprites(obstacle) {
  const gapTop = Math.max(0, obstacle.gapY - obstacle.gap / 2);
  const gapBottom = Math.min(state.view.height, obstacle.gapY + obstacle.gap / 2);
  const topHeight = Math.max(0, gapTop);
  const bottomHeight = Math.max(0, state.view.height - gapBottom);

  obstacle.topSprite = topHeight > 8 ? createObstacleSpriteCanvas(obstacle.width, topHeight, obstacle.type, "bottom") : null;
  obstacle.bottomSprite = bottomHeight > 8 ? createObstacleSpriteCanvas(obstacle.width, bottomHeight, obstacle.type, "top") : null;
  obstacle.portalSprite = null;
}

function createObstacleSpriteCanvas(targetWidth, targetHeight, type, alignY = "center") {
  const dpr = state.view.dpr || 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(targetWidth * dpr));
  canvas.height = Math.max(1, Math.round(targetHeight * dpr));

  const targetCtx = canvas.getContext("2d");
  targetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state.assets.obstacles?.tower) {
    drawObstacleImage(targetCtx, state.assets.obstacles.tower, targetWidth, targetHeight, alignY);
  } else {
    drawObstacleBody(targetCtx, 0, 0, targetWidth, targetHeight, type);
  }

  return {
    canvas,
    width: targetWidth,
    height: targetHeight,
  };
}

function drawObstacleImage(targetCtx, image, targetWidth, targetHeight, alignY = "center") {
  targetCtx.imageSmoothingEnabled = true;
  targetCtx.imageSmoothingQuality = "high";

  const imageWidth = image.naturalWidth || image.width || targetWidth;
  const imageHeight = image.naturalHeight || image.height || targetHeight;
  const scale = Math.max(targetWidth / imageWidth, targetHeight / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const drawX = (targetWidth - drawWidth) / 2;
  let drawY = (targetHeight - drawHeight) / 2;
  if (alignY === "top") {
    drawY = 0;
  } else if (alignY === "bottom") {
    drawY = targetHeight - drawHeight;
  }
  targetCtx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function createAssetCanvas(image, targetWidth, targetHeight, mode = "contain") {
  if (!image || !targetWidth || !targetHeight) {
    return null;
  }

  const dpr = state.view.dpr || 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(targetWidth * dpr));
  canvas.height = Math.max(1, Math.round(targetHeight * dpr));

  const targetCtx = canvas.getContext("2d");
  targetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  targetCtx.imageSmoothingEnabled = true;
  targetCtx.imageSmoothingQuality = "high";

  const imageWidth = image.naturalWidth || image.width || targetWidth;
  const imageHeight = image.naturalHeight || image.height || targetHeight;
  const scale =
    mode === "cover"
      ? Math.max(targetWidth / imageWidth, targetHeight / imageHeight)
      : Math.min(targetWidth / imageWidth, targetHeight / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const drawX = (targetWidth - drawWidth) / 2;
  const drawY = (targetHeight - drawHeight) / 2;
  targetCtx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  return {
    canvas,
    width: targetWidth,
    height: targetHeight,
  };
}

function updateObstacles(dt, speed) {
  for (const obstacle of state.obstacles) {
    if (!obstacle.active) {
      continue;
    }

    obstacle.x -= speed * dt;

    if (!obstacle.passed && obstacle.x + obstacle.width < player.x - getPlayerHitbox().width / 2) {
      obstacle.passed = true;
      scorePoint();
      if (state.screen !== "playing") {
        return;
      }
    }

    if (obstacle.x + obstacle.width < -30) {
      obstacle.active = false;
    }
  }
}

// collision detection
function getPlayerHitbox() {
  return {
    x: player.x - player.width * 0.28,
    y: player.y - player.height * 0.29,
    width: player.width * 0.56,
    height: player.height * 0.58,
  };
}

function checkBoundsCollision() {
  const box = getPlayerHitbox();
  const floor = state.view.height - Math.max(46, state.view.height * 0.07);
  return box.y < 0 || box.y + box.height > floor;
}

function checkObstacleCollision() {
  const box = getPlayerHitbox();
  for (const obstacle of state.obstacles) {
    if (!obstacle.active) {
      continue;
    }

    const overlapsX = box.x < obstacle.x + obstacle.width && box.x + box.width > obstacle.x;
    if (!overlapsX) {
      continue;
    }

    const gapTop = obstacle.gapY - obstacle.gap / 2;
    const gapBottom = obstacle.gapY + obstacle.gap / 2;
    const hitsTop = box.y < gapTop;
    const hitsBottom = box.y + box.height > gapBottom;

    if (hitsTop || hitsBottom) {
      return true;
    }
  }
  return false;
}

// scoring
function scorePoint() {
  state.score += 1;
  spawnScoreParticles();
  spawnBurst(player.x + player.width * 0.18, player.y, 62);
  updateHud();

  if (state.score >= WIN_SCORE && !state.rewardUnlockedThisRun) {
    unlockRewardInRun();
  }
}

function finishRun() {
  if (state.screen !== "playing") {
    return;
  }

  state.newRecord = state.score > state.bestScore;
  if (state.newRecord) {
    state.bestScore = state.score;
    storageSet(STORAGE_KEYS.bestScore, String(state.bestScore));
  }

  updateLeaderboard(state.nickname, state.score);
  submitScoreToSupabase(state.score);

  if (state.score >= WIN_SCORE) {
    if (!state.rewardUnlockedThisRun) {
      unlockRewardInRun();
    }
    saveWinState();
    spawnWinParticles();
    spawnBurst(state.view.width * 0.5, state.view.height * 0.24, 132);
    updateWinScreen();
    showScreen("win");
    return;
  }

  updateGameOverScreen();
  showScreen("gameover");
}

// particles/effects
function spawnFlapParticles() {
  for (let i = 0; i < 9; i += 1) {
    const particle = getFreeParticle();
    if (!particle) {
      return;
    }
    const spread = (Math.random() - 0.5) * 44;
    particle.active = true;
    particle.x = player.x - player.width * 0.46 + Math.random() * 8;
    particle.y = player.y + spread * 0.28;
    particle.vx = -120 - Math.random() * 90;
    particle.vy = spread - 24 - Math.random() * 36;
    particle.life = 0.28 + Math.random() * 0.2;
    particle.maxLife = particle.life;
    particle.size = 2 + Math.random() * 3.5;
    particle.color = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
  }
}

function spawnScoreParticles() {
  for (let i = 0; i < 14; i += 1) {
    const particle = getFreeParticle();
    if (!particle) {
      return;
    }
    particle.active = true;
    particle.x = player.x + 26 + Math.random() * 22;
    particle.y = player.y - 18 + Math.random() * 36;
    particle.vx = -20 - Math.random() * 70;
    particle.vy = -80 + Math.random() * 160;
    particle.life = 0.34 + Math.random() * 0.28;
    particle.maxLife = particle.life;
    particle.size = 2 + Math.random() * 4;
    particle.color = PARTICLE_COLORS[(i + 1) % PARTICLE_COLORS.length];
  }
}

function spawnWinParticles() {
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    const particle = state.particles[i];
    particle.active = true;
    particle.x = state.view.width * (0.18 + Math.random() * 0.64);
    particle.y = state.view.height * (0.12 + Math.random() * 0.28);
    particle.vx = -40 + Math.random() * 80;
    particle.vy = 40 + Math.random() * 180;
    particle.life = 0.9 + Math.random() * 0.8;
    particle.maxLife = particle.life;
    particle.size = 2 + Math.random() * 5;
    particle.color = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
  }
}

function spawnBurst(x, y, size) {
  const burst = state.bursts.find((entry) => !entry.active);
  if (!burst) {
    return;
  }

  burst.active = true;
  burst.x = x;
  burst.y = y;
  burst.life = 0.52;
  burst.maxLife = 0.52;
  burst.size = size;
  burst.rotation = Math.random() * Math.PI * 2;
}

function getFreeParticle() {
  return state.particles.find((particle) => !particle.active);
}

function updateParticles(dt) {
  for (const particle of state.particles) {
    if (!particle.active) {
      continue;
    }
    particle.life -= dt;
    if (particle.life <= 0) {
      particle.active = false;
      continue;
    }
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 80 * dt;
  }
  updateBursts(dt);
}

function updateBursts(dt) {
  for (const burst of state.bursts) {
    if (!burst.active) {
      continue;
    }
    burst.life -= dt;
    burst.rotation += dt * 1.8;
    if (burst.life <= 0) {
      burst.active = false;
    }
  }
}

// resize handling
function resizeCanvas() {
  const rect = dom.canvas.getBoundingClientRect();
  const width = Math.max(320, Math.round(rect.width || 360));
  const height = Math.max(520, Math.round(rect.height || 640));
  const dpr = Math.min(window.devicePixelRatio || 1, getDprLimit());

  if (width === state.view.width && height === state.view.height && dpr === state.view.dpr) {
    return;
  }

  state.view.width = width;
  state.view.height = height;
  state.view.dpr = dpr;
  dom.canvas.width = Math.round(width * dpr);
  dom.canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildRenderCache();
  buildBackground();
  state.obstacles.forEach((obstacle) => {
    if (obstacle.active) {
      prepareObstacleSprites(obstacle);
    }
  });

  if (state.screen !== "playing" && state.screen !== "paused") {
    player.x = Math.round(width * 0.34);
    player.y = Math.round(height * 0.47);
  }
}

function getDprLimit() {
  const isMobileViewport = window.innerWidth <= 920;
  const isTouchDevice = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  return isMobileViewport || isTouchDevice ? MOBILE_DPR_LIMIT : DPR_LIMIT;
}

// rendering background
function buildRenderCache() {
  const { width, height } = state.view;
  const heroWidth = Math.round(clamp(width * 0.285, 82, 102));

  state.renderCache.backgrounds = [];

  state.renderCache.hero = {
    idle: createAssetCanvas(state.assets.hero?.idle, heroWidth, Math.round(heroWidth * getImageRatio(state.assets.hero?.idle)), "contain"),
    flap: null,
    falling: null,
  };

  state.renderCache.effects = {
    trail: null,
    burst: createAssetCanvas(state.assets.effects?.burst, 112, 112, "contain"),
  };

  const activeHero = state.renderCache.hero.idle;
  player.width = activeHero?.width || PLAYER_WIDTH;
  player.height = activeHero?.height || PLAYER_HEIGHT;
}

function getImageRatio(image) {
  if (!image) {
    return PLAYER_HEIGHT / PLAYER_WIDTH;
  }
  const imageWidth = image.naturalWidth || image.width || PLAYER_WIDTH;
  const imageHeight = image.naturalHeight || image.height || PLAYER_HEIGHT;
  return imageHeight / imageWidth;
}

function createBackgroundCanvas(image, targetWidth, targetHeight, speed, alpha) {
  if (!image) {
    return null;
  }

  const imageWidth = image.naturalWidth || image.width || targetWidth;
  const imageHeight = image.naturalHeight || image.height || targetHeight;
  const scale = Math.max(targetWidth / imageWidth, targetHeight / imageHeight);
  const drawWidth = Math.ceil(imageWidth * scale);
  const drawHeight = Math.ceil(imageHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = drawWidth;
  canvas.height = targetHeight;

  const targetCtx = canvas.getContext("2d");
  targetCtx.imageSmoothingEnabled = true;
  targetCtx.imageSmoothingQuality = "high";
  targetCtx.drawImage(image, 0, (targetHeight - drawHeight) / 2, drawWidth, drawHeight);

  return {
    canvas,
    width: drawWidth,
    height: targetHeight,
    speed,
    alpha,
  };
}

function buildBackground() {
  const { width, height, dpr } = state.view;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const backgroundCtx = canvas.getContext("2d");
  backgroundCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (state.assets.backgrounds?.main) {
    drawCoverToContext(backgroundCtx, state.assets.backgrounds.main, width, height);
    backgroundCtx.fillStyle = "rgba(5, 11, 24, 0.18)";
    backgroundCtx.fillRect(0, 0, width, height);
  } else {
    const sky = backgroundCtx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#050B18");
    sky.addColorStop(0.48, "#081A33");
    sky.addColorStop(1, "#020612");
    backgroundCtx.fillStyle = sky;
    backgroundCtx.fillRect(0, 0, width, height);

    drawStaticStars(backgroundCtx, width, height);
    drawCitySilhouette(backgroundCtx, width, height);
    drawStageBase(backgroundCtx, width, height);
  }

  drawVignette(backgroundCtx, width, height);
  state.backgroundCanvas = canvas;
  state.backgroundCtx = backgroundCtx;
}

function drawCoverToContext(targetCtx, image, targetWidth, targetHeight) {
  const imageWidth = image.naturalWidth || image.width || targetWidth;
  const imageHeight = image.naturalHeight || image.height || targetHeight;
  const scale = Math.max(targetWidth / imageWidth, targetHeight / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const drawX = (targetWidth - drawWidth) / 2;
  const drawY = (targetHeight - drawHeight) / 2;
  targetCtx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawStaticStars(targetCtx, width, height) {
  for (let i = 0; i < 72; i += 1) {
    const x = noise(i * 9.13) * width;
    const y = noise(i * 14.73) * height * 0.58;
    const alpha = 0.28 + noise(i * 4.8) * 0.52;
    targetCtx.fillStyle = `rgba(175, 199, 232, ${alpha})`;
    targetCtx.fillRect(x, y, 1.2, 1.2);
  }
}

function drawCitySilhouette(targetCtx, width, height) {
  const baseY = height * 0.78;
  targetCtx.fillStyle = "rgba(3, 8, 18, 0.72)";
  targetCtx.beginPath();
  targetCtx.moveTo(0, height);
  targetCtx.lineTo(0, baseY);

  let x = 0;
  let index = 0;
  while (x < width + 40) {
    const blockWidth = 20 + noise(index * 5.31) * 38;
    const blockHeight = 34 + noise(index * 7.17) * 98;
    targetCtx.lineTo(x, baseY - blockHeight);
    targetCtx.lineTo(x + blockWidth, baseY - blockHeight);
    x += blockWidth;
    index += 1;
  }

  targetCtx.lineTo(width, height);
  targetCtx.closePath();
  targetCtx.fill();

  targetCtx.strokeStyle = "rgba(30, 167, 255, 0.24)";
  targetCtx.lineWidth = 2;
  targetCtx.beginPath();
  targetCtx.moveTo(width * 0.1, baseY + 8);
  targetCtx.bezierCurveTo(width * 0.34, baseY - 36, width * 0.66, baseY - 36, width * 0.9, baseY + 8);
  targetCtx.stroke();

  targetCtx.fillStyle = "rgba(255, 210, 0, 0.78)";
  for (let i = 0; i < 18; i += 1) {
    const lightX = width * 0.12 + i * width * 0.045;
    targetCtx.fillRect(lightX, baseY - 10 + Math.sin(i) * 6, 2, 2);
  }

  targetCtx.fillStyle = "rgba(255, 255, 255, 0.32)";
  targetCtx.font = "900 11px Segoe UI, Arial, sans-serif";
  targetCtx.fillText("TYUMEN NIGHT OPEN AIR", 18, baseY - 16);
}

function drawStageBase(targetCtx, width, height) {
  const floorTop = height - Math.max(48, height * 0.075);
  targetCtx.fillStyle = "rgba(2, 6, 15, 0.94)";
  targetCtx.fillRect(0, floorTop, width, height - floorTop);

  targetCtx.strokeStyle = "rgba(30, 167, 255, 0.22)";
  targetCtx.lineWidth = 1;
  for (let i = 0; i < 8; i += 1) {
    const y = floorTop + i * 10;
    targetCtx.beginPath();
    targetCtx.moveTo(0, y);
    targetCtx.lineTo(width, y + i * 3);
    targetCtx.stroke();
  }
}

function drawBackground() {
  const { width, height } = state.view;
  ctx.drawImage(state.backgroundCanvas, 0, 0, width, height);
}

function drawParallaxLayers(width, height) {
  for (const layer of state.renderCache.backgrounds) {
    if (!layer || layer.width <= width) {
      continue;
    }

    const overflow = layer.width - width;
    const x = -((state.worldOffset * layer.speed) % overflow);
    ctx.save();
    ctx.globalAlpha = layer.alpha;
    ctx.drawImage(layer.canvas, x, 0, layer.width, height);
    if (x > -overflow + 2) {
      ctx.drawImage(layer.canvas, x + layer.width, 0, layer.width, height);
    }
    ctx.restore();
  }
}

function drawMovingLightRigs(width, height) {
  const offset = state.worldOffset * 0.38;
  ctx.save();
  ctx.lineWidth = 1.5;

  for (let i = -1; i < 8; i += 1) {
    const x = ((i * 92 - offset) % (width + 160)) - 80;
    ctx.strokeStyle = i % 2 === 0 ? "rgba(30, 167, 255, 0.26)" : "rgba(226, 27, 45, 0.2)";
    ctx.beginPath();
    ctx.moveTo(x, height * 0.12);
    ctx.lineTo(x + 92, height * 0.82);
    ctx.stroke();
  }

  ctx.restore();
}

function drawFloorPulse(width, height) {
  const floorTop = height - Math.max(48, height * 0.075);
  const offset = state.worldOffset % 52;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 210, 0, 0.18)";
  ctx.lineWidth = 1;
  for (let x = -52; x < width + 52; x += 52) {
    ctx.beginPath();
    ctx.moveTo(x - offset, floorTop);
    ctx.lineTo(x + 28 - offset, height);
    ctx.stroke();
  }
  ctx.restore();
}

// rendering obstacles
function drawObstacles() {
  for (const obstacle of state.obstacles) {
    if (!obstacle.active) {
      continue;
    }
    drawObstacle(obstacle, 1);
  }

  if (state.screen !== "playing" && state.screen !== "paused") {
    previewObstacle.x = state.view.width * 0.68;
    previewObstacle.width = Math.round(OBSTACLE_WIDTH * clamp(state.view.width / 390, 0.88, 1.08));
    previewObstacle.gap = clamp(OBSTACLE_GAP + 12, 164, 196);
    previewObstacle.gapY = state.view.height * 0.48 + Math.sin(state.elapsed * 1.1) * 16;
    previewObstacle.phase = state.elapsed;
    drawObstacle(previewObstacle, 0.28);
  }
}

function drawObstacle(obstacle, alpha) {
  const gapTop = obstacle.gapY - obstacle.gap / 2;
  const gapBottom = obstacle.gapY + obstacle.gap / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  drawObstacleSegment(obstacle, 0, gapTop, true);
  drawObstacleSegment(obstacle, gapBottom, state.view.height - gapBottom, false);
  ctx.restore();
}

function drawObstacleSegment(obstacle, y, height, isTop) {
  if (height <= 8) {
    return;
  }

  const x = obstacle.x;
  const width = obstacle.width;
  const sprite = isTop ? obstacle.topSprite : obstacle.bottomSprite;
  if (sprite) {
    ctx.drawImage(sprite.canvas, x, y, width, height);
    return;
  }

  drawObstacleBody(ctx, x, y, width, height, obstacle.type);
}

function drawObstacleBody(targetCtx, x, y, width, height, type) {
  const gradient = targetCtx.createLinearGradient(x, y, x + width, y);
  gradient.addColorStop(0, "rgba(2, 6, 14, 0.98)");
  gradient.addColorStop(0.18, "rgba(14, 27, 46, 0.98)");
  gradient.addColorStop(0.5, "rgba(32, 43, 58, 0.98)");
  gradient.addColorStop(0.82, "rgba(8, 18, 34, 0.98)");
  gradient.addColorStop(1, "rgba(1, 4, 11, 0.98)");

  roundedRect(targetCtx, x, y, width, height, 8);
  targetCtx.fillStyle = gradient;
  targetCtx.fill();
  targetCtx.strokeStyle = "rgba(126, 178, 220, 0.28)";
  targetCtx.lineWidth = 1;
  targetCtx.stroke();

  targetCtx.save();
  targetCtx.shadowColor = "#1EA7FF";
  targetCtx.shadowBlur = 6;
  targetCtx.strokeStyle = "rgba(30, 167, 255, 0.72)";
  targetCtx.lineWidth = 1.6;
  targetCtx.beginPath();
  targetCtx.moveTo(x + 6, y + 12);
  targetCtx.lineTo(x + 6, y + height - 12);
  targetCtx.moveTo(x + width - 6, y + 12);
  targetCtx.lineTo(x + width - 6, y + height - 12);
  targetCtx.stroke();
  targetCtx.restore();

  targetCtx.save();
  const ribWidth = Math.max(8, width * 0.16);
  const ribGradient = targetCtx.createLinearGradient(x, y, x + ribWidth, y);
  ribGradient.addColorStop(0, "rgba(255, 255, 255, 0.14)");
  ribGradient.addColorStop(0.52, "rgba(4, 9, 18, 0.08)");
  ribGradient.addColorStop(1, "rgba(0, 0, 0, 0.34)");
  targetCtx.fillStyle = ribGradient;
  roundedRect(targetCtx, x + 5, y + 9, ribWidth, height - 18, 5);
  targetCtx.fill();
  const ribGradientRight = targetCtx.createLinearGradient(x + width - ribWidth, y, x + width, y);
  ribGradientRight.addColorStop(0, "rgba(0, 0, 0, 0.32)");
  ribGradientRight.addColorStop(0.48, "rgba(4, 9, 18, 0.08)");
  ribGradientRight.addColorStop(1, "rgba(255, 255, 255, 0.12)");
  targetCtx.fillStyle = ribGradientRight;
  roundedRect(targetCtx, x + width - ribWidth - 5, y + 9, ribWidth, height - 18, 5);
  targetCtx.fill();
  targetCtx.restore();

  targetCtx.save();
  targetCtx.shadowColor = "#E21B2D";
  targetCtx.shadowBlur = 3;
  targetCtx.strokeStyle = "rgba(226, 27, 45, 0.7)";
  targetCtx.lineWidth = 1.5;
  for (let yy = y + 30; yy < y + height - 20; yy += 92) {
    targetCtx.beginPath();
    targetCtx.moveTo(x + width * 0.28, yy);
    targetCtx.lineTo(x + width * 0.72, yy);
    targetCtx.stroke();
  }
  targetCtx.restore();

  drawObstacleDetails(targetCtx, type, x, y, width, height);
}

function drawTrussPattern(x, y, width, height, accent) {
  ctx.save();
  ctx.strokeStyle = "rgba(175, 199, 232, 0.17)";
  ctx.lineWidth = 1;
  const step = 30;
  for (let yy = y + 12; yy < y + height; yy += step) {
    ctx.beginPath();
    ctx.moveTo(x + 12, yy);
    ctx.lineTo(x + width - 12, yy + step * 0.62);
    ctx.moveTo(x + width - 12, yy);
    ctx.lineTo(x + 12, yy + step * 0.62);
    ctx.stroke();
  }
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.62;
  ctx.fillRect(x + width * 0.5 - 1, y + 8, 2, Math.max(0, height - 16));
  ctx.restore();
}

function drawObstacleDetails(targetCtx, type, x, y, width, height) {
  targetCtx.save();
  targetCtx.globalAlpha = 0.92;

  if (type === "speakers") {
    const speakerCount = clamp(Math.floor(height / 86), 2, 3);
    const speakerGap = height / (speakerCount + 1);
    for (let i = 1; i <= speakerCount; i += 1) {
      const yy = y + speakerGap * i;
      const radius = Math.min(16, width * 0.22, Math.max(9, height * 0.055));
      const speakerGradient = targetCtx.createRadialGradient(
        x + width * 0.43,
        yy - radius * 0.36,
        radius * 0.15,
        x + width * 0.5,
        yy,
        radius,
      );
      speakerGradient.addColorStop(0, "rgba(126, 178, 220, 0.34)");
      speakerGradient.addColorStop(0.42, "rgba(13, 24, 41, 0.92)");
      speakerGradient.addColorStop(1, "rgba(0, 3, 10, 0.98)");
      targetCtx.fillStyle = speakerGradient;
      targetCtx.strokeStyle = "rgba(30, 167, 255, 0.46)";
      targetCtx.lineWidth = 1.4;
      targetCtx.beginPath();
      targetCtx.arc(x + width * 0.5, yy, radius, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.stroke();

      targetCtx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      targetCtx.lineWidth = 1;
      targetCtx.beginPath();
      targetCtx.arc(x + width * 0.5, yy, radius * 0.72, 0, Math.PI * 2);
      targetCtx.stroke();

      targetCtx.fillStyle = "rgba(1, 4, 12, 0.86)";
      targetCtx.strokeStyle = "rgba(175, 199, 232, 0.28)";
      targetCtx.beginPath();
      targetCtx.arc(x + width * 0.5, yy, radius * 0.38, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.stroke();
    }
  }

  if (type === "laser") {
    targetCtx.strokeStyle = "rgba(226, 27, 45, 0.62)";
    targetCtx.lineWidth = 2;
    for (let yy = y + 24; yy < y + height - 18; yy += 38) {
      targetCtx.beginPath();
      targetCtx.moveTo(x + 10, yy);
      targetCtx.lineTo(x + width - 10, yy);
      targetCtx.stroke();
    }
  }

  if (type === "gate") {
    targetCtx.fillStyle = "rgba(255, 210, 0, 0.42)";
    for (let yy = y + 26; yy < y + height - 18; yy += 52) {
      targetCtx.fillRect(x + 16, yy, width - 32, 4);
    }
  }

  targetCtx.restore();
}

function drawGapLights(obstacle, gapTop, gapBottom) {
  const x = obstacle.x;
  const width = obstacle.width;
  ctx.save();
  ctx.shadowColor = "#1EA7FF";
  ctx.shadowBlur = 12;
  ctx.strokeStyle = "rgba(30, 167, 255, 0.78)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 5, gapTop);
  ctx.lineTo(x + width + 5, gapTop);
  ctx.moveTo(x - 5, gapBottom);
  ctx.lineTo(x + width + 5, gapBottom);
  ctx.stroke();
  ctx.restore();
}

function drawWarningCap(x, y, width, accent) {
  ctx.save();
  ctx.fillStyle = "rgba(2, 6, 15, 0.76)";
  ctx.fillRect(x, y, width, 16);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  for (let stripe = -10; stripe < width + 18; stripe += 14) {
    ctx.beginPath();
    ctx.moveTo(x + stripe, y + 16);
    ctx.lineTo(x + stripe + 12, y);
    ctx.stroke();
  }
  ctx.restore();
}

// rendering player
function drawParticles() {
  for (const particle of state.particles) {
    if (!particle.active) {
      continue;
    }

    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBursts() {
  const burstSprite = state.renderCache.effects.burst;
  if (!burstSprite) {
    return;
  }

  for (const burst of state.bursts) {
    if (!burst.active) {
      continue;
    }

    const t = clamp(burst.life / burst.maxLife, 0, 1);
    const size = burst.size * (1.25 - t * 0.25);
    ctx.save();
    ctx.globalAlpha = t;
    ctx.translate(burst.x, burst.y);
    ctx.rotate(burst.rotation);
    ctx.drawImage(burstSprite.canvas, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
}

function drawPlayer() {
  const flapT = player.flapAnimationTime;
  const flapEase = flapT * flapT;
  const visualScale = 1 + flapEase * 0.06;
  const visualLift = -player.height * 0.08 * flapEase;
  const visualRotation = player.rotation - flapEase * 0.18;

  ctx.save();
  ctx.translate(player.x, player.y + visualLift);
  ctx.rotate(visualRotation);
  ctx.scale(visualScale, visualScale);

  drawEnergyTrail(flapEase);
  if (!drawHeroSprite()) {
    drawTechWings();
    drawCanBody();
  }

  ctx.restore();
}

function drawHeroSprite() {
  const sprite = getHeroSprite();
  if (!sprite) {
    return false;
  }

  if (player.flapAnimationTime > 0) {
    const glow = player.flapAnimationTime * player.flapAnimationTime;
    ctx.save();
    ctx.globalAlpha = 0.18 * glow;
    const radiusX = player.width * (0.68 + glow * 0.08);
    const radiusY = player.height * 0.44;
    ctx.fillStyle = "rgba(30, 167, 255, 0.55)";
    ctx.beginPath();
    ctx.ellipse(-player.width * 0.08, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.drawImage(sprite.canvas, -sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
  return true;
}

function getHeroSprite() {
  return state.renderCache.hero.idle;
}

function drawEnergyTrail(flapEase = 0) {
  ctx.save();
  const pulse = 0.3 + flapEase * 0.24;
  const tailLength = player.width * (0.64 + flapEase * 0.18);
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i += 1) {
    const t = i / 3;
    const yOffset = (i - 1.5) * player.height * 0.065;
    const wave = Math.sin(state.elapsed * 4.6 + i * 1.4) * player.height * 0.012;
    ctx.globalAlpha = pulse * (1 - t * 0.22);
    ctx.strokeStyle = i % 2 === 0 ? "rgba(30, 167, 255, 0.56)" : "rgba(128, 224, 255, 0.34)";
    ctx.lineWidth = 1 + (1 - t) * 1.45;
    ctx.beginPath();
    ctx.moveTo(-player.width * 0.36, yOffset);
    ctx.bezierCurveTo(
      -player.width * 0.52,
      yOffset + wave,
      -tailLength * 0.72,
      yOffset * 0.82 - wave,
      -tailLength,
      yOffset * 0.66,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawTechWings() {
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#1EA7FF";
  ctx.fillStyle = "rgba(30, 167, 255, 0.2)";

  drawWing(-1);
  drawWing(1);

  ctx.restore();
}

function drawWing(direction) {
  const side = direction;
  ctx.save();
  ctx.scale(side, 1);
  ctx.beginPath();
  ctx.moveTo(-player.width * 0.12, -player.height * 0.12);
  ctx.lineTo(-player.width * 0.78, -player.height * 0.48);
  ctx.lineTo(-player.width * 0.54, -player.height * 0.02);
  ctx.lineTo(-player.width * 0.82, player.height * 0.38);
  ctx.lineTo(-player.width * 0.1, player.height * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawCanBody() {
  const bodyWidth = player.width;
  const bodyHeight = player.height * 0.72;
  const x = -bodyWidth / 2;
  const y = -bodyHeight / 2;

  ctx.save();
  roundedRect(ctx, x, y, bodyWidth, bodyHeight, 10);
  ctx.clip();

  const metal = ctx.createLinearGradient(x, y, x + bodyWidth, y);
  metal.addColorStop(0, "#d8e4ef");
  metal.addColorStop(0.28, "#ffffff");
  metal.addColorStop(0.5, "#0b2c5f");
  metal.addColorStop(0.78, "#1EA7FF");
  metal.addColorStop(1, "#d7e0ec");
  ctx.fillStyle = metal;
  ctx.fillRect(x, y, bodyWidth, bodyHeight);

  ctx.fillStyle = "rgba(226, 27, 45, 0.92)";
  ctx.beginPath();
  ctx.moveTo(x + bodyWidth * 0.1, y + bodyHeight);
  ctx.lineTo(x + bodyWidth * 0.34, y);
  ctx.lineTo(x + bodyWidth * 0.48, y);
  ctx.lineTo(x + bodyWidth * 0.24, y + bodyHeight);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255, 210, 0, 0.9)";
  ctx.beginPath();
  ctx.ellipse(x + bodyWidth * 0.61, y + bodyHeight * 0.54, 5, 7, 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#E21B2D";
  ctx.font = "900 10px Segoe UI, Arial, sans-serif";
  ctx.fillText("RB", x + bodyWidth * 0.53, y + bodyHeight * 0.48);

  ctx.restore();

  ctx.save();
  ctx.shadowColor = player.impulse > 0 ? "#FFD200" : "#1EA7FF";
  ctx.shadowBlur = player.impulse > 0 ? 16 : 7;
  roundedRect(ctx, x, y, bodyWidth, bodyHeight, 10);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(255, 255, 255, 0.76)";
  ctx.fillRect(x + 8, y - 2, bodyWidth - 16, 4);
  ctx.fillRect(x + 8, y + bodyHeight - 2, bodyWidth - 16, 4);
}

// rendering HUD
function updateAllUi() {
  updateHud();
  updateStartScreen();
  updateSideReward();
  renderLeaderboards();
}

function updateHud() {
  dom.hudBest.textContent = String(state.bestScore);
  dom.hudScore.textContent = String(state.score);
  dom.hudNickname.textContent = state.nickname || "PLAYER";
  if (state.score >= WIN_SCORE || state.rewardUnlockedThisRun) {
    dom.hudProgressText.textContent = "НАГРАДА ОТКРЫТА";
    dom.hudProgressFill.style.width = "100%";
  } else {
    dom.hudProgressText.textContent = `${state.score} / ${WIN_SCORE} очков`;
    dom.hudProgressFill.style.width = `${clamp((state.score / WIN_SCORE) * 100, 0, 100)}%`;
  }
}

function updateStartScreen() {
  dom.startNickname.textContent = state.nickname || "PLAYER";
  dom.startBest.textContent = String(state.bestScore);
  dom.desktopNickname.textContent = state.nickname || "PLAYER";
  dom.desktopBest.textContent = String(state.bestScore);
}

function updateGameOverScreen() {
  const remaining = Math.max(0, WIN_SCORE - state.score);
  dom.newRecordLabel.textContent = state.newRecord ? "НОВЫЙ РЕКОРД!" : "Flipp Bull";
  dom.resultTitle.textContent = "ПОЧТИ ДОЛЕТЕЛ!";
  dom.loseNickname.textContent = state.nickname;
  dom.loseScore.textContent = String(state.score);
  dom.loseBest.textContent = String(state.bestScore);
  dom.loseRemaining.textContent = String(remaining);
  dom.resultMessage.hidden = false;
  dom.resultMessage.textContent = `До награды осталось ${remaining} очков`;
}

function updateWinScreen() {
  dom.winTitle.textContent = "НАГРАДА ОТКРЫТА!";
  dom.winRewardTitle.textContent = `Ты пролетел ${WIN_SCORE}+ препятствий и получил право на 1 банку Red Bull`;
  dom.winNickname.textContent = state.nickname;
  dom.winScore.textContent = `${state.score} очков`;
  dom.winBest.textContent = `Рекорд: ${state.bestScore}`;
  dom.claimButton.disabled = state.rewardClaimed;
  dom.claimButton.textContent = state.rewardClaimed ? "АКТИВИРОВАНО" : "ЗАБРАТЬ НАГРАДУ";
  dom.claimCopy.textContent = state.rewardClaimed ? "Награда активирована. Покажи этот экран бармену." : "Покажи экран бармену";
  dom.rewardCheck.hidden = !state.rewardClaimed;
}

function updateSideReward() {
  dom.sideRewardNickname.textContent = state.nickname ? `Игрок: ${state.nickname}` : "Игрок не выбран";
  if (state.rewardClaimed) {
    dom.sideRewardStatus.textContent = "Награда активирована";
  } else if (state.hasWon) {
    dom.sideRewardStatus.textContent = "Награда доступна";
  } else {
    dom.sideRewardStatus.textContent = `${WIN_SCORE} очков до баночки`;
  }
}

// screen transitions
function showScreen(screenName) {
  state.screen = screenName;

  Object.entries(screens).forEach(([name, screen]) => {
    screen.hidden = name !== screenName;
  });

  if (screenName === "playing") {
    Object.values(screens).forEach((screen) => {
      screen.hidden = true;
    });
  }

  dom.gameHud.hidden = !(screenName === "playing" || screenName === "paused");

  if (screenName === "win") {
    startRewardTimer();
  } else {
    stopRewardTimer();
  }

  if (screenName === "start") {
    updateStartScreen();
    updateSideReward();
  }
}

function openLeaderboard() {
  renderLeaderboards();
  dom.leaderboardModal.hidden = false;
  refreshLeaderboardFromSupabase();
}

function closeLeaderboard() {
  dom.leaderboardModal.hidden = true;
}

function openRules() {
  dom.rulesModal.hidden = false;
}

function closeRules() {
  dom.rulesModal.hidden = true;
}

// main rendering
function render() {
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawBackground();
  drawObstacles();
  drawParticles();
  drawBursts();
  drawPlayer();
  drawRewardNotice();
  drawFpsMonitor();
}

function drawRewardNotice() {
  if (state.rewardNoticeTimer <= 0 || state.screen !== "playing") {
    return;
  }

  const t = clamp(state.rewardNoticeTimer / 2.15, 0, 1);
  const fade = Math.min(1, t * 5, (1 - t) * 4 + 0.2);
  const width = Math.min(278, state.view.width - 42);
  const x = (state.view.width - width) / 2;
  const y = Math.max(92, state.view.height * 0.18);

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.fillStyle = "rgba(5, 11, 24, 0.78)";
  ctx.strokeStyle = "rgba(255, 210, 0, 0.72)";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, width, 72, 8);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#FFD200";
  ctx.font = "900 20px Inter, Segoe UI, sans-serif";
  ctx.fillText("НАГРАДА ОТКРЫТА", state.view.width / 2, y + 27);
  ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
  ctx.font = "800 12px Inter, Segoe UI, sans-serif";
  ctx.fillText("Продолжай играть на рекорд", state.view.width / 2, y + 51);
  ctx.restore();
}

function roundRect(targetCtx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  targetCtx.beginPath();
  targetCtx.moveTo(x + r, y);
  targetCtx.lineTo(x + width - r, y);
  targetCtx.quadraticCurveTo(x + width, y, x + width, y + r);
  targetCtx.lineTo(x + width, y + height - r);
  targetCtx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  targetCtx.lineTo(x + r, y + height);
  targetCtx.quadraticCurveTo(x, y + height, x, y + height - r);
  targetCtx.lineTo(x, y + r);
  targetCtx.quadraticCurveTo(x, y, x + r, y);
  targetCtx.closePath();
}

function drawVignette(targetCtx, width, height) {
  const gradient = targetCtx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.18)");
  gradient.addColorStop(0.45, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.34)");
  targetCtx.fillStyle = gradient;
  targetCtx.fillRect(0, 0, width, height);
}

function drawFpsMonitor() {
  if (!DEBUG_PERFORMANCE) {
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(5, 11, 24, 0.72)";
  ctx.fillRect(8, state.view.height - 26, 58, 18);
  ctx.fillStyle = "#AFC7E8";
  ctx.font = "700 11px Segoe UI, Arial, sans-serif";
  ctx.fillText(`${state.performance.fps} FPS`, 14, state.view.height - 13);
  ctx.restore();
}

function tick(timestamp) {
  if (!state.lastTime) {
    state.lastTime = timestamp;
  }

  const dt = Math.min((timestamp - state.lastTime) / 1000, MAX_DELTA);
  state.lastTime = timestamp;
  state.elapsed += dt;
  updateFpsMonitor(dt);

  if (state.screen === "playing") {
    updateGame(dt);
  } else if (state.screen === "paused") {
    player.impulse = Math.max(0, player.impulse - dt * 2);
    player.flapAnimationTime = Math.max(0, player.flapAnimationTime - dt * 2);
  } else {
    updateIdle(dt);
  }

  render();
  requestAnimationFrame(tick);
}

function updateFpsMonitor(dt) {
  if (!DEBUG_PERFORMANCE) {
    return;
  }

  state.performance.frameCount += 1;
  state.performance.sampleTime += dt;
  if (state.performance.sampleTime >= 0.5) {
    state.performance.fps = Math.round(state.performance.frameCount / state.performance.sampleTime);
    state.performance.frameCount = 0;
    state.performance.sampleTime = 0;
  }
}

// utilities
function roundedRect(targetCtx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  targetCtx.beginPath();
  targetCtx.moveTo(x + safeRadius, y);
  targetCtx.lineTo(x + width - safeRadius, y);
  targetCtx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  targetCtx.lineTo(x + width, y + height - safeRadius);
  targetCtx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  targetCtx.lineTo(x + safeRadius, y + height);
  targetCtx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  targetCtx.lineTo(x, y + safeRadius);
  targetCtx.quadraticCurveTo(x, y, x + safeRadius, y);
  targetCtx.closePath();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function noise(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

// boot
async function init() {
  await preloadAssets();
  loadPersistentState();
  bindInputs();
  resizeCanvas();
  dom.nicknameInput.value = state.nickname;
  updateAllUi();
  showScreen(state.nickname ? "start" : "nickname");
  if (state.nickname) {
    ensureSupabasePlayer(state.nickname).then(() => refreshLeaderboardFromSupabase());
  } else {
    refreshLeaderboardFromSupabase();
  }
  requestAnimationFrame(tick);
}

init();
