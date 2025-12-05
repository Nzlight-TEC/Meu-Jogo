// game.js - Parkour mode (triple jump, reset on ground touch, enemies on platforms except first)
// Mantive dash, tiros leves/pesados, IA avançada, T-rex pixel, áudio 8-bit, invul, plataformas extras

const WIDTH = 1024;
const HEIGHT = 600;

let player;
let cursors;
let keys;
let bullets;
let heavyBullets;
let enemies;
let platforms;
let particles;
let score = 0;
let lives = 3;
let hudScore, hudLives;
let spawnTimer = 0;
let gameOver = false;
let reticulo;
let lastFired = 0;
let lastHeavyFired = 0;
let lastDash = 0;
let finalizado = false;

const DASH_COOLDOWN = 800;
const DASH_SPEED = 700;
const DASH_DURATION = 160;
const HEAVY_COOLDOWN = 1200;
const FIRE_COOLDOWN = 150;

let groundPlatform = null; // referência para a primeira plataforma (chão / reset)

const audioCtx = (function() {
  try { return new (window.AudioContext || window.webkitAudioContext)(); }
  catch (e) { return null; }
})();

function playTone(freq = 440, time = 0.06, type = 'square', gain = 0.12) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + time);
}

function playNoise(time = 0.08, vol = 0.12) {
  if (!audioCtx) return;
  const bufferSize = Math.floor(audioCtx.sampleRate * time);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const g = audioCtx.createGain();
  g.gain.value = vol;
  src.connect(g);
  g.connect(audioCtx.destination);
  src.start();
}

const config = {
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  pixelArt: true,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 900 },
      debug: false,
    },
  },
  scene: { preload, create, update },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
},

};

function preload() {
  // fundo sólido (sem risco de faixa)
  this.textures.generate("bg", {
    data: ["00000000"],
    pixelWidth: 32,
    pixelHeight: 32,
  });

  // T-Rex player (pixel)
  this.textures.generate("player", {
    data: [
      "    11111111    ",
      "   1111111111   ",
      "  111111111111  ",
      " 11111111111111 ",
      "1111111111111111",
      "1111111111111111",
      "1111111111111111",
      " 11111111111111 ",
      "  111111111111  ",
      "   1111111111   ",
      "    11111111    ",
      "     111111     "
    ],
    pixelWidth: 2,
    pixelHeight: 2,
  });

  // inimigo
  this.textures.generate("enemy", {
    data: [
      " 22222 ",
      "2222222",
      "2222222",
      "2222222",
      " 22222 "
    ],
    pixelWidth: 2,
    pixelHeight: 2,
  });

  // tiro leve
  this.textures.generate("bullet", {
    data: ["3"],
    pixelWidth: 3,
    pixelHeight: 3,
  });

  // tiro pesado
  this.textures.generate("heavy", {
    data: [
      "  444  ",
      " 44444 ",
      "4444444",
      " 44444 ",
      "  444  "
    ],
    pixelWidth: 2,
    pixelHeight: 2,
  });

  // plataforma estilo 8-bit
  this.textures.generate("tile", {
    data: ["66666666", "66666666"],
    pixelWidth: 4,
    pixelHeight: 4,
  });

  // moeda
this.textures.generate("coin", {
  data: [
    "  777  ",
    " 77777 ",
    "7777777",
    "7777777",
    " 77777 ",
    "  777  "
  ],
  pixelWidth: 2,
  pixelHeight: 2,
});

  // partículas e mira
  this.textures.generate("p", { data: ["5"], pixelWidth: 2, pixelHeight: 2 });
  this.textures.generate("ret", { data: ["9"], pixelWidth: 4, pixelHeight: 4 });

  // flash do tiro
  this.textures.generate("flash", {
    data: [" ff ", "ffff", " ff "],
    pixelWidth: 3,
    pixelHeight: 3,
  });
}

function create() {
  // desativa menu do clique direito (impede "Salvar imagem")
  this.input.mouse.disableContextMenu();

  // fundo cobrindo toda a tela
  this.add.image(WIDTH / 2, HEIGHT / 2, "bg")
    .setDisplaySize(WIDTH, HEIGHT)
    .setScrollFactor(0);

  // plataformas
  platforms = this.physics.add.staticGroup({ defaultKey: null });

  // criar e salvar a plataforma "inicial" (ground) que causa reset
  
  groundPlatform = createPlatform(this, 512, 584, 16);

  // plataformas adicionais (parkour)
  createPlatform(this, 300, 460, 3);
  createPlatform(this, 600, 380, 3);
  createPlatform(this, 900, 300, 3);
  createPlatform(this, 1200, 460, 3);
  createPlatform(this, 1500, 350, 3);
  

  // map expanse platforms
  createPlatform(this, 1800, 500, 4);
  createPlatform(this, 2100, 420, 5);
  createPlatform(this, 2400, 360, 4);
  createPlatform(this, 2600, 520, 7);
  createPlatform(this, 2900, 460, 4);
  createPlatform(this, 3200, 400, 4);
  createPlatform(this, 3500, 480, 6);
  createPlatform(this, 3800, 340, 3);
    let spawnPlatform = platforms.create(150, 500, 'tile')
    .setScale(2, 1)
    .refreshBody();


  // player (T-rex)
  player = this.physics.add.sprite(150, 450, "player");
  player.setCollideWorldBounds(true);
  player.setBounce(0.05);
  player.body.setSize(30, 36);
  player.setScale(1);
  player.speed = 220;
  player.jumpSpeed = -420;
  // triple jump
  player.maxJumps = 3;
  player.jumps = player.maxJumps;
  player.isDashing = false;
  player.health = 5;
  player.invul = false;

  // tiros
  bullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: 30 });
  heavyBullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: 8 });

  // inimigos
  enemies = this.physics.add.group();

  // partículas
  particles = this.add.particles("p");

  // HUD
  hudScore = this.add.text(16, 16, "SCORE: 0", {
    fontFamily: "monospace",
    fontSize: "26px",
    color: "#fff",
  }).setScrollFactor(0);

  hudLives = this.add.text(16, 50, "LIVES: 3", {
    fontFamily: "monospace",
    fontSize: "26px",
    color: "#ffbbbb",
  }).setScrollFactor(0);
  let placa = this.add.rectangle(WIDTH - 150, 80, 260, 90, 0x000000, 0.55)
  .setStrokeStyle(2, 0xffffff)
  .setScrollFactor(0)
  .setDepth(20);

let textoPlaca = this.add.text(WIDTH - 150, 80,
  "Shift = Dash\nEspaço = Pular (3x)\nLClick = Tiro\nRClick = Tiro Pesado",
  {
    fontFamily: "monospace",
    fontSize: "14px",
    color: "#ffffff",
    align: "center",
    lineSpacing: 4
  }
).setOrigin(0.5).setScrollFactor(0).setDepth(21);
  // mira
  reticulo = this.add.sprite(0, 0, "ret").setScale(2).setDepth(10);

  // câmera e limites
  this.cameras.main.setBounds(0, 0, 4000, 600);
  this.physics.world.setBounds(0, 0, 4000, 600);
  this.cameras.main.startFollow(player, true, 0.08, 0.08);
  this.cameras.main.setRoundPixels(true);

  // colisões / overlaps
  this.physics.add.collider(player, platforms, onPlayerLanding, null, this);
  this.physics.add.collider(enemies, platforms);
  this.physics.add.collider(bullets, platforms, (b) => b.destroy());
  this.physics.add.collider(heavyBullets, platforms, (b) => b.destroy());
  this.physics.add.overlap(bullets, enemies, bulletHitEnemy, null, this);
  this.physics.add.overlap(heavyBullets, enemies, heavyHitEnemy, null, this);
  // colisão jogador <-> inimigo (usa função segura)
  this.physics.add.overlap(player, enemies, enemyHitsPlayer, null, this);

  // controles
  cursors = this.input.keyboard.createCursorKeys();
  keys = this.input.keyboard.addKeys({
    W: Phaser.Input.Keyboard.KeyCodes.W,
    A: Phaser.Input.Keyboard.KeyCodes.A,
    D: Phaser.Input.Keyboard.KeyCodes.D,
    SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
    SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT
  });

  // mouse: clique esquerdo = tiro leve; clique direito = tiro pesado
  this.input.on("pointerdown", (pointer) => {
    if (pointer.rightButtonDown()) {
      if (this.time.now > lastHeavyFired + HEAVY_COOLDOWN) {
        heavyShoot.call(this);
        lastHeavyFired = this.time.now;
      }
    } else {
      if (this.time.now > lastFired + FIRE_COOLDOWN) {
        shoot.call(this);
        lastFired = this.time.now;
      }
    }
  });

  // spawns iniciais (inimigos aparecem em plataformas exceto a primeira)
  spawnEnemy.call(this);
  spawnEnemy.call(this);
  // Moeda de final
let finalCoin = this.physics.add.sprite(3900, 260, "coin")
  .setScale(1.3);
finalCoin.body.allowGravity = false;
this.physics.add.overlap(player, finalCoin, () => {
  finalCoin.destroy();

  this.add.text(player.x, player.y - 60, "VOCÊ CHEGOU AO FIM!!!", {
    fontFamily: "monospace",
    fontSize: "48px",
    color: "#ffff55",
    stroke: "#000",
    strokeThickness: 8
  }).setOrigin(0.5);

}, null, this);

groundPlatform.setVisible(false);

}

function update(time, delta) {
  if (gameOver) return;

  // mira
  reticulo.x = this.input.activePointer.worldX;
  reticulo.y = this.input.activePointer.worldY;

  // parkour death check: se encostou no chão inicial (groundPlatform), reset
  // usamos bloqueio por Y e bloqueio de colisão para ter certeza
  if (player.body && player.body.blocked && player.body.blocked.down) {
    // se o player está apoiado na plataforma do chão (groundPlatform), reset
    // cheque proximidade em Y para evitar falsos positivos
    if (groundPlatform && Math.abs(player.y - (groundPlatform.y - 16)) < 40) {
      resetPlayer(this);
      return; // volta pro começo; não processa mais esse frame
    }
  }

  // movimento básico
  const left = cursors.left.isDown || keys.A.isDown;
  const right = cursors.right.isDown || keys.D.isDown;
  const onGround = player.body.blocked.down;

  // dash
  if (Phaser.Input.Keyboard.JustDown(keys.SHIFT) &&
      (time > lastDash + DASH_COOLDOWN) &&
      !player.isDashing) {
    doDash.call(this, time);
  }

  if (!player.isDashing) {
    if (left) player.setVelocityX(-player.speed);
    else if (right) player.setVelocityX(player.speed);
    else player.setVelocityX(0);
  }

  // TRIPLE JUMP: 3 pulos por toque no chão
  if (Phaser.Input.Keyboard.JustDown(cursors.up) ||
      Phaser.Input.Keyboard.JustDown(keys.W) ||
      Phaser.Input.Keyboard.JustDown(keys.SPACE)) {
    if (player.jumps > 0) {
      player.setVelocityY(player.jumpSpeed);
      player.jumps--;
      playTone(700 + player.jumps * 120, 0.04, 'square', 0.08);
    }
  }

  // flip sprite
  if (player.body.velocity.x < 0) player.setFlipX(true);
  else if (player.body.velocity.x > 0) player.setFlipX(false);

  // IA inimigos — perseguem mesmo de longe
  enemies.getChildren().forEach(e => {
    if (!e.active) return;

    const dx = player.x - e.x;
    const absDx = Math.abs(dx);
    const onGroundE = e.body.blocked.down;

    // perseguir até longa distância (1200)
    if (absDx < 1200 && absDx > 60) {
      const dir = dx > 0 ? 1 : -1;
      e.setVelocityX(Phaser.Math.Linear(e.body.velocity.x, dir * (e.patrolSpeed + 120), 0.08));
      e.patrolDir = dir;
    } else if (absDx <= 60) {
      e.setVelocityX(0);
    } else {
      e.setVelocityX(e.patrolDir * e.patrolSpeed);
    }

    // evitar cair de bordas
    const aheadX = e.x + e.patrolDir * (e.body.width / 2 + 6);
    const groundCheckY = e.y + e.body.height / 2 + 8;

    const willFall = !platforms.getChildren().some(p => {
      return Math.abs(p.x - aheadX) < (p.displayWidth / 2) &&
             Math.abs(p.y - groundCheckY) < 32;
    });

    if (willFall && onGroundE) {
      e.patrolDir *= -1;
      e.setVelocityX(e.patrolDir * e.patrolSpeed);
    }

    // pular se bater numa parede
    if (onGroundE && (e.body.blocked.left || e.body.blocked.right)) {
      e.setVelocityY(-300);
    }

    // fugir se pouca vida
    if (e.health <= 1 && absDx < 300) {
      const fleeDir = dx > 0 ? -1 : 1;
      e.setVelocityX(fleeDir * (e.patrolSpeed + 120));
    }

    // segurar inimigos dentro do mundo
    if (e.x < 16) e.x = 16;
    if (e.x > 4000 - 16) e.x = 4000 - 16;
  });

  // respawn de inimigos em plataformas (exceto a primeira)
  spawnTimer += delta;
  if (spawnTimer > 3000 && enemies.countActive(true) < 6) {
    spawnEnemy.call(this);
    spawnTimer = 0;
  }
}

// ===================== funcoes auxiliares =====================

function createPlatform(scene, x, y, scaleX) {
  let pf = platforms.create(x, y, "tile");
  pf.setScale(scaleX, 1);
  pf.refreshBody();
  // superfícies planas com hitbox larga
  pf.body.setSize(pf.displayWidth, 20);
  return pf;
}

// reset do player para o começo do parkour
function resetPlayer(scene) {
  // volta para o spawn inicial
  player.x = 150;
  player.y = 450;
  player.setVelocity(0, 0);
  player.jumps = player.maxJumps;
  player.invul = true; // curtir 0.7s invulnerabilidade após respawn
  player.setTint(0x99ff99);
  playTone(180, 0.08, 'square', 0.12);

  // remover inimigos próximos
  scene.time.delayedCall(700, () => {
    player.invul = false;
    player.clearTint();
  });
}

// tiro leve
function shoot() {
  const pointer = this.input.activePointer;
  const angle = Phaser.Math.Angle.Between(player.x, player.y, pointer.worldX, pointer.worldY);

  const offsetX = Math.cos(angle) * (player.body.width / 2 + 8);
  const offsetY = Math.sin(angle) * (player.body.height / 2 - 6);

  const b = bullets.get(player.x + offsetX, player.y + offsetY, "bullet");
  if (!b) return;

  b.setActive(true);
  b.setVisible(true);
  this.physics.world.enable(b);
  b.body.allowGravity = false;
  b.body.setSize(6, 6);
  b.setVelocity(Math.cos(angle) * 720, Math.sin(angle) * 720);
  b.damage = 1;

  playTone(1200, 0.03, 'square', 0.06);
  playNoise(0.02, 0.02);
}

// tiro pesado
function heavyShoot() {
  const pointer = this.input.activePointer;
  const angle = Phaser.Math.Angle.Between(player.x, player.y, pointer.worldX, pointer.worldY);

  const offsetX = Math.cos(angle) * (player.body.width / 2 + 12);
  const offsetY = Math.sin(angle) * (player.body.height / 2 - 6);

  const b = heavyBullets.get(player.x + offsetX, player.y + offsetY, "heavy");
  if (!b) return;

  b.setActive(true);
  b.setVisible(true);
  this.physics.world.enable(b);
  b.body.allowGravity = false;
  b.body.setSize(18, 18);
  b.setVelocity(Math.cos(angle) * 520, Math.sin(angle) * 520);
  b.damage = 3;

  playTone(400, 0.12, 'sawtooth', 0.12);
  playNoise(0.04, 0.08);
}

// dash
function doDash(time) {
  lastDash = time;
  player.isDashing = true;
  const dir = player.flipX ? -1 : 1;

  player.setVelocityX(dir * DASH_SPEED);
  player.setAccelerationY(0);
  player.setTint(0xffffaa);
  playTone(1500, 0.06, 'square', 0.08);

  player.scene.time.delayedCall(DASH_DURATION, () => {
    player.isDashing = false;
    player.clearTint();
    player.setVelocityX(dir * (player.speed * 0.35));
  });
}

// spawn de inimigos: escolhe uma plataforma aleatória exceto a primeira (groundPlatform)
function spawnEnemy() {
  const list = platforms.getChildren().slice(); // cópia
  if (list.length <= 1) {
    // fallback: spawn sem plataforma definida
    const e = enemies.create(player.x + 500, 120, "enemy");
    eInit(e);
    return;
  }

  // remove a primeira plataforma (ground)
  const valid = list.slice(1);
  const p = Phaser.Math.RND.pick(valid);

  // spawn um pouco acima da plataforma escolhida
  const e = enemies.create(p.x, p.y - 40, "enemy");
  eInit(e);
}

// inicializa propriedades do inimigo
function eInit(e) {
  e.setBounce(0.1);
  e.setCollideWorldBounds(true);
  e.body.setSize(20, 20);
  e.setScale(1);
  e.health = 2 + Phaser.Math.Between(0, 2);
  e.patrolDir = Phaser.Math.Between(0, 1) ? 1 : -1;
  e.patrolSpeed = Phaser.Math.Between(50, 100);
  e.setVelocityX(e.patrolDir * e.patrolSpeed);
}

// acerta o corno (leve)
function bulletHitEnemy(b, e) {
  if (!b.active || !e.active) return;
  const dmg = b.damage || 1;
  b.destroy();
  e.health -= dmg;
  playTone(900, 0.04, 'square', 0.08);

  const kb = 120;
  const dir = (e.x < player.x) ? -1 : 1;
  e.setVelocityX(dir * kb);

  if (e.health <= 0) {
    playNoise(0.06, 0.12);
    score += 100;
    hudScore.setText("SCORE: " + score);
    e.destroy();
  }
}

// acerta o corno mais forte
function heavyHitEnemy(b, e) {
  if (!b.active || !e.active) return;
  const dmg = b.damage || 3;
  b.destroy();
  e.health -= dmg;
  playTone(700, 0.06, 'sawtooth', 0.12);
  playNoise(0.06, 0.10);

  const kb = 260;
  const dir = (e.x < player.x) ? -1 : 1;
  e.setVelocityX(dir * kb);

  if (e.health <= 0) {
    score += 150;
    hudScore.setText("SCORE: " + score);
    e.destroy();
  }
}

// colisão inimigo <-> player (segura) com invulnerabilidade
function enemyHitsPlayer(playerObj, enemyObj) {
  if (!playerObj || !enemyObj) return;

  // se player estiver dashando: aplica dano no inimigo (e não no player)
  if (playerObj.isDashing) {
    enemyObj.health = (enemyObj.health || 1) - 2;
    enemyObj.setVelocityY(-160);
    playTone(120, 0.05, 'square', 0.1);

    if (enemyObj.health <= 0) {
      enemyObj.destroy();
      score += 100;
      hudScore.setText("SCORE: " + score);
    }
    return;
  }

  // se invulnerável, ignora
  if (playerObj.invul) return;

  // ativa invulnerabilidade breve
  playerObj.invul = true;
  if (playerObj.setTint) playerObj.setTint(0xff6666);

  // perde 1 vida (parkour não usa vidas para reset, mas mantive vidas caso queira modo misto)
  lives -= 1;
  hudLives.setText("LIVES: " + lives);

  playNoise(0.08, 0.14);

  // knockback
  const kbDir = (playerObj.x < enemyObj.x) ? -1 : 1;
  playerObj.setVelocityX(-kbDir * 200);
  playerObj.setVelocityY(-180);

  // desliga invul após 1s
  playerObj.scene.time.delayedCall(1000, () => {
    playerObj.invul = false;
    if (playerObj.clearTint) playerObj.clearTint();
  });

  // checa game over
  if (lives <= 0) {
    gameOver = true;

    // CAVEIRA (emoji grande)
    playerObj.scene.add.text(playerObj.x, playerObj.y - 120, "💀", {
      fontFamily: "monospace",
      fontSize: "110px",
      color: "#ffffff"
    }).setOrigin(0.5);

    // GAME OVER texto
    playerObj.scene.add.text(playerObj.x, playerObj.y - 30, "GAME OVER", {
      fontFamily: "monospace",
      fontSize: "48px",
      color: "#ff4444",
      stroke: "#000000",
      strokeThickness: 8
    }).setOrigin(0.5);
    playerObj.setVelocity(0, 0);
    playerObj.body.moves = false;

}

}

function onPlayerLanding() {
  // reset triple jump ao tocar qualquer plataforma
  player.jumps = player.maxJumps;
}

new Phaser.Game(config);

function reachEnd(playerObj, coinObj) {

  // mensagem
  playerObj.scene.add.text(playerObj.x, playerObj.y - 50,
    "VOCÊ CHEGOU AO FIM!!!",
    {
      fontFamily: "monospace",
      fontSize: "48px",
      color: "#ffff66",
      stroke: "#000000",
      strokeThickness: 8
    }
  ).setOrigin(0.5);

  // some com a moeda
  coinObj.destroy();

  // respawn do player
  playerObj.x = 150;
  playerObj.y = 450;
  playerObj.setVelocity(0, 0);

  // spawnar 3 inimigos extras
  for (let i = 0; i < 3; i++) {
    spawnEnemy.call(playerObj.scene);
  }
}
