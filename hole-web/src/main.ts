import Phaser from 'phaser'
import './style.css'

class Sfx {
  private ctx?: AudioContext
  private enabled = true

  setEnabled(v: boolean) { this.enabled = v }
  ensure() {
    if (!this.enabled) return
    if (!this.ctx) this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }
  private blip(freq: number, durationMs: number, gain: number) {
    if (!this.enabled || !this.ctx) return
    const t0 = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t0)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000)
    osc.connect(g)
    g.connect(this.ctx.destination)
    osc.start(t0)
    osc.stop(t0 + durationMs / 1000)
  }
  eatSmall() { this.blip(240 + Math.random() * 40, 35, 0.035) }
  eatBig() { this.blip(140 + Math.random() * 30, 70, 0.05) }
  levelUp() { this.blip(320, 60, 0.05); setTimeout(() => this.blip(420, 60, 0.045), 55) }
  bump() { this.blip(90, 80, 0.04) }
  skillPickup() { this.blip(600, 100, 0.06); setTimeout(() => this.blip(800, 100, 0.06), 80) }
}

type Food = { kind: 'food'; r: number; key: string }
type Item = { kind: 'item'; type: 'boost' | 'magnet' }
type BotState = 'idle' | 'chase' | 'flee' | 'wander'
type Bot = { sprite: Phaser.Physics.Arcade.Image; r: number; target?: Phaser.Math.Vector2; state: BotState; stateTimer: number; speedMult: number }

// DOM refs
const overlay = document.getElementById('overlay')!
const overlayTitle = document.getElementById('overlay-title')!
const overlayText = document.getElementById('overlay-text')!
const startBtn = document.getElementById('start') as HTMLButtonElement
const restartBtn = document.getElementById('restart') as HTMLButtonElement
const muteBtn = document.getElementById('mute') as HTMLButtonElement
const hudSize = document.getElementById('size')!
const hudEaten = document.getElementById('eaten')!
const hudZone = document.getElementById('zone')!
const hudSkill = document.getElementById('skill')!

class GameScene extends Phaser.Scene {
  private worldW = 2400
  private worldH = 2400
  private hole!: Phaser.Physics.Arcade.Image
  private holeR = 24
  private holeTarget?: Phaser.Math.Vector2
  private holeImage!: Phaser.GameObjects.Image  // visual-only for clean scale tween
  private foods!: Phaser.GameObjects.Group
  private items!: Phaser.GameObjects.Group
  private bots: Bot[] = []
  private eaten = 0
  private sfx = new Sfx()
  private gameOver = false
  private activeSkill: 'none' | 'boost' | 'magnet' = 'none'
  private skillTimer = 0

  constructor() { super('game') }

  preload() {
    // Invisible texture for physics body - will be created in create()
    this.load.image('hole', 'assets/ai/openai/hole/001-top-down-2d-game-sprite-stylized-black-h.png')
    this.load.image('tree', 'assets/ai/openai/tree/001-top-down-2d-game-sprite-small-stylized-t.png')
    this.load.image('car', 'assets/ai/openai/car/001-top-down-2d-game-sprite-compact-blue-cit.png')
    this.load.image('building', 'assets/ai/openai/building/001-top-down-2d-game-sprite-small-city-build.png')
    this.load.image('lamp', 'assets/ai/openai/lamp/001-top-down-2d-game-sprite-street-lamp-cent.png')
    this.load.image('bench', 'assets/ai/openai/bench/001-top-down-2d-game-sprite-park-bench-cente.png')
    this.load.image('trash', 'assets/ai/openai/trash/001-top-down-2d-game-sprite-trash-can-center.png')
    this.load.image('tower', 'assets/ai/openai/tower/001-top-down-2d-game-sprite-rooftop-office-b.png')
    this.load.image('bus', 'assets/ai/openai/bus/001-top-down-2d-game-sprite-bus-centered-tra.png')
    this.load.image('house', 'assets/ai/openai/house/001-top-down-2d-game-sprite-small-house-roof.png')

    this.load.svg('ph-hole', 'assets/ai/placeholder-hole.svg', { width: 256, height: 256 })
    this.load.svg('ph-tree', 'assets/ai/placeholder-tree.svg', { width: 256, height: 256 })
    this.load.svg('ph-car', 'assets/ai/placeholder-car.svg', { width: 256, height: 256 })
    this.load.svg('ph-building', 'assets/ai/placeholder-building.svg', { width: 256, height: 256 })
    this.load.svg('ph-lamp', 'assets/ai/placeholder-lamp.svg', { width: 256, height: 256 })
    this.load.svg('ph-bench', 'assets/ai/placeholder-bench.svg', { width: 256, height: 256 })
    this.load.svg('ph-trash', 'assets/ai/placeholder-trash.svg', { width: 256, height: 256 })
    this.load.svg('ph-tower', 'assets/ai/placeholder-tower.svg', { width: 256, height: 256 })
    this.load.svg('ph-bus', 'assets/ai/placeholder-bus.svg', { width: 256, height: 256 })
    this.load.svg('ph-house', 'assets/ai/placeholder-house.svg', { width: 256, height: 256 })

    this.load.svg('icon-boost', 'assets/ai/placeholder-boost.svg', { width: 64, height: 64 })
    this.load.svg('icon-magnet', 'assets/ai/placeholder-magnet.svg', { width: 64, height: 64 })
  }

  create() {
    this.gameOver = false
    this.holeR = 24
    this.eaten = 0
    this.bots = []
    this.activeSkill = 'none'
    this.skillTimer = 0

    this.physics.world.setBounds(0, 0, this.worldW, this.worldH)

    // Generate invisible texture for physics body
    if (!this.textures.exists('__blank')) {
      const g = this.make.graphics()
      g.fillStyle(0x000000, 0)
      g.fillRect(0, 0, 2, 2)
      g.generateTexture('__blank', 2, 2)
    }

    // Procedural City Map Background
    const g = this.add.graphics()
    const roadColor = 0x3f3f46; // dark gray asphalt
    const grassColor = 0x4ade80; // vibrant green park
    const pavementColor = 0xcbd5e1; // light gray concrete block
    const curbColor = 0x94a3b8; // sidewalk curbs
    
    // Fill background with road asphalt
    g.fillStyle(roadColor, 1)
    g.fillRect(0, 0, this.worldW, this.worldH)
    
    const blockSize = 320;
    const roadWidth = 120;
    const cell = blockSize + roadWidth; // 440
    
    // Draw city blocks
    for (let x = 0; x <= this.worldW + cell; x += cell) {
      for (let y = 0; y <= this.worldH + cell; y += cell) {
        // Block type (1 in 4 chance for a park via coordinates)
        const isPark = ((x + y * 3) / cell) % 4 === 0;
        
        // 2.5D Sidewalk Drop Shadow
        g.fillStyle(0x1f2937, 0.4)
        g.fillRoundedRect(x + (roadWidth / 2) + 12, y + (roadWidth / 2) + 16, blockSize, blockSize, 24)

        // Sidewalk border (curb)
        g.fillStyle(curbColor, 1)
        g.fillRoundedRect(x + (roadWidth / 2), y + (roadWidth / 2), blockSize, blockSize, 24)
        
        // Inner block (grass or building ground)
        g.fillStyle(isPark ? grassColor : pavementColor, 1)
        g.fillRoundedRect(x + (roadWidth / 2) + 12, y + (roadWidth / 2) + 12, blockSize - 24, blockSize - 24, 16)
      }
      
      // Vertical yellow dashed lines
      g.lineStyle(6, 0xfacc15, 1)
      for (let dashedY = 0; dashedY <= this.worldH; dashedY += 50) {
         if (dashedY % cell > (roadWidth / 2 + 10) && dashedY % cell < cell - (roadWidth / 2 + 10)) {
           if (Math.floor(dashedY / 50) % 2 === 0) g.lineBetween(x, dashedY, x, dashedY + 25)
         }
      }
    }
    
    // Horizontal yellow dashed lines
    g.lineStyle(6, 0xfacc15, 1)
    for (let y = 0; y <= this.worldH + cell; y += cell) {
      for (let dashedX = 0; dashedX <= this.worldW; dashedX += 50) {
         if (dashedX % cell > (roadWidth / 2 + 10) && dashedX % cell < cell - (roadWidth / 2 + 10)) {
           if (Math.floor(dashedX / 50) % 2 === 0) g.lineBetween(dashedX, y, dashedX + 25, y)
         }
      }
    }

    // Physics body — invisible, only for collision / world bounds
    this.hole = this.physics.add.image(this.worldW / 2, this.worldH / 2, '__blank')
      .setCircle(this.holeR)
      .setCollideWorldBounds(true)
      .setVisible(false)

    // Visual hole image — separate from physics, cleanly animated
    const holeKey = this.pickAvailable('hole', 'ph-hole')
    this.holeImage = this.add.image(this.worldW / 2, this.worldH / 2, holeKey)
      .setDepth(4) // Underneath object shadows for 2.5D drop-in depth effect
      .setDisplaySize(this.holeR * 2, this.holeR * 2)


    this.foods = this.add.group()
    this.items = this.add.group()

    for (let i = 0; i < 280; i++) this.spawnFood()
    for (let i = 0; i < 3; i++) this.spawnBot()
    this.spawnItem('boost')
    this.spawnItem('magnet')

    // Input
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.holeTarget = new Phaser.Math.Vector2(p.worldX, p.worldY)
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.holeTarget = new Phaser.Math.Vector2(p.worldX, p.worldY)
    })

    this.cameras.main.startFollow(this.hole, true, 0.08, 0.08)
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH)
    this.cameras.main.setZoom(1.05)

    this.updateHud()

    this.time.addEvent({ delay: 450, loop: true, callback: () => {
      if (this.foods.getLength() < 320) {
        const z = this.getZone()
        for (let i = 0; i < (z === 'Chaos' ? 10 : z === 'Busy' ? 8 : 6); i++) this.spawnFood()
      }
    }})

    this.time.addEvent({ delay: 1200, loop: true, callback: () => {
      if (this.gameOver) return
      const z = this.getZone()
      while (this.bots.length < (z === 'Chaos' ? 6 : z === 'Busy' ? 4 : 3)) this.spawnBot()
    }})

    this.time.addEvent({ delay: 5000, loop: true, callback: () => {
      if (this.items.getLength() < 4) this.spawnItem(Math.random() > 0.5 ? 'boost' : 'magnet')
    }})
  }

  private pickAvailable(preferred: string, fallback: string) {
    return this.textures.exists(preferred) ? preferred : fallback
  }

  private applyHoleSize() {
    // Sync physics body
    const body = this.hole.body as Phaser.Physics.Arcade.Body
    body.setSize(this.holeR * 2, this.holeR * 2)
    body.updateFromGameObject()
    // Sync visual image
    this.holeImage.setDisplaySize(this.holeR * 2, this.holeR * 2)
    // Sync camera zoom based on size
    const zoom = Phaser.Math.Clamp(1.08 - (this.holeR - 24) / 420, 0.6, 1.08)
    this.cameras.main.setZoom(zoom)
  }

  private spawnFood() {
    const r = Phaser.Math.Between(8, 42)
    const x = Phaser.Math.Between(r, this.worldW - r)
    const y = Phaser.Math.Between(r, this.worldH - r)

    let key: string
    if (r < 14) {
      key = Phaser.Utils.Array.GetRandom([
        this.pickAvailable('tree', 'ph-tree'),
        this.pickAvailable('lamp', 'ph-lamp'),
        this.pickAvailable('trash', 'ph-trash'),
      ])
    } else if (r < 26) {
      key = Phaser.Utils.Array.GetRandom([
        this.pickAvailable('car', 'ph-car'),
        this.pickAvailable('bench', 'ph-bench'),
        this.pickAvailable('bus', 'ph-bus'),
      ])
    } else {
      key = Phaser.Utils.Array.GetRandom([
        this.pickAvailable('building', 'ph-building'),
        this.pickAvailable('tower', 'ph-tower'),
        this.pickAvailable('house', 'ph-house'),
      ])
    }

    const shadow = this.add.image(x + 6, y + 8, key).setDepth(4.5).setTint(0x000000).setAlpha(0.35)
    shadow.setDisplaySize(r * 2.8, r * 2.8)

    const obj = this.add.image(x, y, key).setDepth(5)
    obj.setDisplaySize(r * 2.8, r * 2.8)
    ;(obj as any).data = { kind: 'food', r, key } satisfies Food
    ;(obj as any).shadow = shadow
    this.foods.add(obj)
  }

  private spawnItem(type: 'boost' | 'magnet') {
    const x = Phaser.Math.Between(80, this.worldW - 80)
    const y = Phaser.Math.Between(80, this.worldH - 80)
    const key = type === 'boost' ? 'icon-boost' : 'icon-magnet'
    const shadow = this.add.image(x + 8, y + 10, key).setDepth(5.5).setTint(0x000000).setAlpha(0.3)
    const item = this.add.image(x, y, key).setDepth(6)
    this.tweens.add({
      targets: item, scale: { from: 0.75, to: 1.0 },
      alpha: { from: 0.8, to: 1 }, yoyo: true, repeat: -1, duration: 800,
      onUpdate: () => {
        shadow.setScale(item.scaleX * 0.9, item.scaleY * 0.9)
        shadow.x = item.x + 8 * item.scaleX
        shadow.y = item.y + 10 * item.scaleY
      }
    })
    ;(item as any).data = { kind: 'item', type } satisfies Item
    ;(item as any).shadow = shadow
    this.items.add(item)
  }

  private spawnBot() {
    let x: number, y: number, dist: number
    let tries = 0
    do {
      x = Phaser.Math.Between(60, this.worldW - 60)
      y = Phaser.Math.Between(60, this.worldH - 60)
      dist = Phaser.Math.Distance.Between(x, y, this.hole.x, this.hole.y)
      tries++
    } while (dist < 400 && tries < 6)

    const r = Phaser.Math.Between(Math.max(12, this.holeR - 10), Math.max(20, this.holeR + 16))
    const key = this.pickAvailable('hole', 'ph-hole')
    const shadow = this.add.image(x + 10, y + 12, key).setDepth(8.5).setTint(0x000000).setAlpha(0.35)
    shadow.setDisplaySize(r * 2, r * 2)

    const sprite = this.physics.add.image(x, y, key)
      .setDepth(9)
      .setTint(0xff5555)
      .setAlpha(0.9)
      .setCircle(r)
      .setCollideWorldBounds(true)
      .setDisplaySize(r * 2, r * 2)
      
    ;(sprite as any).shadow = shadow

    this.bots.push({
      sprite, r,
      target: new Phaser.Math.Vector2(x, y),
      state: 'wander',
      stateTimer: 0,
      speedMult: Phaser.Math.FloatBetween(0.82, 1.12)
    })
  }

  private getZone() {
    const x = this.hole.x
    if (x < this.worldW / 3) return 'Calm'
    if (x < (this.worldW * 2) / 3) return 'Busy'
    return 'Chaos'
  }

  private setGameOver() {
    if (this.gameOver) return
    this.gameOver = true
    this.hole.setVelocity(0, 0)
    overlayTitle.textContent = 'GAME OVER'
    overlayText.innerHTML = `Size: 🎯 ${this.holeR.toFixed(2)}<br/>Eaten: 👑 ${this.eaten}`
    startBtn.textContent = 'RESTART'
    overlay.style.display = 'grid'
  }

  private activateSkill(type: 'boost' | 'magnet') {
    this.activeSkill = type
    this.skillTimer = 5000
    this.sfx.skillPickup()
    hudSkill.textContent = type === 'boost' ? '⚡ BOOST' : '🧲 MAGNET'
    hudSkill.style.color = type === 'boost' ? '#fde047' : '#f472b6'
    hudSkill.parentElement!.classList.add('active')
  }

  update(_: number, dtMs: number) {
    if (this.gameOver) return

    // Sync visual hole to physics body every frame
    this.holeImage.x = this.hole.x
    this.holeImage.y = this.hole.y

    const zone = this.getZone()
    hudZone.textContent = zone

    if (this.skillTimer > 0) {
      this.skillTimer -= dtMs
      if (this.skillTimer <= 0) {
        this.activeSkill = 'none'
        hudSkill.textContent = 'None'
        hudSkill.style.color = ''
        hudSkill.parentElement!.classList.remove('active')
      }
    }

    // Player movement
    let baseSpeed = 520 - (this.holeR - 24) * 3.2
    if (this.activeSkill === 'boost') baseSpeed *= 1.6
    const zoneBoost = zone === 'Chaos' ? 1.08 : zone === 'Busy' ? 1.02 : 1
    const speed = Phaser.Math.Clamp(baseSpeed * zoneBoost, 170, 800)

    if (this.holeTarget) {
      const dx = this.holeTarget.x - this.hole.x
      const dy = this.holeTarget.y - this.hole.y
      const d = Math.hypot(dx, dy)
      if (d > 6) this.hole.setVelocity((dx / d) * speed, (dy / d) * speed)
      else this.hole.setVelocity(0, 0)
    }

    const magnetMult = this.activeSkill === 'magnet' ? 1.5 : 1.0
    const eatRange = this.holeR * 0.92 * magnetMult
    // Any object up to 5% larger than the hole can be swallowed. Otherwise, it blocks the player physically.
    const eatCap = this.holeR * 1.05

    // Item pickup
    const itemKids = this.items.getChildren()
    for (let i = itemKids.length - 1; i >= 0; i--) {
      const it = itemKids[i] as Phaser.GameObjects.Image
      if (Phaser.Math.Distance.Between(this.hole.x, this.hole.y, it.x, it.y) < this.holeR + 16) {
        const d = (it as any).data as Item
        this.activateSkill(d.type)
        if ((it as any).shadow) (it as any).shadow.destroy()
        this.items.remove(it, true, true)
      }
    }

    // Food eating
    const foodKids = this.foods.getChildren()
    for (let i = foodKids.length - 1; i >= 0; i--) {
      const f = foodKids[i] as Phaser.GameObjects.Image
      const r = (f as any).data.r as number
      const dx = f.x - this.hole.x
      const dy = f.y - this.hole.y
      const d = Math.hypot(dx, dy)

      if (r < eatCap) {
        // Can be eaten
        if (d < eatRange + r * 0.5) {
          const pull = Phaser.Math.Clamp((eatRange + r - d) / (eatRange + r), 0, 1)
          const nearThresholdBoost = r > this.holeR * 0.9 ? 1.8 : 1.0
          const pullStr = (this.activeSkill === 'magnet' ? 12.0 : 6.5) * nearThresholdBoost
          f.x -= dx * pull * pullStr * (dtMs / 1000)
          f.y -= dy * pull * pullStr * (dtMs / 1000)
          
          if ((f as any).shadow) {
            const sh = (f as any).shadow
            sh.x = f.x + 6 + dx * 0.1 // 2.5D depth shift during pull
            sh.y = f.y + 8 + dy * 0.1
          }

          if (d < this.holeR * 0.6) {
            if ((f as any).shadow) (f as any).shadow.destroy()
            this.foods.remove(f, true, true)
            this.eaten += 1
            const before = this.holeR
            const gain = Phaser.Math.Clamp(r / 90, 0.03, 0.35)
            this.holeR += gain
            this.applyHoleSize()

            this.tweens.killTweensOf(this.holeImage)
            this.tweens.add({
              targets: this.holeImage,
              scaleX: this.holeR * 2 * 1.12,
              scaleY: this.holeR * 2 * 1.12,
              duration: 80,
              yoyo: true,
              ease: 'Sine.easeOut',
              onComplete: () => this.holeImage.setDisplaySize(this.holeR * 2, this.holeR * 2),
            })

            if (Math.floor(before) !== Math.floor(this.holeR)) this.sfx.levelUp()
            else if (r < 12) this.sfx.eatSmall()
            else this.sfx.eatBig()

            this.updateHud()
          }
        }
      } else {
        // Cannot be eaten: Acts as an outer solid physical block. This prevents getting stuck underneath.
        const blockDist = this.holeR * 0.5 + r * 0.8;
        if (d < blockDist) {
          const push = blockDist - d;
          const nx = d > 0.001 ? -dx / d : 1;
          const ny = d > 0.001 ? -dy / d : 0;
          this.hole.x += nx * push;
          this.hole.y += ny * push;
        }
      }
    }

    // Bot AI
    this.updateBots(dtMs)

    if (this.hole.body) {
      const b = this.hole.body as Phaser.Physics.Arcade.Body
      if (b.speed < 3) this.hole.setVelocity(0, 0)
    }
  }

  private updateBots(dtMs: number) {
    const zone = this.getZone()
    const botBase = zone === 'Chaos' ? 225 : zone === 'Busy' ? 205 : 185

    for (let i = this.bots.length - 1; i >= 0; i--) {
      const bot = this.bots[i]
      const b = bot.sprite
      if (!b.active) { this.bots.splice(i, 1); continue }

      bot.stateTimer -= dtMs
      const distP = Phaser.Math.Distance.Between(b.x, b.y, this.hole.x, this.hole.y)

      if (distP < 400) {
        if (this.holeR > bot.r * 1.04) {
          bot.state = 'flee'; bot.stateTimer = 1000
        } else if (bot.r > this.holeR * 1.04) {
          bot.state = 'chase'; bot.stateTimer = 2000
        }
      } else if (bot.state === 'flee' && distP > 620) {
        bot.state = 'wander'; bot.stateTimer = 0
      }

      if (bot.stateTimer <= 0) {
        bot.state = Math.random() < 0.75 ? 'wander' : 'idle'
        bot.stateTimer = Phaser.Math.Between(2000, 5000)
        if (bot.state === 'wander') {
          bot.target = new Phaser.Math.Vector2(
            Phaser.Math.Between(50, this.worldW - 50),
            Phaser.Math.Between(50, this.worldH - 50)
          )
        }
      }

      let moveSpeed = 0
      if (bot.state === 'flee') {
        const angle = Phaser.Math.Angle.Between(this.hole.x, this.hole.y, b.x, b.y)
        const v = new Phaser.Math.Vector2().setToPolar(angle, 100)
        bot.target = new Phaser.Math.Vector2(b.x + v.x, b.y + v.y)
        moveSpeed = botBase * 1.3
      } else if (bot.state === 'chase') {
        bot.target = new Phaser.Math.Vector2(this.hole.x, this.hole.y)
        moveSpeed = botBase * 1.1
      } else if (bot.state === 'wander' && bot.target) {
        moveSpeed = botBase * 0.8
      }

      if (bot.target) {
        const dx = bot.target.x - b.x
        const dy = bot.target.y - b.y
        const d = Math.hypot(dx, dy) || 1
        if (d > 10) b.setVelocity((dx / d) * moveSpeed * bot.speedMult, (dy / d) * moveSpeed * bot.speedMult)
        else b.setVelocity(0, 0)
      } else {
        b.setVelocity(0, 0)
      }
      
      if ((b as any).shadow) {
        const sh = (b as any).shadow
        sh.x = b.x + 10
        sh.y = b.y + 12
        sh.setDisplaySize(bot.r * 2, bot.r * 2)
      }

      // Player vs bot collision
      if (distP < (this.holeR + bot.r) * 0.58) {
        if (this.holeR > bot.r * 1.05) {
          // Player eats bot
          this.bots.splice(i, 1)
          if ((b as any).shadow) (b as any).shadow.destroy()
          this.tweens.add({ targets: b, scaleX: 0.05, scaleY: 0.05, alpha: 0, duration: 150, onComplete: () => b.destroy() })
          this.holeR += Phaser.Math.Clamp(bot.r / 140, 0.08, 0.45)
          this.applyHoleSize()
          this.sfx.levelUp()
          this.updateHud()
        } else if (bot.r > this.holeR * 1.05) {
          this.setGameOver()
          return
        }
      }
    }
  }

  private lastSizeStr = '1.00';
  private lastEaten = 0;

  private triggerPop(el: HTMLElement) {
    const parent = el.parentElement;
    if (parent) {
      parent.classList.remove('pop');
      void parent.offsetWidth; // reflow
      parent.classList.add('pop');
    }
  }

  private updateHud() {
    const newSizeStr = this.holeR.toFixed(2);
    if (this.lastSizeStr !== newSizeStr) {
      hudSize.textContent = newSizeStr;
      this.triggerPop(hudSize);
      this.lastSizeStr = newSizeStr;
    }
    
    if (this.lastEaten !== this.eaten) {
      hudEaten.textContent = String(this.eaten);
      this.triggerPop(hudEaten);
      this.lastEaten = this.eaten;
    }
    
    hudZone.textContent = this.getZone();
  }

  public sfxEnsure() { this.sfx.ensure() }
  public toggleMute(enabled: boolean) { this.sfx.setEnabled(enabled) }
}

function createGame() {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0b0c10',
    physics: { default: 'arcade', arcade: { debug: false } },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    scene: [GameScene],
  } as Phaser.Types.Core.GameConfig)
}

// Generate invisible texture for physics-only body
Phaser.Game.prototype.textures ? null : null

let game: Phaser.Game | undefined
let sfxEnabled = true

function bootOrRestart() {
  overlay.style.display = 'none'
  if (game) { game.destroy(true); game = undefined }
  game = createGame()
  ;(game.scene.getScene('game') as GameScene).sfxEnsure()
}

startBtn.addEventListener('click', () => {
  startBtn.textContent = 'PLAY'
  overlayTitle.textContent = 'Hole Web'
  overlayText.innerHTML = '滑鼠移動 / 觸控拖曳。<br/>吞小物件變大，無限模式。'
  bootOrRestart()
})

restartBtn.addEventListener('click', bootOrRestart)

muteBtn.addEventListener('click', () => {
  sfxEnabled = !sfxEnabled
  muteBtn.textContent = sfxEnabled ? '🔊' : '🔇'
  if (!game) return
  ;(game.scene.getScene('game') as GameScene).toggleMute(sfxEnabled)
})
