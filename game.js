const WIDTH = 1024;
const HEIGHT = 600;
 
let player;
let cursors;
let keys;
let bullets;
let enemies;
let platforms;
let particles;
let score = 0;
let lives = 3;
let hudScore, hudLives;
let spawnTimer = 0;
let invulnerableUntil = 0;
let gameOver = false;
let reticulo;
let lastFired = 0;
 
const config = {
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 900 },
      debug: false
    }
  },
  scene: { preload, create, update }
};
 
function preload() {
  // player simples
  this.textures.generate('player', {
    data: [
      '  1111  ',
      ' 111111 ',
      '11111111',
      '11111111',
      '11111111',
      ' 111111 ',
      '  1111  '
    ],
    pixelWidth: 2,
    pixelHeight: 2
  });
 
  // inimigo
  this.textures.generate('enemy', {
    data: [
      ' 22222 ',
      '2222222',
      '2222222',
      '2222222',
      ' 22222 '
    ],
    pixelWidth: 2,
    pixelHeight: 2
  });
 
  // projétil
  this.textures.generate('bullet', {
    data: ['3'],
    pixelWidth: 3,
    pixelHeight: 3
  });
 
  // chão / plataformas
  this.textures.generate('tile', {
    data: ['44444444', '44444444'],
    pixelWidth: 4,
    pixelHeight: 4
  });
 
  // partículas
  this.textures.generate('p', {
    data: ['5'],
    pixelWidth: 2,
    pixelHeight: 2
  });
 
  // muzzle flash
  this.textures.generate('flash', {
    data: ['  ff  ', ' ffff ', 'ffffff', ' ffff ', '  ff  '],
    pixelWidth: 2,
    pixelHeight: 2
  });
 
  // retículo
  this.textures.generate('ret', {
    data: ['9'],
    pixelWidth: 4,
    pixelHeight: 4
  });
}
 
function create() {
  // plataformas
  platforms = this.physics.add.staticGroup();
 
  platforms.create(512, 584, 'tile').setScale(16, 1).refreshBody();
  platforms.create(300, 460, 'tile').setScale(3, 1).refreshBody();
  platforms.create(600, 380, 'tile').setScale(3, 1).refreshBody();
  platforms.create(900, 300, 'tile').setScale(3, 1).refreshBody();
  platforms.create(1200, 460, 'tile').setScale(3, 1).refreshBody();
  platforms.create(1500, 350, 'tile').setScale(3, 1).refreshBody();
 
  // player
  player = this.physics.add.sprite(150, 450, 'player');
  player.setCollideWorldBounds(true);
  player.setBounce(0.1);
  player.body.setSize(20, 28);
  player.speed = 220;
  player.jumpSpeed = -420;
  player.canDoubleJump = true;
 
  // projéteis
  bullets = this.physics.add.group({
    classType: Phaser.Physics.Arcade.Image,
    maxSize: 30
  });
 
  // inimigos
  enemies = this.physics.add.group();
 
  // partículas
  particles = this.add.particles('p');
 
  // HUD
  hudScore = this.add.text(16, 16, "Score: 0", { font: "20px monospace", fill: "#fff" }).setScrollFactor(0);
  hudLives = this.add.text(16, 40, "Lives: 3", { font: "20px monospace", fill: "#ffaaaa" }).setScrollFactor(0);
 
  // mira
  reticulo = this.add.sprite(0, 0, 'ret').setScale(2).setDepth(10);
 
  // câmera
  this.cameras.main.setBounds(0, 0, 4000, 600);
  this.cameras.main.startFollow(player, true, 0.08, 0.08);
  this.physics.world.setBounds(0, 0, 4000, 600);
 
  // colisões
  this.physics.add.collider(player, platforms, onPlayerLanding, null, this);
  this.physics.add.collider(enemies, platforms);
  this.physics.add.collider(bullets, platforms, (b) => b.destroy());
 
  this.physics.add.overlap(bullets, enemies, bulletHitEnemy, null, this);
  this.physics.add.overlap(player, enemies, enemyHitPlayer, null, this);
 
  // controles
  cursors = this.input.keyboard.createCursorKeys();
  keys = this.input.keyboard.addKeys({
    W: Phaser.Input.Keyboard.KeyCodes.W,
    A: Phaser.Input.Keyboard.KeyCodes.A,
    D: Phaser.Input.Keyboard.KeyCodes.D,
    SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE
  });
 
  // tiro
  this.input.on("pointerdown", () => shoot.call(this));
 
  // spawn inicial
  spawnEnemy.call(this, 700);
  spawnEnemy.call(this, 1000);
}
 
function update(time, delta) {
  if (gameOver) return;
 
  // mira segue o mouse
  reticulo.x = this.input.activePointer.worldX;
  reticulo.y = this.input.activePointer.worldY;
 
  // movimento
  let left = cursors.left.isDown || keys.A.isDown;
  let right = cursors.right.isDown || keys.D.isDown;
  let onGround = player.body.blocked.down;
 
  if (left) player.setVelocityX(-player.speed);
  else if (right) player.setVelocityX(player.speed);
  else player.setVelocityX(0);
 
  // pulo
  if (Phaser.Input.Keyboard.JustDown(cursors.up) ||
      Phaser.Input.Keyboard.JustDown(keys.W) ||
      Phaser.Input.Keyboard.JustDown(keys.SPACE)) {
 
    if (onGround) {
      player.setVelocityY(player.jumpSpeed);
      player.canDoubleJump = true;
    } else if (player.canDoubleJump) {
      player.setVelocityY(player.jumpSpeed * 0.9);
      player.canDoubleJump = false;
    }
  }
 
  // virar o player
  if (player.body.velocity.x < 0) player.setFlipX(true);
  else if (player.body.velocity.x > 0) player.setFlipX(false);
 
  // segurar clique para atirar
  if (this.input.activePointer.isDown && time > lastFired + 150) {
    shoot.call(this);
    lastFired = time;
  }
 
  // atualizar IA simples
  enemies.getChildren().forEach(e => {
    if (!e.active) return;
 
    const dist = Math.abs(player.x - e.x);
 
    if (dist < 220) {
      const dir = (player.x < e.x) ? -1 : 1;
      e.setVelocityX(dir * (e.patrolSpeed + 40));
      e.setFlipX(dir < 0);
    }
  });
 
  // spawn de inimigos
  spawnTimer += delta;
  if (spawnTimer > 3500 && enemies.countActive(true) < 8) {
    spawnTimer = 0;
    spawnEnemy.call(this, player.x + Phaser.Math.Between(500, 900));
  }
}
 
function shoot() {
  const pointer = this.input.activePointer;
 
  const b = bullets.get(player.x, player.y - 6, 'bullet');
  if (!b) return;
 
  b.setActive(true);
  b.setVisible(true);
  b.body.allowGravity = false;
 
  const angle = Phaser.Math.Angle.Between(player.x, player.y, pointer.worldX, pointer.worldY);
  const speed = 600;
 
  this.physics.velocityFromRotation(angle, speed, b.body.velocity);
 
  const flash = this.add.sprite(player.x, player.y - 10, 'flash').setDepth(20);
  flash.setRotation(angle);
  this.time.delayedCall(80, () => flash.destroy());
 
  this.time.delayedCall(2000, () => {
    if (b.active) b.destroy();
  });
}
 
function spawnEnemy(x) {
  const e = enemies.create(x, 520, 'enemy');
  e.setBounce(0.1);
  e.patrolDir = Phaser.Math.Between(0, 1) ? 1 : -1;
  e.patrolSpeed = Phaser.Math.Between(60, 100);
  e.health = 3;
 
  e.setVelocityX(e.patrolSpeed * e.patrolDir);
 
  return e;
}
 
function bulletHitEnemy(b, enemy) {
  b.destroy();
  enemy.health -= 1;
 
  if (enemy.health <= 0) {
    score += 100;
    hudScore.setText("Score: " + score);
    enemy.destroy();
  }
}
 
function enemyHitPlayer() {
  lives -= 1;
  hudLives.setText("Lives: " + lives);
 
  if (lives <= 0) {
    gameOver = true;
    this.add.text(player.x, player.y - 50, "GAME OVER", {
      font: "48px monospace",
      fill: "#ff4444"
    }).setOrigin(0.5);
  }
}
 
function onPlayerLanding() {
  player.canDoubleJump = true;
}
 
new Phaser.Game(config);
 