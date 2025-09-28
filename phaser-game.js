/* phaser-game.js
   Soul Conductor: Phaser 2D world with collectible notes and environment triggers.
   Uses WebAudio to create four looping instrument layers that are muted initially.
   Collecting notes unmutes instruments and triggers environment changes.
*/

const NOTE_COUNT = 4; // number of collectible notes

/* ---------------- Audio manager (WebAudio) ---------------- */
const AudioManager = (() => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const instruments = [];

  function createInstrument(type, freq, gainVal = 0.0) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.value = freq * 2.5;

    gain.gain.value = gainVal;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    return { osc, gain, filter };
  }

  function init() {
    instruments.push(createInstrument('sine', 110, 0.0)); // pad
    instruments.push(createInstrument('square', 220, 0.0)); // pulse
    instruments.push(createInstrument('sawtooth', 55, 0.0)); // bass
    instruments.push(createInstrument('triangle', 440, 0.0)); // melody
  }

  function setVolume(index, vol) {
    if (!instruments[index]) return;
    const g = instruments[index].gain;
    g.gain.cancelScheduledValues(0);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.2);
  }

  function resumeIfNeeded() {
    if (ctx.state === 'suspended') ctx.resume();
  }

  init();
  return { setVolume, resumeIfNeeded };
})();

/* ---------------- Phaser game ---------------- */
const phaserConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 0x05060b,
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 600 }, debug: false }
  },
  scene: { preload, create, update }
};

let game;
let player;
let cursors;
let notesGroup;
let collected = 0;
let portal;
let movingPlatform;
let gate;

function preload() {
  // If you have an image file, load it here
  this.load.image('note', 'assets/sprites/note.png');
}

function create() {
  // resume audio on first click
  this.input.once('pointerdown', () => AudioManager.resumeIfNeeded());

  // ground
  const ground = this.add.rectangle(window.innerWidth / 2, window.innerHeight - 40, window.innerWidth, 80, 0x101214);
  this.physics.add.existing(ground, true);

  // moving platform
  movingPlatform = this.add.rectangle(window.innerWidth / 2, window.innerHeight / 2 + 40, 220, 24, 0x2b2f3a);
  this.physics.add.existing(movingPlatform, true);
  movingPlatform.active = false;

  // gate
  gate = this.add.rectangle(window.innerWidth - 160, window.innerHeight - 120, 120, 160, 0x2f1a1a);
  this.physics.add.existing(gate, true);
  gate.locked = true;

  // player
  player = this.add.rectangle(140, window.innerHeight - 120, 48, 64, 0x00ccff);
  this.physics.add.existing(player);
  player.body.setBounce(0.1);
  player.body.setCollideWorldBounds(true);

  this.physics.add.collider(player, ground);
  this.physics.add.collider(player, movingPlatform);
  this.physics.add.collider(player, gate);

  // Input
  cursors = this.input.keyboard.createCursorKeys();

  // notes
  notesGroup = this.physics.add.group({ allowGravity: false, immovable: true });
  const positions = [
    { x: 260, y: window.innerHeight - 200 },
    { x: 520, y: window.innerHeight - 360 },
    { x: 820, y: window.innerHeight - 240 },
    { x: window.innerWidth - 340, y: window.innerHeight - 420 }
  ];
  positions.slice(0, NOTE_COUNT).forEach((p, i) => {
    const note = this.add.circle(p.x, p.y, 18, 0xffdd55);
    this.physics.add.existing(note);
    note.index = i;
    note.collected = false;
    notesGroup.add(note);
  });

  this.physics.add.overlap(player, notesGroup, collectNote, null, this);

  // portal
  portal = this.add.circle(window.innerWidth - 100, 300, 60, 0xffffaa);
  this.physics.add.existing(portal, true);
  portal.visible = false;
  this.physics.add.overlap(player, portal, enterPortal, null, this);

  function showPopup() {
  document.getElementById('popup').style.display = 'flex';
}

function closePopup() {
  document.getElementById('popup').style.display = 'none';
}

function enterPortal(playerObj, portalObj) {
  if (!portal.visible) return;
  // Show popup
  showPopup();

  function closePopup() {
  document.getElementById('popup').style.display = 'none';
}

  // Stop movement
  player.body.setVelocity(0);

  // Small celebration: flash volumes higher
  AudioManager.setVolume(0, 0.18);
  AudioManager.setVolume(1, 0.22);
  AudioManager.setVolume(2, 0.26);
  AudioManager.setVolume(3, 0.34);

  // Optional: change HUD message
  document.getElementById('message').innerText = 'Portal reached!';
}


  // UI
  document.getElementById('message').innerText =
    'Collect notes — each one adds an instrument and changes the world.';
  updateHUD();

  // moving platform animation
  this.time.addEvent({
    delay: 20,
    loop: true,
    callback: () => {
      if (movingPlatform.active) {
        const speed = 0.8;
        movingPlatform.x += Math.sin(this.time.now / 500) * speed;
        movingPlatform.body.updateFromGameObject();
      }
    }
  });
}

function update() {
  const speed = 280;
  if (cursors.left.isDown) player.body.setVelocityX(-speed);
  else if (cursors.right.isDown) player.body.setVelocityX(speed);
  else player.body.setVelocityX(0);

  if ((cursors.up.isDown || cursors.space.isDown) && player.body.blocked.down) {
    player.body.setVelocityY(-430);
  }
}

function collectNote(playerObj, noteObj) {
  if (noteObj.collected) return;
  noteObj.collected = true;
  noteObj.visible = false;
  collected++;

  // Unmute one instrument
  const volumes = [0.08, 0.09, 0.12, 0.16];
  AudioManager.setVolume(noteObj.index, volumes[noteObj.index] || 0.1);

  // Environment changes
  triggerEnvironment(noteObj.index);

  updateHUD();

  // If collected all, show portal
  if (collected >= NOTE_COUNT) {
    portal.visible = true;
    document.getElementById('message').innerText =
      'All notes collected! Enter the portal to finish.';
  }
}

function triggerEnvironment(index) {
  if (index === 0) {
    movingPlatform.active = true;
    movingPlatform.fillColor = 0x3a8bff;
  }
  if (index === 1) {
    setTimeout(() => {
      gate.locked = false;
      gate.fillColor = 0x224422;
      gate.visible = false;
      if (gate.body) gate.body.destroy();
    }, 800);
  }
  if (index === 2) {
    const old = document.getElementById('message').innerText;
    document.getElementById('message').innerText = 'Music swells — something shifted...';
    setTimeout(() => {
      document.getElementById('message').innerText = old;
    }, 1500);
  }
}

function enterPortal() {
  if (!portal.visible) return;
  document.getElementById('message').innerText = 'You restored the song! Level complete.';
  player.body.setVelocity(0);
  AudioManager.setVolume(0, 0.18);
  AudioManager.setVolume(1, 0.22);
  AudioManager.setVolume(2, 0.26);
  AudioManager.setVolume(3, 0.34);
}

function updateHUD() {
  document.getElementById('score').innerText = `Notes: ${collected} / ${NOTE_COUNT}`;
}

// start game
window.addEventListener('load', () => {
  game = new Phaser.Game(phaserConfig);
});

window.addEventListener('resize', () => {
  if (game && game.scale) game.scale.resize(window.innerWidth, window.innerHeight);
});
