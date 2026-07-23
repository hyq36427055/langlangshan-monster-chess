const PIECE_TYPES = {
  ogre: { name: "黄眉怪", short: "黄眉怪", rank: 8 },
  tiger: { name: "虎大王", short: "虎大王", rank: 7, jumper: true },
  leopard: { name: "豹大人", short: "豹大人", rank: 6, jumper: true },
  bear: { name: "熊教头", short: "熊教头", rank: 5 },
  blackDog: { name: "黑狗大王", short: "黑狗大王", rank: 4 },
  yellowDog: { name: "黄狗大王", short: "黄狗大王", rank: 3 },
  mouse: { name: "白毛鼠精", short: "白毛鼠精", rank: 2 },
  boar: { name: "小猪妖", short: "小猪妖", rank: 1 },
};

const PIECE_IMAGE_FILES = {
  ogre: "ogre.webp",
  tiger: "tiger.webp",
  leopard: "leopard.webp",
  bear: "bear.webp",
  blackDog: "black-dog.webp",
  yellowDog: "yellow-dog.webp",
  mouse: "mouse.webp",
  boar: "boar.webp",
};

const PLAYER_NAMES = { 1: "赤霞方", 2: "青山方" };
const HUMAN_PLAYER = 1;
const AI_PLAYER = 2;
const AI_DIFFICULTY = {
  easy: { label: "简单", copy: "随机为主，适合熟悉规则" },
  normal: { label: "普通", copy: "会预判对手下一步，兼顾吃子与守洞" },
  hard: { label: "困难", copy: "最多六层推演，主动抢攻、吃子并持续压迫对方山洞" },
};
const AI_SEARCH_TIMEOUT = Symbol("ai-search-timeout");
const ROWS = 9;
const COLS = 7;

const CAVES = {
  "0,3": 2,
  "8,3": 1,
};

const TRAPS = {
  "0,2": 2,
  "0,4": 2,
  "1,3": 2,
  "7,3": 1,
  "8,2": 1,
  "8,4": 1,
};

const MOUNTAINS = new Set();
for (let row = 3; row <= 5; row += 1) {
  for (const col of [1, 2, 4, 5]) MOUNTAINS.add(`${row},${col}`);
}

const initialLayout = [
  [2, "tiger", 0, 0],
  [2, "leopard", 0, 6],
  [2, "blackDog", 1, 1],
  [2, "mouse", 1, 5],
  [2, "boar", 2, 0],
  [2, "bear", 2, 2],
  [2, "yellowDog", 2, 4],
  [2, "ogre", 2, 6],
  [1, "ogre", 6, 0],
  [1, "yellowDog", 6, 2],
  [1, "bear", 6, 4],
  [1, "boar", 6, 6],
  [1, "mouse", 7, 1],
  [1, "blackDog", 7, 5],
  [1, "leopard", 8, 0],
  [1, "tiger", 8, 6],
];

function loadSavedVolume() {
  try {
    const saved = Number.parseFloat(window.localStorage.getItem("monsterChessVolume"));
    return Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 0.65;
  } catch (error) {
    return 0.65;
  }
}

const initialSoundVolume = loadSavedVolume();

const state = {
  pieces: [],
  turn: 1,
  selectedId: null,
  moveLog: [],
  snapshots: [],
  duelMode: "attacker",
  gameMode: "ai",
  aiDifficulty: "normal",
  aiThinking: false,
  aiCompletedDepth: 0,
  aiMoveHistory: [],
  aiRepeatBroken: false,
  lastMove: null,
  animating: false,
  animationToken: 0,
  soundEnabled: initialSoundVolume > 0,
  soundVolume: initialSoundVolume,
  winner: null,
};

const network = {
  peer: null,
  connection: null,
  role: null,
  player: null,
  roomCode: "",
  status: "idle",
  pendingMove: false,
  closing: false,
};

const board = document.querySelector("#board");
const turnBanner = document.querySelector("#turnBanner");
const turnLabel = document.querySelector("#turnLabel");
const turnHint = document.querySelector("#turnHint");
const moveHistory = document.querySelector("#moveHistory");
const moveCount = document.querySelector("#moveCount");
const player1Count = document.querySelector("#player1Count");
const player2Count = document.querySelector("#player2Count");
const player1Status = document.querySelector("#player1Status");
const player2Status = document.querySelector("#player2Status");
const player1Name = document.querySelector("#player1Name");
const player1Subtitle = document.querySelector("#player1Subtitle");
const player2Name = document.querySelector("#player2Name");
const player2Subtitle = document.querySelector("#player2Subtitle");
const undoButton = document.querySelector("#undoButton");
const mobileUndoButton = document.querySelector("#mobileUndoButton");
const resetButton = document.querySelector("#resetButton");
const mobileResetButton = document.querySelector("#mobileResetButton");
const rulesModal = document.querySelector("#rulesModal");
const victoryModal = document.querySelector("#victoryModal");
const toast = document.querySelector("#toast");
const lastMoveText = document.querySelector("#lastMoveText");
const soundControl = document.querySelector("#soundControl");
const soundToggle = document.querySelector("#soundToggle");
const soundIcon = document.querySelector("#soundIcon");
const volumePanel = document.querySelector("#volumePanel");
const volumeSlider = document.querySelector("#volumeSlider");
const volumeValue = document.querySelector("#volumeValue");
const volumeMuteButton = document.querySelector("#volumeMuteButton");
const shareButton = document.querySelector("#shareButton");
const mobileShareButton = document.querySelector("#mobileShareButton");
const victoryEffectLayer = document.querySelector("#victoryEffectLayer");
const onlineRoomSetting = document.querySelector("#onlineRoomSetting");
const roomLobby = document.querySelector("#roomLobby");
const roomConnection = document.querySelector("#roomConnection");
const roomCodeInput = document.querySelector("#roomCodeInput");
const roomCodeDisplay = document.querySelector("#roomCodeDisplay");
const roomCodeBlock = document.querySelector("#roomCodeBlock");
const connectionDot = document.querySelector("#connectionDot");
const connectionLabel = document.querySelector("#connectionLabel");
const connectionCopy = document.querySelector("#connectionCopy");
const createRoomButton = document.querySelector("#createRoomButton");
const joinRoomButton = document.querySelector("#joinRoomButton");
const copyInviteButton = document.querySelector("#copyInviteButton");
const leaveRoomButton = document.querySelector("#leaveRoomButton");
const playAgainButton = document.querySelector("#playAgainButton");
let toastTimer = null;
let aiTimer = null;
let audioContext = null;
let lastAudibleVolume = initialSoundVolume > 0 ? initialSoundVolume : 0.65;

function key(row, col) {
  return `${row},${col}`;
}

function isInside(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function terrainAt(row, col) {
  const cellKey = key(row, col);
  if (MOUNTAINS.has(cellKey)) return { type: "mountain" };
  if (CAVES[cellKey]) return { type: "cave", owner: CAVES[cellKey] };
  if (TRAPS[cellKey]) return { type: "trap", owner: TRAPS[cellKey] };
  return { type: "land" };
}

function pieceAtIn(pieces, row, col) {
  return pieces.find((piece) => piece.row === row && piece.col === col) || null;
}

function pieceAt(row, col) {
  return pieceAtIn(state.pieces, row, col);
}

function createInitialPieces() {
  return initialLayout.map(([player, type, row, col], index) => ({
    id: `p${player}-${type}-${index}`,
    player,
    type,
    row,
    col,
  }));
}

function pieceImagePath(type, player = 1) {
  return `assets/pieces/player-${player}/${PIECE_IMAGE_FILES[type]}`;
}

function getAudioContext() {
  if (!state.soundEnabled) return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function playTone(frequency, offset, duration, options = {}) {
  const context = getAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + offset;
  oscillator.type = options.type || "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  if (options.to) oscillator.frequency.exponentialRampToValueAtTime(options.to, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  const toneVolume = (options.volume || 0.055) * state.soundVolume;
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, toneVolume), start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playWoodenPieceDrop() {
  const context = getAudioContext();
  if (!context) return;

  const start = context.currentTime + 0.005;
  const output = context.createGain();
  output.gain.setValueAtTime(Math.max(0.0001, state.soundVolume), start);
  output.gain.exponentialRampToValueAtTime(0.0001, start + 0.17);
  output.connect(context.destination);

  const body = context.createOscillator();
  const bodyGain = context.createGain();
  body.type = "sine";
  body.frequency.setValueAtTime(220, start);
  body.frequency.exponentialRampToValueAtTime(105, start + 0.095);
  bodyGain.gain.setValueAtTime(0.0001, start);
  bodyGain.gain.exponentialRampToValueAtTime(0.11, start + 0.003);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
  body.connect(bodyGain).connect(output);
  body.start(start);
  body.stop(start + 0.13);

  const ring = context.createOscillator();
  const ringGain = context.createGain();
  ring.type = "triangle";
  ring.frequency.setValueAtTime(720, start);
  ring.frequency.exponentialRampToValueAtTime(380, start + 0.045);
  ringGain.gain.setValueAtTime(0.0001, start);
  ringGain.gain.exponentialRampToValueAtTime(0.035, start + 0.002);
  ringGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.055);
  ring.connect(ringGain).connect(output);
  ring.start(start);
  ring.stop(start + 0.065);

  const noiseLength = Math.floor(context.sampleRate * 0.045);
  const noiseBuffer = context.createBuffer(1, noiseLength, context.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let index = 0; index < noiseLength; index += 1) {
    const envelope = 1 - index / noiseLength;
    noiseData[index] = (Math.random() * 2 - 1) * envelope * envelope;
  }
  const click = context.createBufferSource();
  const clickFilter = context.createBiquadFilter();
  const clickGain = context.createGain();
  click.buffer = noiseBuffer;
  clickFilter.type = "bandpass";
  clickFilter.frequency.setValueAtTime(1250, start);
  clickFilter.Q.setValueAtTime(0.85, start);
  clickGain.gain.setValueAtTime(0.12, start);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.045);
  click.connect(clickFilter).connect(clickGain).connect(output);
  click.start(start);
}

function saveSoundVolume() {
  try {
    window.localStorage.setItem("monsterChessVolume", String(state.soundVolume));
  } catch (error) {
    // The game still works when storage is unavailable.
  }
}

function updateVolumeUI() {
  const percent = Math.round(state.soundVolume * 100);
  volumeSlider.value = String(percent);
  volumeValue.textContent = `${percent}%`;
  volumeMuteButton.textContent = state.soundEnabled ? "静音" : "恢复";
  soundToggle.title = `调整音量，当前${percent}%`;
  soundToggle.setAttribute("aria-label", soundToggle.title);
  soundToggle.classList.toggle("muted", !state.soundEnabled);
}

function setSoundVolume(nextVolume, { preview = false } = {}) {
  state.soundVolume = Math.min(1, Math.max(0, Number(nextVolume) || 0));
  state.soundEnabled = state.soundVolume > 0;
  if (state.soundEnabled) lastAudibleVolume = state.soundVolume;
  saveSoundVolume();
  updateVolumeUI();
  if (preview && state.soundEnabled) playSound("select");
}

function playSound(kind) {
  if (!state.soundEnabled) return;
  if (kind === "select") playTone(520, 0, 0.08, { volume: 0.025 });
  if (kind === "move") playWoodenPieceDrop();
  if (kind === "capture") {
    playTone(170, 0, 0.18, { to: 80, type: "sawtooth", volume: 0.065 });
    playTone(620, 0.035, 0.1, { to: 260, type: "square", volume: 0.025 });
  }
  if (kind === "jump") {
    playTone(240, 0, 0.32, { to: 760, type: "triangle", volume: 0.045 });
    playTone(760, 0.3, 0.18, { to: 360, type: "sine", volume: 0.035 });
  }
  if (kind === "mountain") {
    playTone(185, 0, 0.3, { to: 110, type: "triangle", volume: 0.045 });
    playTone(285, 0.08, 0.22, { to: 160, type: "sine", volume: 0.03 });
  }
  if (kind === "undo") playTone(360, 0, 0.16, { to: 190, type: "triangle", volume: 0.03 });
  if (kind === "victory") {
    [392, 523.25, 659.25, 783.99].forEach((frequency, index) => {
      playTone(frequency, index * 0.12, 0.48, { type: "triangle", volume: 0.045 });
    });
  }
}

function iconMarkup(type) {
  const common = 'viewBox="0 0 64 64" aria-hidden="true" focusable="false"';
  const icons = {
    ogre: `<svg ${common}>
      <path d="M14 20 7 7l15 8M50 20 57 7 42 15" fill="#e6c45e" stroke="#24334c" stroke-width="3" stroke-linejoin="round"/>
      <path d="M15 17c7-7 27-7 34 0l-3 32c-7 8-21 8-28 0z" fill="#4d7186" stroke="#24334c" stroke-width="3"/>
      <path d="M17 26c6-5 11-4 15 1 4-5 9-6 15-1" fill="none" stroke="#24334c" stroke-width="4" stroke-linecap="round"/>
      <path d="m20 29 8 2-7 4m23-6-8 2 7 4" fill="#f4d45e" stroke="#24334c" stroke-width="2"/>
      <path d="M26 45q6 5 12 0M28 19h8" fill="none" stroke="#24334c" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    tiger: `<svg ${common}>
      <path d="m13 22-3-13 13 8m28 5 3-13-13 8" fill="#e8c789" stroke="#5c3e33" stroke-width="3"/>
      <path d="M14 22c3-12 33-12 36 0l-4 25c-8 10-20 10-28 0z" fill="#eee4d2" stroke="#5c3e33" stroke-width="3"/>
      <path d="M26 17h12m-15 4 5 6m13-6-5 6M32 18v9" stroke="#7a5137" stroke-width="3" stroke-linecap="round"/>
      <circle cx="23" cy="31" r="3" fill="#4a756b"/><circle cx="41" cy="31" r="3" fill="#4a756b"/>
      <path d="m28 39 4 3 4-3m-11 8q7 6 14 0" fill="none" stroke="#5c3e33" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    leopard: `<svg ${common}>
      <path d="m13 21-2-12 12 8m28 4 2-12-12 8" fill="#d7a65b" stroke="#49372d" stroke-width="3"/>
      <path d="M14 22c4-12 32-12 36 0l-4 25c-8 9-20 9-28 0z" fill="#dbb76d" stroke="#49372d" stroke-width="3"/>
      <g fill="#604632"><circle cx="22" cy="23" r="2.2"/><circle cx="42" cy="23" r="2.2"/><circle cx="18" cy="35" r="2.2"/><circle cx="46" cy="35" r="2.2"/><circle cx="26" cy="45" r="2"/><circle cx="38" cy="45" r="2"/></g>
      <circle cx="24" cy="31" r="3" fill="#234c4a"/><circle cx="40" cy="31" r="3" fill="#234c4a"/>
      <path d="m28 38 4 3 4-3m-10 9q6 5 12 0" fill="none" stroke="#49372d" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    bear: `<svg ${common}>
      <circle cx="17" cy="18" r="8" fill="#9b6343" stroke="#49352e" stroke-width="3"/><circle cx="47" cy="18" r="8" fill="#9b6343" stroke="#49352e" stroke-width="3"/>
      <path d="M13 30c0-16 38-16 38 0v15c-7 13-31 13-38 0z" fill="#a96c49" stroke="#49352e" stroke-width="3"/>
      <circle cx="24" cy="31" r="3" fill="#f0ca75"/><circle cx="40" cy="31" r="3" fill="#f0ca75"/>
      <ellipse cx="32" cy="42" rx="11" ry="8" fill="#d39a66"/>
      <path d="m28 39 4 4 4-4m-7 9h6" fill="none" stroke="#49352e" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    blackDog: `<svg ${common}>
      <path d="m16 20-9-8 4 24m37-16 9-8-4 24" fill="#3b4652" stroke="#202a36" stroke-width="3" stroke-linejoin="round"/>
      <path d="M15 25c3-14 31-14 34 0l-4 23c-8 8-18 8-26 0z" fill="#465463" stroke="#202a36" stroke-width="3"/>
      <path d="M17 27h11m19 0H36" stroke="#202a36" stroke-width="3" stroke-linecap="round"/>
      <circle cx="24" cy="31" r="3" fill="#e7b852"/><circle cx="40" cy="31" r="3" fill="#e7b852"/>
      <path d="m27 40 5 4 5-4m-10 9q5 4 10 0" fill="none" stroke="#202a36" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    yellowDog: `<svg ${common}>
      <path d="m16 20-9-7 5 24m36-17 9-7-5 24" fill="#c9953f" stroke="#5b422c" stroke-width="3" stroke-linejoin="round"/>
      <path d="M15 25c3-14 31-14 34 0l-4 23c-8 8-18 8-26 0z" fill="#d3a24f" stroke="#5b422c" stroke-width="3"/>
      <circle cx="24" cy="31" r="3" fill="#365b54"/><circle cx="40" cy="31" r="3" fill="#365b54"/>
      <path d="M20 24h8m16 0h-8m-9 16 5 4 5-4m-10 9q5 4 10 0" fill="none" stroke="#5b422c" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    mouse: `<svg ${common}>
      <circle cx="15" cy="19" r="11" fill="#ead9c9" stroke="#66534c" stroke-width="3"/><circle cx="49" cy="19" r="11" fill="#ead9c9" stroke="#66534c" stroke-width="3"/>
      <path d="M13 29c2-16 36-16 38 0l-8 21c-7 7-15 7-22 0z" fill="#f1e8dc" stroke="#66534c" stroke-width="3"/>
      <circle cx="24" cy="31" r="3" fill="#a44349"/><circle cx="40" cy="31" r="3" fill="#a44349"/>
      <path d="m29 42 3 3 3-3M23 46 7 43m16 7L7 53m34-7 16-3m-16 7 16 3" fill="none" stroke="#66534c" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    boar: `<svg ${common}>
      <path d="m15 21-3-12 12 9m25 3 3-12-12 9" fill="#a95745" stroke="#54342f" stroke-width="3"/>
      <path d="M14 24c4-14 32-14 36 0l-4 23c-8 9-20 9-28 0z" fill="#a95d4c" stroke="#54342f" stroke-width="3"/>
      <circle cx="24" cy="30" r="3" fill="#e8c65d"/><circle cx="40" cy="30" r="3" fill="#e8c65d"/>
      <ellipse cx="32" cy="43" rx="11" ry="8" fill="#d38a70" stroke="#54342f" stroke-width="2"/>
      <circle cx="28" cy="43" r="2" fill="#54342f"/><circle cx="36" cy="43" r="2" fill="#54342f"/>
      <path d="M21 40q-7 4-3 10m25-10q7 4 3 10" fill="#f4e5c2" stroke="#54342f" stroke-width="2"/>
    </svg>`,
  };
  return icons[type];
}

function createBoard() {
  for (const side of ["left", "right"]) {
    const mountain = document.createElement("div");
    mountain.className = `mountain-mass mountain-mass-${side}`;
    mountain.setAttribute("aria-hidden", "true");
    mountain.innerHTML = `
      <span class="mountain-peaks"></span>
      <span class="mountain-mist mountain-mist-back"></span>
      <span class="mountain-mist mountain-mist-front"></span>
      <span class="mountain-title">浪浪山</span>`;
    board.appendChild(mountain);
  }

  const pathLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  pathLayer.id = "lastMovePath";
  pathLayer.classList.add("last-move-path");
  pathLayer.setAttribute("aria-hidden", "true");
  pathLayer.innerHTML = `
    <defs>
      <marker id="trailArrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L9,4.5 L0,9 Z" class="trail-arrow" />
      </marker>
    </defs>
    <path class="trail-line" marker-end="url(#trailArrow)" />
    <circle class="trail-start" r="5" />
    <circle class="trail-end" r="7" />`;
  board.appendChild(pathLayer);

  const fragment = document.createDocumentFragment();
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.setAttribute("role", "gridcell");
      cell.addEventListener("click", handleCellClick);
      fragment.appendChild(cell);
    }
  }
  board.appendChild(fragment);
}

function createRankLegend() {
  const rankList = document.querySelector("#rankList");
  rankList.innerHTML = Object.entries(PIECE_TYPES)
    .sort(([, left], [, right]) => right.rank - left.rank)
    .map(
      ([type, info]) => `
        <div class="rank-chip" title="${info.name}，战力 ${info.rank}">
          <img src="${pieceImagePath(type, 1)}" alt="" draggable="false" loading="lazy" decoding="async" />
          <span>${info.short}</span>
          <b>${info.rank}</b>
        </div>`,
    )
    .join("");
}

function getPieceElement(piece) {
  const info = PIECE_TYPES[piece.type];
  const element = document.createElement("span");
  element.className = `piece player-${piece.player}`;
  element.dataset.pieceId = piece.id;
  element.innerHTML = `
    <span class="piece-icon"><img src="${pieceImagePath(piece.type, piece.player)}" alt="" draggable="false" decoding="async" /></span>
    <span class="piece-name" title="${info.name}">${info.short}</span>
    <span class="piece-rank">${info.rank}</span>`;
  return element;
}

function getCell(row, col) {
  return board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

function isOnlineConnected() {
  return state.gameMode === "online" && network.status === "connected" && Boolean(network.connection?.open);
}

function sanitizeRoomCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function renderOnlineRoomPanel() {
  const onlineMode = state.gameMode === "online";
  onlineRoomSetting.hidden = !onlineMode;
  if (!onlineMode) return;

  const connected = isOnlineConnected();
  roomLobby.hidden = network.status !== "idle";
  roomConnection.hidden = network.status === "idle";
  roomCodeBlock.hidden = !network.roomCode;
  roomCodeDisplay.textContent = network.roomCode || "------";
  copyInviteButton.disabled = !network.roomCode;
  leaveRoomButton.textContent = connected ? "退出房间" : "取消";
  connectionDot.className = "connection-dot";

  const statusContent = {
    creating: ["正在创建房间", "正在连接房间服务，请稍候"],
    waiting: ["等待对手加入", "把房间号或邀请链接发给另一位玩家"],
    connecting: ["正在加入房间", "正在联系房主，请稍候"],
    connected: [
      network.role === "host" ? "对手已加入" : "已进入房间",
      network.role === "host" ? "你执赤霞方，对手执青山方" : "你执青山方，房主执赤霞方",
    ],
    disconnected: ["连接已断开", "房主或对手已离开，可退出后重新连接"],
  };
  const [label, copy] = statusContent[network.status] || ["准备联网", "创建或加入一个房间"];
  connectionLabel.textContent = label;
  connectionCopy.textContent = copy;
  if (connected) connectionDot.classList.add("connected");
  if (network.status === "disconnected") connectionDot.classList.add("disconnected");
}

function renderLastMovePath() {
  const pathLayer = document.querySelector("#lastMovePath");
  if (!pathLayer) return;
  if (!state.lastMove) {
    pathLayer.classList.remove("visible", "capture-trail", "jump-trail");
    lastMoveText.textContent = "上一手：暂无";
    return;
  }

  const fromCell = getCell(state.lastMove.fromRow, state.lastMove.fromCol);
  const toCell = getCell(state.lastMove.toRow, state.lastMove.toCol);
  if (!fromCell || !toCell) return;
  const boardRect = board.getBoundingClientRect();
  const fromRect = fromCell.getBoundingClientRect();
  const toRect = toCell.getBoundingClientRect();
  const startX = fromRect.left - boardRect.left + fromRect.width / 2;
  const startY = fromRect.top - boardRect.top + fromRect.height / 2;
  const endX = toRect.left - boardRect.left + toRect.width / 2;
  const endY = toRect.top - boardRect.top + toRect.height / 2;
  const bend = state.lastMove.jump ? Math.min(boardRect.width, boardRect.height) * 0.045 : 0;
  const controlX = (startX + endX) / 2 + (startY === endY ? 0 : bend);
  const controlY = (startY + endY) / 2 - (startX === endX ? 0 : bend);

  pathLayer.setAttribute("viewBox", `0 0 ${boardRect.width} ${boardRect.height}`);
  pathLayer.querySelector(".trail-line").setAttribute(
    "d",
    bend ? `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}` : `M ${startX} ${startY} L ${endX} ${endY}`,
  );
  pathLayer.querySelector(".trail-start").setAttribute("cx", startX);
  pathLayer.querySelector(".trail-start").setAttribute("cy", startY);
  pathLayer.querySelector(".trail-end").setAttribute("cx", endX);
  pathLayer.querySelector(".trail-end").setAttribute("cy", endY);
  pathLayer.classList.toggle("capture-trail", state.lastMove.capture);
  pathLayer.classList.toggle("jump-trail", state.lastMove.jump);
  pathLayer.classList.add("visible");

  let prefix = "上一手";
  if (state.gameMode === "ai") prefix = state.lastMove.player === AI_PLAYER ? "对方上一步" : "你的上一步";
  if (state.gameMode === "online" && network.player) {
    prefix = state.lastMove.player === network.player ? "你的上一步" : "对方上一步";
  }
  lastMoveText.textContent = `${prefix}：${state.lastMove.label}`;
}

function render() {
  const selectedPiece = state.pieces.find((piece) => piece.id === state.selectedId) || null;
  const legalMoves = selectedPiece ? getLegalMoves(selectedPiece) : [];
  const legalByKey = new Map(legalMoves.map((move) => [key(move.row, move.col), move]));
  const aiTurnLocked = state.gameMode === "ai" && state.turn === AI_PLAYER;
  const onlineTurnLocked =
    state.gameMode === "online" &&
    (!isOnlineConnected() || state.turn !== network.player || network.pendingMove);

  board.classList.toggle("ai-thinking", state.aiThinking);
  board.classList.toggle("animating", state.animating);

  for (const cell of board.querySelectorAll(".cell")) {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const terrain = terrainAt(row, col);
    const piece = pieceAt(row, col);
    const move = legalByKey.get(key(row, col));

    cell.className = `cell ${terrain.type}`;
    cell.innerHTML = "";
    if (terrain.type === "mountain" && ((row === 4 && col === 1) || (row === 4 && col === 4))) {
      cell.classList.add("mountain-label");
    }
    if (piece?.id === state.selectedId) cell.classList.add("selected");
    if (move) cell.classList.add(move.target ? "legal-capture" : "legal-move");
    if (piece) cell.appendChild(getPieceElement(piece));
    cell.disabled = aiTurnLocked || onlineTurnLocked || state.animating || Boolean(state.winner);

    const parts = [`第${row + 1}行第${col + 1}列`];
    if (terrain.type === "mountain") parts.push("浪浪山");
    if (terrain.type === "trap") parts.push(`${PLAYER_NAMES[terrain.owner]}陷阱`);
    if (terrain.type === "cave") parts.push(`${PLAYER_NAMES[terrain.owner]}山洞`);
    if (piece) parts.push(`${PLAYER_NAMES[piece.player]}${PIECE_TYPES[piece.type].name}`);
    if (move) parts.push(move.target ? "可吃子" : "可移动");
    cell.setAttribute("aria-label", parts.join("，"));
    cell.setAttribute("aria-selected", piece?.id === state.selectedId ? "true" : "false");
  }

  turnBanner.classList.toggle("player-two-turn", state.turn === 2);
  renderLastMovePath();

  if (state.winner) {
    turnLabel.textContent =
      state.gameMode === "ai"
        ? `${state.winner === HUMAN_PLAYER ? "你·赤霞方" : "电脑·青山方"}获胜`
        : `${PLAYER_NAMES[state.winner]}获胜`;
    turnHint.textContent = "本局已结束";
  } else if (state.gameMode === "online" && !isOnlineConnected()) {
    turnLabel.textContent = network.status === "waiting" ? "等待对手加入" : "联网房间";
    turnHint.textContent = network.status === "idle" ? "请创建或加入房间" : "正在建立连接";
  } else if (state.gameMode === "online") {
    const isMyTurn = state.turn === network.player;
    turnLabel.textContent = isMyTurn ? "轮到你行棋" : "等待对方行棋";
    turnHint.textContent = network.pendingMove
      ? "正在等待房主确认走法"
      : `你执${PLAYER_NAMES[network.player]}`;
  } else if (state.aiThinking) {
    turnLabel.textContent = "电脑思考中";
    turnHint.textContent = state.aiDifficulty === "hard" ? "困难难度·最多6层推演" : `${AI_DIFFICULTY[state.aiDifficulty].label}难度·正在选择落点`;
  } else {
    turnLabel.textContent = `${PLAYER_NAMES[state.turn]}行棋`;
    turnHint.textContent = selectedPiece
      ? `已选 ${PIECE_TYPES[selectedPiece.type].name}·${legalMoves.length}个落点`
      : "请选择一枚棋子";
  }

  player1Status.classList.toggle("active", state.turn === 1 && !state.winner);
  player2Status.classList.toggle("active", state.turn === 2 && !state.winner);
  if (state.gameMode === "online") {
    player1Name.textContent = network.player === 1 ? "你·赤霞方" : "房主·赤霞方";
    player1Subtitle.textContent = network.player === 1 ? "你向上攻入对方山洞" : "对方向上攻入山洞";
    player2Name.textContent = network.player === 2 ? "你·青山方" : "对手·青山方";
    player2Subtitle.textContent = network.player === 2 ? "你向下攻入对方山洞" : "对方向下攻入山洞";
  } else {
    player1Name.textContent = state.gameMode === "ai" ? "你·赤霞方" : "赤霞方";
    player1Subtitle.textContent = "向上攻入对方山洞";
    player2Name.textContent = state.gameMode === "ai" ? "电脑·青山方" : "青山方";
    player2Subtitle.textContent =
      state.gameMode === "ai"
        ? `${AI_DIFFICULTY[state.aiDifficulty].label}难度，向下攻入山洞`
        : "向下攻入对方山洞";
  }
  player1Count.textContent = String(state.pieces.filter((piece) => piece.player === 1).length);
  player2Count.textContent = String(state.pieces.filter((piece) => piece.player === 2).length);
  moveCount.textContent = `${state.moveLog.length} 回合`;

  if (state.moveLog.length === 0) {
    moveHistory.innerHTML = '<li class="empty-history">对局开始，赤霞方先行</li>';
  } else {
    moveHistory.innerHTML = state.moveLog
      .map((entry, index) => `<li><b>${index + 1}.</b> ${entry}</li>`)
      .join("");
    moveHistory.scrollTop = moveHistory.scrollHeight;
  }

  const canUndo = state.gameMode !== "online" && state.snapshots.length > 0;
  undoButton.disabled = !canUndo;
  mobileUndoButton.disabled = !canUndo;
  const settingsLocked =
    state.moveLog.length > 0 || state.aiThinking || state.animating ||
    (state.gameMode === "online" && network.status !== "idle");
  document.querySelectorAll("[data-game-mode]").forEach((button) => {
    button.disabled = settingsLocked;
    button.classList.toggle("selected", button.dataset.gameMode === state.gameMode);
  });
  document.querySelectorAll("[data-ai-difficulty]").forEach((button) => {
    button.disabled = settingsLocked || state.gameMode !== "ai";
    button.classList.toggle("selected", button.dataset.aiDifficulty === state.aiDifficulty);
  });
  document.querySelector("#difficultySetting").hidden = state.gameMode === "online";
  document.querySelector("#difficultySetting").classList.toggle("inactive", state.gameMode !== "ai");
  document.querySelector("#gameModeCopy").textContent =
    state.gameMode === "ai"
      ? "你执赤霞方，电脑执青山方"
      : state.gameMode === "online"
        ? "创建房间或输入房间号，与朋友实时对战"
        : "两位玩家在同一设备上轮流行棋";
  document.querySelector("#difficultyCopy").textContent = AI_DIFFICULTY[state.aiDifficulty].copy;
  const guestCannotReset = state.gameMode === "online" && network.role === "guest" && network.status === "connected";
  resetButton.disabled = guestCannotReset || state.animating;
  mobileResetButton.disabled = guestCannotReset || state.animating;
  playAgainButton.disabled = guestCannotReset;
  playAgainButton.textContent = guestCannotReset ? "等待房主重开" : "再来一局";
  updateVolumeUI();
  renderOnlineRoomPanel();
}

function wait(duration) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function playMoveAnimation(piece, move) {
  const fromCell = getCell(piece.row, piece.col);
  const toCell = getCell(move.row, move.col);
  const sourcePiece = fromCell?.querySelector(".piece");
  if (!fromCell || !toCell || !sourcePiece || prefersReducedMotion()) {
    if (move.jump) playSound("jump");
    else if (terrainAt(move.row, move.col).type === "mountain") playSound("mountain");
    await wait(80);
    playSound("move");
    return;
  }

  const boardRect = board.getBoundingClientRect();
  const fromRect = sourcePiece.getBoundingClientRect();
  const toRect = toCell.getBoundingClientRect();
  const clone = getPieceElement(piece);
  const destinationTerrain = terrainAt(move.row, move.col);
  const entersMountain = piece.type === "boar" && destinationTerrain.type === "mountain";
  const deltaX = toRect.left + (toRect.width - fromRect.width) / 2 - fromRect.left;
  const deltaY = toRect.top + (toRect.height - fromRect.height) / 2 - fromRect.top;
  let duration = 300;
  let keyframes = [
    { transform: "translate3d(0, 0, 0) scale(1)", filter: "brightness(1)" },
    { transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(1)`, filter: "brightness(1.06)" },
  ];

  clone.classList.add("effect-piece");
  clone.style.left = `${fromRect.left - boardRect.left}px`;
  clone.style.top = `${fromRect.top - boardRect.top}px`;
  clone.style.width = `${fromRect.width}px`;
  clone.style.height = `${fromRect.height}px`;
  board.appendChild(clone);
  sourcePiece.classList.add("animation-source");

  if (move.jump) {
    duration = 680;
    const lift = Math.min(48, boardRect.height * 0.07);
    keyframes = [
      { transform: "translate3d(0, 0, 0) scale(1)", filter: "drop-shadow(0 3px 2px rgba(0,0,0,.35))" },
      { transform: `translate3d(${deltaX * 0.5}px, ${deltaY * 0.5 - lift}px, 0) scale(1.17) rotate(-3deg)`, filter: "drop-shadow(0 18px 9px rgba(0,0,0,.38))", offset: 0.5 },
      { transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(1) rotate(0deg)`, filter: "drop-shadow(0 4px 2px rgba(0,0,0,.32))" },
    ];
    clone.classList.add("jumping-piece");
    playSound("jump");
  } else if (entersMountain) {
    duration = 540;
    keyframes = [
      { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 },
      { transform: `translate3d(${deltaX * 0.68}px, ${deltaY * 0.68}px, 0) scale(0.92)`, opacity: 1, offset: 0.68 },
      { transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(0.72)`, opacity: 0.72 },
    ];
    clone.classList.add("mountain-entry-piece");
    playSound("mountain");
  }

  try {
    await clone.animate(keyframes, { duration, easing: move.jump ? "cubic-bezier(.2,.72,.18,1)" : "cubic-bezier(.22,.75,.3,1)", fill: "forwards" }).finished;
  } catch (error) {
    // Animation cancellation is harmless when a game is reset.
  }
  clone.remove();
  sourcePiece.classList.remove("animation-source");
  playSound("move");
}

function playCellEffect(row, col, kind) {
  const cell = getCell(row, col);
  if (!cell || prefersReducedMotion()) return;
  const effect = document.createElement("span");
  effect.className = `cell-effect ${kind}-effect`;
  const particleCount = kind === "capture" ? 8 : 6;
  for (let index = 0; index < particleCount; index += 1) {
    const particle = document.createElement("i");
    particle.style.setProperty("--particle-index", String(index));
    particle.style.setProperty("--particle-angle", `${(360 / particleCount) * index}deg`);
    effect.appendChild(particle);
  }
  cell.appendChild(effect);
  window.setTimeout(() => effect.remove(), kind === "capture" ? 700 : 850);
}

function clearVictoryEffects() {
  victoryEffectLayer.replaceChildren();
  victoryEffectLayer.classList.remove("active", "player-one", "player-two");
  document.body.classList.remove("victory-celebrating");
}

function playVictoryCelebration(player) {
  clearVictoryEffects();
  victoryEffectLayer.classList.add("active", player === 1 ? "player-one" : "player-two");
  document.body.classList.add("victory-celebrating");
  for (let index = 0; index < 34; index += 1) {
    const ribbon = document.createElement("span");
    ribbon.className = "victory-ribbon";
    ribbon.style.setProperty("--x", `${4 + Math.random() * 92}vw`);
    ribbon.style.setProperty("--delay", `${Math.random() * 0.65}s`);
    ribbon.style.setProperty("--duration", `${1.8 + Math.random() * 1.6}s`);
    ribbon.style.setProperty("--drift", `${-80 + Math.random() * 160}px`);
    ribbon.style.setProperty("--spin", `${180 + Math.random() * 720}deg`);
    victoryEffectLayer.appendChild(ribbon);
  }
  playSound("victory");
  window.setTimeout(() => document.body.classList.remove("victory-celebrating"), 1600);
}

function getCombatForState(attacker, defender, destination, duelMode = state.duelMode) {
  const trapOwner = terrainAt(destination.row, destination.col).owner;
  if (trapOwner === attacker.player && defender.player !== trapOwner) return "capture";
  if (attacker.type === "boar" && defender.type === "ogre") return "capture";
  if (attacker.type === "ogre" && defender.type === "boar") return "counter";

  const attackerRank = PIECE_TYPES[attacker.type].rank;
  const defenderRank = PIECE_TYPES[defender.type].rank;
  if (attackerRank === defenderRank) return "capture";
  return attackerRank > defenderRank ? "capture" : "blocked";
}

function getCombat(attacker, defender, destination) {
  return getCombatForState(attacker, defender, destination, state.duelMode);
}

function validateDestinationForState(piece, row, col, pieces, duelMode, options = {}) {
  if (!isInside(row, col)) return null;
  const terrain = terrainAt(row, col);
  if (terrain.type === "mountain" && piece.type !== "boar") return null;
  if (terrain.type === "cave" && terrain.owner === piece.player) return null;

  const target = pieceAtIn(pieces, row, col);
  if (target?.player === piece.player) return null;
  const combat = target ? getCombatForState(piece, target, { row, col }, duelMode) : "move";
  if (combat === "blocked") return null;
  return { row, col, target, combat, jump: Boolean(options.jump) };
}

function validateDestination(piece, row, col, options = {}) {
  return validateDestinationForState(piece, row, col, state.pieces, state.duelMode, options);
}

function findJumpForState(piece, rowStep, colStep, pieces, duelMode) {
  let row = piece.row + rowStep;
  let col = piece.col + colStep;
  if (!isInside(row, col) || terrainAt(row, col).type !== "mountain") return null;

  let blockedByBoar = false;
  while (isInside(row, col) && terrainAt(row, col).type === "mountain") {
    const mountainPiece = pieceAtIn(pieces, row, col);
    if (mountainPiece?.type === "boar") blockedByBoar = true;
    row += rowStep;
    col += colStep;
  }

  if (blockedByBoar || !isInside(row, col)) return null;
  return validateDestinationForState(piece, row, col, pieces, duelMode, { jump: true });
}

function findJump(piece, rowStep, colStep) {
  return findJumpForState(piece, rowStep, colStep, state.pieces, state.duelMode);
}

function getLegalMovesForState(piece, pieces, duelMode = state.duelMode) {
  const moves = [];
  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  for (const [rowStep, colStep] of directions) {
    const row = piece.row + rowStep;
    const col = piece.col + colStep;
    const adjacentTerrain = isInside(row, col) ? terrainAt(row, col) : null;

    if (adjacentTerrain?.type === "mountain" && PIECE_TYPES[piece.type].jumper) {
      const jump = findJumpForState(piece, rowStep, colStep, pieces, duelMode);
      if (jump) moves.push(jump);
      continue;
    }

    const move = validateDestinationForState(piece, row, col, pieces, duelMode);
    if (move) moves.push(move);
  }
  return moves;
}

function getLegalMoves(piece) {
  return getLegalMovesForState(piece, state.pieces, state.duelMode);
}

function getAllActions(player, pieces) {
  const actions = [];
  for (const piece of pieces) {
    if (piece.player !== player) continue;
    for (const move of getLegalMovesForState(piece, pieces, state.duelMode)) {
      actions.push({
        player,
        pieceId: piece.id,
        pieceType: piece.type,
        fromRow: piece.row,
        fromCol: piece.col,
        row: move.row,
        col: move.col,
        targetId: move.target?.id || null,
        targetType: move.target?.type || null,
        combat: move.combat,
        jump: move.jump,
      });
    }
  }
  return actions;
}

function simulateAction(pieces, action) {
  let nextPieces = pieces.map((piece) => ({ ...piece }));
  const attacker = nextPieces.find((piece) => piece.id === action.pieceId);
  const target = action.targetId ? nextPieces.find((piece) => piece.id === action.targetId) : null;
  let attackerSurvives = true;

  if (action.combat === "counter") {
    nextPieces = nextPieces.filter((piece) => piece.id !== action.pieceId);
    attackerSurvives = false;
  } else {
    if (target) nextPieces = nextPieces.filter((piece) => piece.id !== target.id);
    const survivor = nextPieces.find((piece) => piece.id === action.pieceId);
    survivor.row = action.row;
    survivor.col = action.col;
  }

  const destination = terrainAt(action.row, action.col);
  const winner =
    attackerSurvives && destination.type === "cave" && destination.owner !== attacker.player
      ? attacker.player
      : null;
  return { pieces: nextPieces, winner, nextTurn: action.player === 1 ? 2 : 1 };
}

function pieceValue(type) {
  const rank = PIECE_TYPES[type].rank;
  let value = 24 + rank * rank * 4;
  if (type === "boar") value += 44;
  if (type === "tiger" || type === "leopard") value += 18;
  return value;
}

function threatValue(actions) {
  const threatenedPieces = new Map();
  let value = 0;
  for (const action of actions) {
    const destination = terrainAt(action.row, action.col);
    if (destination.type === "cave" && destination.owner !== action.player) value += 6500;
    if (!action.targetId || action.combat === "counter") continue;
    const captureValue = pieceValue(action.targetType) * 0.28;
    threatenedPieces.set(action.targetId, Math.max(threatenedPieces.get(action.targetId) || 0, captureValue));
  }
  for (const captureValue of threatenedPieces.values()) value += captureValue;
  return value;
}

function evaluatePosition(pieces, winner = null) {
  if (winner === AI_PLAYER) return 100000;
  if (winner === HUMAN_PLAYER) return -100000;

  const hardAggression = state.aiDifficulty === "hard";
  let score = 0;
  for (const piece of pieces) {
    const direction = piece.player === AI_PLAYER ? 1 : -1;
    const targetRow = piece.player === AI_PLAYER ? 8 : 0;
    const ownCaveRow = piece.player === AI_PLAYER ? 0 : 8;
    const targetDistance = Math.abs(piece.row - targetRow) + Math.abs(piece.col - 3);
    const ownCaveDistance = Math.abs(piece.row - ownCaveRow) + Math.abs(piece.col - 3);
    let positional = (11 - targetDistance) * 4 + Math.max(0, 5 - ownCaveDistance) * 2;
    const terrain = terrainAt(piece.row, piece.col);

    if (targetDistance <= 2) positional += (3 - targetDistance) * 42;
    if (terrain.type === "trap" && terrain.owner !== piece.player) positional -= 30 + pieceValue(piece.type) * 0.34;
    if (terrain.type === "mountain" && piece.type === "boar") positional += 10;
    if (hardAggression && piece.player === AI_PLAYER) {
      const forwardProgress = piece.row;
      positional += forwardProgress * 6 + Math.max(0, 6 - targetDistance) * 10;
      if (targetDistance <= 3) positional += (4 - targetDistance) * 28;
    }
    score += direction * (pieceValue(piece.type) + positional);
  }

  const aiActions = getAllActions(AI_PLAYER, pieces);
  const humanActions = getAllActions(HUMAN_PLAYER, pieces);
  score += (aiActions.length - humanActions.length) * (hardAggression ? 1.15 : 0.8);
  score += hardAggression
    ? threatValue(aiActions) * 1.65 - threatValue(humanActions) * 0.95
    : threatValue(aiActions) - threatValue(humanActions);
  return score;
}

function tacticalScore(action) {
  const destination = terrainAt(action.row, action.col);
  if (destination.type === "cave" && destination.owner !== action.player) return 50000;
  if (action.combat === "counter") return -3000;

  let score = 0;
  if (action.targetType) {
    score += pieceValue(action.targetType) * 1.4;
  }
  const forward = action.player === AI_PLAYER ? action.row - action.fromRow : action.fromRow - action.row;
  score += forward * 9;
  if (action.jump) score += 7;
  if (destination.type === "trap" && destination.owner !== action.player) score -= 24;
  return score;
}

function hardAttackBonus(action) {
  if (state.aiDifficulty !== "hard" || action.player !== AI_PLAYER) return 0;
  const destination = terrainAt(action.row, action.col);
  const targetDistance = Math.abs(8 - action.row) + Math.abs(3 - action.col);
  const forward = action.row - action.fromRow;
  let bonus = forward * 22 + Math.max(0, 7 - targetDistance) * 5;

  if (action.targetType) bonus += 42 + pieceValue(action.targetType) * 0.72;
  if (targetDistance <= 3) bonus += (4 - targetDistance) * 38;
  if (action.jump) bonus += 18;
  if (destination.type === "trap" && destination.owner !== AI_PLAYER) bonus -= 38;
  return bonus;
}

function searchPosition(pieces, turn, depth, alpha, beta, winner = null, deadline = Infinity) {
  if (Date.now() > deadline) throw AI_SEARCH_TIMEOUT;
  if (winner || depth === 0) return evaluatePosition(pieces, winner);
  const actions = getAllActions(turn, pieces).sort((left, right) => tacticalScore(right) - tacticalScore(left));
  if (actions.length === 0) return evaluatePosition(pieces) + (turn === AI_PLAYER ? -80 : 80);

  const candidateLimit = depth >= 4 ? 6 : depth === 3 ? 8 : depth === 2 ? 12 : 18;
  const candidates = actions.slice(0, candidateLimit);
  if (turn === AI_PLAYER) {
    let best = -Infinity;
    for (const action of candidates) {
      const result = simulateAction(pieces, action);
      best = Math.max(
        best,
        searchPosition(result.pieces, result.nextTurn, depth - 1, alpha, beta, result.winner, deadline),
      );
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const action of candidates) {
    const result = simulateAction(pieces, action);
    best = Math.min(
      best,
      searchPosition(result.pieces, result.nextTurn, depth - 1, alpha, beta, result.winner, deadline),
    );
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function repetitionPenalty(action) {
  let penalty = 0;
  for (const previous of state.aiMoveHistory.slice(-5)) {
    if (action.pieceId !== previous.pieceId) continue;
    if (action.row === previous.fromRow && action.col === previous.fromCol) penalty += 34;
    if (action.row === previous.toRow && action.col === previous.toCol) penalty += 14;
  }
  return penalty;
}

function filterRepetitiveAIActions(actions) {
  state.aiRepeatBroken = false;
  board.dataset.repetitionBreak = "false";
  const recent = state.aiMoveHistory.slice(-5);
  if (recent.length < 5) return actions;
  const repeatedPieceId = recent[0].pieceId;
  const samePiece = recent.every((move) => move.pieceId === repeatedPieceId);
  const repeatedCells = new Set(
    recent.flatMap((move) => [key(move.fromRow, move.fromCol), key(move.toRow, move.toCol)]),
  );
  if (!samePiece || repeatedCells.size > 2) return actions;

  const alternatives = actions.filter(
    (action) => action.pieceId !== repeatedPieceId || !repeatedCells.has(key(action.row, action.col)),
  );
  if (alternatives.length === 0) return actions;
  state.aiRepeatBroken = true;
  board.dataset.repetitionBreak = "true";
  return alternatives;
}

function findBestAIAction(actions, depth, deadline = Infinity, addNoise = false) {
  const orderedActions = [...actions].sort((left, right) => tacticalScore(right) - tacticalScore(left));
  let bestAction = orderedActions[0];
  let bestScore = -Infinity;
  for (const action of orderedActions) {
    if (Date.now() > deadline) throw AI_SEARCH_TIMEOUT;
    const result = simulateAction(state.pieces, action);
    const score =
      searchPosition(result.pieces, result.nextTurn, depth, -Infinity, Infinity, result.winner, deadline) +
      tacticalScore(action) * (depth >= 2 ? 0.08 : 0.16) +
      hardAttackBonus(action) * (depth >= 2 ? 0.42 : 0.7) +
      (addNoise ? Math.random() * 4 : 0) -
      repetitionPenalty(action);
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }
  return bestAction;
}

function chooseAIMove() {
  state.aiRepeatBroken = false;
  board.dataset.repetitionBreak = "false";
  let actions = getAllActions(AI_PLAYER, state.pieces);
  if (actions.length === 0) return null;
  const winningMoves = actions.filter((action) => {
    const terrain = terrainAt(action.row, action.col);
    return terrain.type === "cave" && terrain.owner !== AI_PLAYER;
  });
  if (winningMoves.length > 0) return winningMoves[Math.floor(Math.random() * winningMoves.length)];
  actions = filterRepetitiveAIActions(actions);

  if (state.aiDifficulty === "easy") {
    state.aiCompletedDepth = 1;
    board.dataset.aiDepth = "1";
    const safeActions = actions.filter((action) => action.combat !== "counter");
    const candidates = safeActions.length > 0 ? safeActions : actions;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  if (state.aiDifficulty === "normal") {
    state.aiCompletedDepth = 2;
    board.dataset.aiDepth = "2";
    return findBestAIAction(actions, 1, Infinity, true);
  }

  let bestAction = findBestAIAction(actions, 1);
  state.aiCompletedDepth = 2;
  const deadline = Date.now() + 5200;
  for (const depth of [2, 3, 4, 5]) {
    try {
      bestAction = findBestAIAction(actions, depth, deadline);
      state.aiCompletedDepth = depth + 1;
    } catch (error) {
      if (error !== AI_SEARCH_TIMEOUT) throw error;
      break;
    }
  }
  board.dataset.aiDepth = String(state.aiCompletedDepth);
  return bestAction;
}

function cancelAI() {
  window.clearTimeout(aiTimer);
  aiTimer = null;
  state.aiThinking = false;
}

function scheduleAI() {
  if (state.gameMode !== "ai" || state.turn !== AI_PLAYER || state.winner) return;
  cancelAI();
  state.aiThinking = true;
  state.selectedId = null;
  render();

  aiTimer = window.setTimeout(() => {
    const thinkStartedAt = Date.now();
    const action = chooseAIMove();
    board.dataset.aiThinkMs = String(Date.now() - thinkStartedAt);
    if (!action) {
      state.aiThinking = false;
      state.turn = HUMAN_PLAYER;
      state.moveLog.push("电脑无棋可走，跳过本回合");
      render();
      return;
    }

    state.selectedId = action.pieceId;
    render();
    aiTimer = window.setTimeout(() => {
      const piece = state.pieces.find((item) => item.id === action.pieceId);
      const move = piece
        ? getLegalMoves(piece).find((candidate) => candidate.row === action.row && candidate.col === action.col)
        : null;
      state.aiThinking = false;
      if (!piece || !move) {
        state.selectedId = null;
        scheduleAI();
        return;
      }
      applyMove(piece, move);
    }, 320);
  }, 420);
}

const ROOM_PEER_PREFIX = "langlangshan-yaoguaiqi-";
const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
let peerJsLoadPromise = null;

function ensurePeerJs() {
  if (typeof window.Peer === "function") return Promise.resolve();
  if (peerJsLoadPromise) return peerJsLoadPromise;

  peerJsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "assets/vendor/peerjs.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      peerJsLoadPromise = null;
      reject(new Error("PeerJS failed to load"));
    };
    document.head.appendChild(script);
  });
  return peerJsLoadPromise;
}

function generateRoomCode() {
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

function createNetworkSnapshot() {
  return {
    pieces: state.pieces.map((piece) => ({ ...piece })),
    turn: state.turn,
    moveLog: [...state.moveLog],
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    winner: state.winner,
  };
}

function destroyNetworkTransport() {
  network.closing = true;
  try {
    if (network.connection?.open) network.connection.close();
    if (network.peer && !network.peer.destroyed) network.peer.destroy();
  } catch (error) {
    // Closing an already-closed WebRTC transport is harmless.
  }
  network.peer = null;
  network.connection = null;
  network.closing = false;
}

function resetNetworkRuntime() {
  network.role = null;
  network.player = null;
  network.roomCode = "";
  network.status = "idle";
  network.pendingMove = false;
}

function sendNetworkMessage(message) {
  if (!network.connection?.open) return false;
  network.connection.send(message);
  return true;
}

function broadcastNetworkState(action = null, event = "move") {
  if (network.role !== "host" || !network.connection?.open) return;
  sendNetworkMessage({
    type: "state",
    event,
    action,
    snapshot: createNetworkSnapshot(),
  });
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (error) {
    const helper = document.createElement("textarea");
    helper.value = value;
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    const copied = document.execCommand("copy");
    helper.remove();
    return copied;
  }
}

function getInviteLink() {
  const invite = new URL(window.location.href);
  invite.search = "";
  invite.hash = "";
  invite.searchParams.set("room", network.roomCode);
  return invite.toString();
}

function getShareLink() {
  if (state.gameMode === "online" && network.roomCode) return getInviteLink();
  const shareUrl = new URL(window.location.href);
  shareUrl.search = "";
  shareUrl.hash = "";
  return shareUrl.toString();
}

async function shareGame() {
  const isRoomInvite = state.gameMode === "online" && network.roomCode;
  const shareData = {
    title: "浪浪山·妖怪棋",
    text: isRoomInvite
      ? `来我的浪浪山房间对战，房间号：${network.roomCode}`
      : "来和我玩《浪浪山·妖怪棋》，支持人机和好友对战。",
    url: getShareLink(),
  };

  if (typeof navigator.share === "function") {
    try {
      await navigator.share(shareData);
      showToast("分享面板已打开");
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  const copied = await copyText(`${shareData.text}\n${shareData.url}`);
  showToast(copied ? "游戏链接已复制，发给好友即可" : "复制失败，请复制浏览器地址分享");
}

function handleNetworkDisconnect(message = "对方已离开房间") {
  if (network.closing) return;
  network.status = "disconnected";
  network.pendingMove = false;
  state.selectedId = null;
  render();
  showToast(message);
}

function handlePeerError(error) {
  if (network.closing) return;
  if (error?.type === "peer-unavailable") {
    handleNetworkDisconnect("未找到房间，请确认房间号或让房主保持页面打开");
    return;
  }
  if (error?.type === "unavailable-id" && network.role === "host") {
    startHostPeer();
    return;
  }
  handleNetworkDisconnect("联网失败，请检查网络后重新尝试");
}

function bindNetworkConnection(connection) {
  if (network.connection && network.connection !== connection && network.connection.open) {
    connection.close();
    return;
  }
  network.connection = connection;

  connection.on("open", () => {
    if (network.connection !== connection) return;
    network.status = "connected";
    network.pendingMove = false;
    if (network.role === "host") {
      resetGame({ silent: true, force: true, networkBroadcast: false });
      sendNetworkMessage({ type: "welcome", snapshot: createNetworkSnapshot() });
    }
    render();
    showToast(network.role === "host" ? "对手已加入，联网对局开始" : "已进入房间，你执青山方");
  });

  connection.on("data", (message) => {
    handleNetworkMessage(message);
  });

  connection.on("close", () => {
    if (network.connection !== connection || network.closing) return;
    network.connection = null;
    handleNetworkDisconnect();
  });

  connection.on("error", () => {
    if (network.connection !== connection) return;
    handleNetworkDisconnect("对局连接出现异常，请重新进入房间");
  });
}

function startHostPeer() {
  destroyNetworkTransport();
  if (typeof window.Peer !== "function") {
    network.status = "disconnected";
    render();
    showToast("联网组件未加载，请刷新页面后重试");
    return;
  }

  network.role = "host";
  network.player = 1;
  network.roomCode = generateRoomCode();
  network.status = "creating";
  network.pendingMove = false;
  render();

  const peer = new window.Peer(`${ROOM_PEER_PREFIX}${network.roomCode}`, { debug: 1 });
  network.peer = peer;
  peer.on("open", () => {
    if (network.peer !== peer) return;
    network.status = "waiting";
    render();
  });
  peer.on("connection", (connection) => {
    if (connection.metadata?.game !== "langlangshan-yaoguaiqi-v1") {
      connection.close();
      return;
    }
    bindNetworkConnection(connection);
  });
  peer.on("error", handlePeerError);
  peer.on("disconnected", () => {
    if (network.peer === peer && network.status !== "connected") {
      handleNetworkDisconnect("房间服务连接中断，请重新创建房间");
    }
  });
}

async function createOnlineRoom() {
  if (state.gameMode !== "online") state.gameMode = "online";
  render();
  showToast("正在加载联网组件");
  try {
    await ensurePeerJs();
  } catch (error) {
    showToast("联网组件加载失败，请检查网络后重试");
    return;
  }
  startHostPeer();
}

async function joinOnlineRoom(rawCode = roomCodeInput.value) {
  const roomCode = sanitizeRoomCode(rawCode);
  roomCodeInput.value = roomCode;
  if (roomCode.length !== 6) {
    showToast("请输入完整的6位房间号");
    return;
  }
  state.gameMode = "online";
  render();
  showToast("正在加载联网组件");
  try {
    await ensurePeerJs();
  } catch (error) {
    showToast("联网组件加载失败，请检查网络后重试");
    return;
  }

  destroyNetworkTransport();
  network.role = "guest";
  network.player = 2;
  network.roomCode = roomCode;
  network.status = "connecting";
  network.pendingMove = false;
  render();

  const peer = new window.Peer(undefined, { debug: 1 });
  network.peer = peer;
  peer.on("open", () => {
    if (network.peer !== peer) return;
    const connection = peer.connect(`${ROOM_PEER_PREFIX}${roomCode}`, {
      reliable: true,
      serialization: "json",
      metadata: { game: "langlangshan-yaoguaiqi-v1" },
    });
    bindNetworkConnection(connection);
  });
  peer.on("error", handlePeerError);
  peer.on("disconnected", () => {
    if (network.peer === peer && network.status !== "connected") {
      handleNetworkDisconnect("房间服务连接中断，请重新加入");
    }
  });
}

function leaveOnlineRoom(options = {}) {
  const hadRoom = network.status !== "idle";
  if (network.connection?.open) sendNetworkMessage({ type: "leave" });
  destroyNetworkTransport();
  resetNetworkRuntime();
  resetGame({ silent: true, force: true, networkBroadcast: false });
  render();
  if (hadRoom && !options.silent) showToast("已退出联网房间");
}

function requestOnlineMove(piece, move) {
  if (!isOnlineConnected() || network.role !== "guest") return;
  network.pendingMove = true;
  state.selectedId = null;
  sendNetworkMessage({
    type: "move-request",
    action: { pieceId: piece.id, row: move.row, col: move.col },
  });
  render();
}

async function applyNetworkSnapshot(snapshot, action = null) {
  if (!snapshot || !Array.isArray(snapshot.pieces) || !Array.isArray(snapshot.moveLog)) return;
  const currentPiece = action ? state.pieces.find((piece) => piece.id === action.pieceId) : null;
  const currentMove = currentPiece
    ? getLegalMoves(currentPiece).find((move) => move.row === action.row && move.col === action.col)
    : null;

  if (currentPiece && currentMove && !state.animating) {
    const animationToken = ++state.animationToken;
    state.animating = true;
    render();
    await playMoveAnimation(currentPiece, currentMove);
    if (animationToken !== state.animationToken) return;
  }

  state.pieces = snapshot.pieces.map((piece) => ({ ...piece }));
  state.turn = snapshot.turn;
  state.moveLog = [...snapshot.moveLog];
  state.lastMove = snapshot.lastMove ? { ...snapshot.lastMove } : null;
  state.winner = snapshot.winner || null;
  state.snapshots = [];
  state.selectedId = null;
  state.animating = false;
  network.pendingMove = false;
  victoryModal.hidden = true;
  clearVictoryEffects();
  render();

  if (action?.capture) {
    playSound("capture");
    playCellEffect(action.row, action.col, "capture");
  } else if (action?.destination === "mountain") {
    playCellEffect(action.row, action.col, "mountain");
  } else if (action?.jump) {
    playCellEffect(action.row, action.col, "landing");
  }
  if (state.winner) window.setTimeout(() => showVictory(state.winner), 220);
}

async function handleNetworkMessage(message) {
  if (!message || typeof message !== "object") return;
  if (message.type === "leave") {
    const connection = network.connection;
    network.connection = null;
    if (connection?.open) connection.close();
    handleNetworkDisconnect();
    return;
  }

  if (network.role === "host" && message.type === "move-request") {
    const action = message.action || {};
    const piece = state.pieces.find((item) => item.id === action.pieceId);
    const move = piece
      ? getLegalMoves(piece).find((candidate) => candidate.row === action.row && candidate.col === action.col)
      : null;
    const valid =
      isOnlineConnected() && !state.winner && !state.animating && state.turn === 2 && piece?.player === 2 && move;
    if (!valid) {
      sendNetworkMessage({ type: "move-rejected", reason: "这一步当前无法执行，请重试" });
      broadcastNetworkState(null, "resync");
      return;
    }
    await applyMove(piece, move);
    return;
  }

  if (network.role === "guest" && (message.type === "welcome" || message.type === "state")) {
    await applyNetworkSnapshot(message.snapshot, message.action || null);
    return;
  }

  if (network.role === "guest" && message.type === "move-rejected") {
    network.pendingMove = false;
    state.selectedId = null;
    render();
    showToast(message.reason || "房主未接受这一步，请重试");
  }
}

function snapshotState() {
  return {
    pieces: state.pieces.map((piece) => ({ ...piece })),
    turn: state.turn,
    moveLog: [...state.moveLog],
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    aiMoveHistory: state.aiMoveHistory.map((move) => ({ ...move })),
    aiRepeatBroken: state.aiRepeatBroken,
    winner: state.winner,
  };
}

function describeMove(piece, move) {
  const sideName =
    state.gameMode === "ai"
      ? piece.player === HUMAN_PLAYER
        ? "你·赤霞方"
        : "电脑·青山方"
      : PLAYER_NAMES[piece.player];
  const actor = `${sideName}·${PIECE_TYPES[piece.type].name}`;
  if (move.combat === "counter") return `${actor}攻击小猪妖，被反杀`;
  if (move.target) return `${actor}吃掉${PIECE_TYPES[move.target.type].name}${move.jump ? "（飞山）" : ""}`;
  if (terrainAt(move.row, move.col).type === "cave") return `${actor}攻入对方山洞`;
  if (terrainAt(move.row, move.col).type === "trap") return `${actor}进入对方陷阱`;
  if (terrainAt(move.row, move.col).type === "mountain") return `${actor}进入浪浪山`;
  return `${actor}${move.jump ? "飞越浪浪山" : "移动一格"}`;
}

async function applyMove(piece, move) {
  if (state.animating) return;
  if (state.gameMode !== "online") state.snapshots.push(snapshotState());
  const logEntry = describeMove(piece, move);
  const fromRow = piece.row;
  const fromCol = piece.col;
  const movingPieceId = piece.id;
  const movingPieceType = piece.type;
  const movingPlayer = piece.player;
  const animationToken = ++state.animationToken;
  state.animating = true;
  render();
  await playMoveAnimation(piece, move);
  if (animationToken !== state.animationToken) return;

  const attackerIndex = state.pieces.findIndex((item) => item.id === piece.id);
  const defenderIndex = move.target ? state.pieces.findIndex((item) => item.id === move.target.id) : -1;
  let attackerSurvives = true;

  if (move.combat === "counter") {
    state.pieces.splice(attackerIndex, 1);
    attackerSurvives = false;
  } else {
    if (defenderIndex >= 0) {
      state.pieces = state.pieces.filter((item) => item.id !== move.target.id);
    }
    const survivingAttacker = state.pieces.find((item) => item.id === piece.id);
    survivingAttacker.row = move.row;
    survivingAttacker.col = move.col;
  }

  state.moveLog.push(logEntry);
  state.lastMove = {
    player: movingPlayer,
    pieceType: movingPieceType,
    fromRow,
    fromCol,
    toRow: move.row,
    toCol: move.col,
    jump: move.jump,
    capture: Boolean(move.target),
    label: logEntry,
  };
  if (state.gameMode === "ai" && movingPlayer === AI_PLAYER) {
    state.aiMoveHistory.push({
      pieceId: movingPieceId,
      fromRow,
      fromCol,
      toRow: move.row,
      toCol: move.col,
    });
    state.aiMoveHistory = state.aiMoveHistory.slice(-12);
  }
  state.selectedId = null;
  state.animating = false;

  const destinationTerrain = terrainAt(move.row, move.col);
  const networkAction = {
    pieceId: movingPieceId,
    fromRow,
    fromCol,
    row: move.row,
    col: move.col,
    jump: move.jump,
    capture: Boolean(move.target),
    destination: destinationTerrain.type,
  };
  if (attackerSurvives && destinationTerrain.type === "cave" && destinationTerrain.owner !== piece.player) {
    state.winner = piece.player;
    render();
    broadcastNetworkState(networkAction);
    playSound("capture");
    playCellEffect(move.row, move.col, "capture");
    window.setTimeout(() => {
      if (state.winner === movingPlayer) showVictory(movingPlayer);
    }, 220);
    return;
  }

  state.turn = state.turn === 1 ? 2 : 1;
  render();
  broadcastNetworkState(networkAction);
  if (move.target) {
    playSound("capture");
    playCellEffect(move.row, move.col, "capture");
  } else if (destinationTerrain.type === "mountain") {
    playCellEffect(move.row, move.col, "mountain");
  } else if (move.jump) {
    playCellEffect(move.row, move.col, "landing");
  }
  if (state.aiRepeatBroken && movingPlayer === AI_PLAYER) {
    showToast("电脑识别到重复走法，已改走新的位置");
  }
  scheduleAI();
}

function handleCellClick(event) {
  if (state.animating) return;
  if (state.winner) {
    showToast("本局已结束，可查看棋局或重新开始");
    return;
  }

  if (state.aiThinking || (state.gameMode === "ai" && state.turn === AI_PLAYER)) {
    showToast("电脑正在思考，请稍候");
    return;
  }

  if (state.gameMode === "online") {
    if (!isOnlineConnected()) {
      showToast("请先创建或加入一个联网房间");
      return;
    }
    if (network.pendingMove) {
      showToast("正在等待房主确认这一步");
      return;
    }
    if (state.turn !== network.player) {
      showToast("正在等待对方行棋");
      return;
    }
  }

  const row = Number(event.currentTarget.dataset.row);
  const col = Number(event.currentTarget.dataset.col);
  const clickedPiece = pieceAt(row, col);
  const selectedPiece = state.pieces.find((piece) => piece.id === state.selectedId) || null;

  if (!selectedPiece) {
    if (!clickedPiece) return;
    if (clickedPiece.player !== state.turn) {
      showToast(`现在轮到${PLAYER_NAMES[state.turn]}行棋`);
      return;
    }
    state.selectedId = clickedPiece.id;
    playSound("select");
    const legalMoves = getLegalMoves(clickedPiece);
    if (legalMoves.length === 0) showToast("这枚棋子暂时没有可用落点");
    render();
    return;
  }

  if (clickedPiece?.id === selectedPiece.id) {
    state.selectedId = null;
    render();
    return;
  }

  if (clickedPiece?.player === state.turn) {
    state.selectedId = clickedPiece.id;
    playSound("select");
    render();
    return;
  }

  const move = getLegalMoves(selectedPiece).find((candidate) => candidate.row === row && candidate.col === col);
  if (!move) {
    showToast("不能走到这里：棋子只能上下左右移动");
    return;
  }
  if (state.gameMode === "online" && network.role === "guest") {
    requestOnlineMove(selectedPiece, move);
    return;
  }
  applyMove(selectedPiece, move);
}

function undoMove() {
  if (state.gameMode === "online") {
    showToast("联网对局暂不支持悔棋");
    return;
  }
  const wasThinking = state.aiThinking;
  cancelAI();
  state.animationToken += 1;
  state.animating = false;
  let previous = null;
  const lastSnapshot = state.snapshots[state.snapshots.length - 1];
  const shouldUndoRound =
    state.gameMode === "ai" &&
    !wasThinking &&
    lastSnapshot?.turn === AI_PLAYER &&
    state.snapshots.length >= 2;

  if (shouldUndoRound) {
    state.snapshots.pop();
    previous = state.snapshots.pop();
  } else {
    previous = state.snapshots.pop();
  }
  if (!previous) return;
  state.pieces = previous.pieces;
  state.turn = previous.turn;
  state.moveLog = previous.moveLog;
  state.lastMove = previous.lastMove;
  state.aiMoveHistory = previous.aiMoveHistory;
  state.aiRepeatBroken = previous.aiRepeatBroken;
  state.winner = previous.winner;
  state.selectedId = null;
  victoryModal.hidden = true;
  clearVictoryEffects();
  render();
  playSound("undo");
  showToast(state.gameMode === "ai" ? "已撤销上一回合" : "已撤销上一步");
}

function resetGame(options = {}) {
  if (state.gameMode === "online" && network.role === "guest" && isOnlineConnected() && !options.force) {
    showToast("联网对局由房主重新开局");
    return;
  }
  cancelAI();
  state.animationToken += 1;
  state.pieces = createInitialPieces();
  state.turn = 1;
  state.selectedId = null;
  state.moveLog = [];
  state.snapshots = [];
  state.aiThinking = false;
  state.aiCompletedDepth = 0;
  state.aiMoveHistory = [];
  state.aiRepeatBroken = false;
  state.lastMove = null;
  state.animating = false;
  state.winner = null;
  victoryModal.hidden = true;
  clearVictoryEffects();
  render();
  if (state.gameMode === "online" && network.role === "host" && isOnlineConnected() && options.networkBroadcast !== false) {
    broadcastNetworkState(null, "reset");
  }
  if (!options.silent) {
    const message =
      state.gameMode === "ai"
        ? "人机对战已开始，你执赤霞方先行"
        : state.gameMode === "online"
          ? "联网对局已重新开始"
          : "新对局已开始，赤霞方先行";
    showToast(message);
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2200);
}

function openRules() {
  rulesModal.hidden = false;
}

function closeRules() {
  rulesModal.hidden = true;
}

function showVictory(player) {
  let winnerName =
    state.gameMode === "ai"
      ? player === HUMAN_PLAYER
        ? "你·赤霞方"
        : "电脑·青山方"
      : PLAYER_NAMES[player];
  let victoryCopy =
    state.gameMode === "ai"
      ? player === HUMAN_PLAYER
        ? "你成功攻入电脑山洞，赤霞方拿下本局！"
        : "电脑攻入你的山洞，青山方赢得本局。"
      : "成功攻入对方山洞，拿下本局。";
  if (state.gameMode === "online" && network.player) {
    winnerName = player === network.player ? `你·${PLAYER_NAMES[player]}` : `对方·${PLAYER_NAMES[player]}`;
    victoryCopy = player === network.player ? "你成功攻入对方山洞，赢得本局！" : "对方攻入了你的山洞，本局结束。";
  }
  document.querySelector("#victoryTitle").textContent = `${winnerName}获胜`;
  document.querySelector("#victoryCopy").textContent = victoryCopy;
  victoryModal.hidden = false;
  victoryModal.classList.remove("victory-entering");
  void victoryModal.offsetWidth;
  victoryModal.classList.add("victory-entering");
  playVictoryCelebration(player);
}

function bindControls() {
  let lastBoardTap = { time: 0, x: 0, y: 0 };
  board.addEventListener("dblclick", (event) => event.preventDefault());
  board.addEventListener(
    "touchend",
    (event) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      const now = Date.now();
      const isQuickRepeat = now - lastBoardTap.time < 320;
      const isSameSpot = Math.hypot(touch.clientX - lastBoardTap.x, touch.clientY - lastBoardTap.y) < 24;
      if (isQuickRepeat && isSameSpot) event.preventDefault();
      lastBoardTap = { time: now, x: touch.clientX, y: touch.clientY };
    },
    { passive: false },
  );
  document.querySelector("#undoButton").addEventListener("click", undoMove);
  document.querySelector("#mobileUndoButton").addEventListener("click", undoMove);
  resetButton.addEventListener("click", () => resetGame());
  mobileResetButton.addEventListener("click", () => resetGame());
  document.querySelector("#rulesButton").addEventListener("click", openRules);
  document.querySelector("#mobileRulesButton").addEventListener("click", openRules);
  document.querySelectorAll(".close-modal").forEach((button) => button.addEventListener("click", closeRules));
  rulesModal.addEventListener("click", (event) => {
    if (event.target === rulesModal) closeRules();
  });
  document.querySelector("#closeVictoryButton").addEventListener("click", () => {
    victoryModal.hidden = true;
    clearVictoryEffects();
  });
  playAgainButton.addEventListener("click", () => resetGame());
  victoryModal.addEventListener("click", (event) => {
    if (event.target === victoryModal) {
      victoryModal.hidden = true;
      clearVictoryEffects();
    }
  });
  soundToggle.addEventListener("click", () => {
    volumePanel.hidden = !volumePanel.hidden;
    soundToggle.setAttribute("aria-expanded", String(!volumePanel.hidden));
  });
  volumeSlider.addEventListener("input", () => {
    setSoundVolume(Number(volumeSlider.value) / 100);
  });
  volumeSlider.addEventListener("change", () => {
    setSoundVolume(Number(volumeSlider.value) / 100, { preview: true });
    showToast(`音量已调到${volumeSlider.value}%`);
  });
  volumeMuteButton.addEventListener("click", () => {
    setSoundVolume(state.soundEnabled ? 0 : lastAudibleVolume, { preview: !state.soundEnabled });
    showToast(state.soundEnabled ? "音效已恢复" : "音效已静音");
  });
  document.addEventListener("click", (event) => {
    if (volumePanel.hidden || soundControl.contains(event.target)) return;
    volumePanel.hidden = true;
    soundToggle.setAttribute("aria-expanded", "false");
  });
  shareButton.addEventListener("click", shareGame);
  mobileShareButton.addEventListener("click", shareGame);
  createRoomButton.addEventListener("click", createOnlineRoom);
  joinRoomButton.addEventListener("click", () => joinOnlineRoom());
  leaveRoomButton.addEventListener("click", () => leaveOnlineRoom());
  copyInviteButton.addEventListener("click", async () => {
    const copied = await copyText(getInviteLink());
    showToast(copied ? "邀请链接已复制" : "复制失败，请手动发送房间号");
  });
  roomCodeInput.addEventListener("input", () => {
    roomCodeInput.value = sanitizeRoomCode(roomCodeInput.value);
  });
  roomCodeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") joinOnlineRoom();
  });
  document.querySelectorAll("[data-game-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.moveLog.length > 0 || state.animating) return;
      cancelAI();
      const nextMode = button.dataset.gameMode;
      if (state.gameMode === "online" && nextMode !== "online") leaveOnlineRoom({ silent: true });
      state.gameMode = nextMode;
      state.selectedId = null;
      render();
      const modeMessage = {
        ai: "已切换为人机对战",
        local: "已切换为本地双人",
        online: "已切换为联网房间",
      };
      showToast(modeMessage[state.gameMode]);
    });
  });
  document.querySelectorAll("[data-ai-difficulty]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.moveLog.length > 0 || state.gameMode !== "ai" || state.animating) return;
      state.aiDifficulty = button.dataset.aiDifficulty;
      render();
      showToast(`AI难度已调为${AI_DIFFICULTY[state.aiDifficulty].label}`);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      rulesModal.hidden = true;
      victoryModal.hidden = true;
      volumePanel.hidden = true;
      soundToggle.setAttribute("aria-expanded", "false");
    }
  });
  window.addEventListener("beforeunload", () => {
    if (network.connection?.open) sendNetworkMessage({ type: "leave" });
    destroyNetworkTransport();
  });
}

function init() {
  createBoard();
  createRankLegend();
  bindControls();
  resetGame();
  const invitedRoom = sanitizeRoomCode(new URLSearchParams(window.location.search).get("room"));
  if (invitedRoom.length === 6) {
    state.gameMode = "online";
    roomCodeInput.value = invitedRoom;
    render();
    window.setTimeout(() => joinOnlineRoom(invitedRoom), 120);
  }
}

window.__monsterChess = {
  state,
  terrainAt,
  getLegalMoves,
  getAllActions,
  getCombat,
  chooseAIMove,
  network,
  createOnlineRoom,
  joinOnlineRoom,
  leaveOnlineRoom,
  resetGame,
};

init();
