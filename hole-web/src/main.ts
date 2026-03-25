import Phaser from 'phaser'
import './style.css'

class Sfx {
  private ctx?: AudioContext
  private enabled = true

  setEnabled(v: boolean) {
    this.enabled = v
  }

  ensure() {
    if (!this.enabled) return
    if (!this.ctx) this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  blip(freq = 240, durationMs = 45, gain = 0.04) {
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
type Bot = {
  sprite: Phaser.Physics.Arcade.Image
  r: number
  target?: Phaser.Math.Vector2
  state: BotState
  stateTimer: number
  speedMult: number
}

const overlay = document.getElementById('overlay')!
const overlayTitle = document.getElementById('overlay-title') as HTMLHeadingElement
const overlayText = document.getElementById('overlay-text') as HTMLParagraphElement
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
  private foods!: Phaser.GameObjects.Group
  private items!: Phaser.GameObjects.Group
  private bots: Bot[] = []
  private eaten = 0
  private sfx = new Sfx()
  private gameOver = false

  // Skill state
  private activeSkill: 'none' | 'boost' | 'magnet' = 'none'
  private skillTimer = 0

  constructor() { super('game') }

  preload() {
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

    // Skill icons
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

    const g = this.add.graphics()
    g.fillStyle(0x0b0c10, 1)
    g.fillRect(0, 0, this.worldW, this.worldH)
    g.lineStyle(1, 0x111827, 1)
    for (let x = 0; x <= this.worldW; x += 80) g.lineBetween(x, 0, x, this.worldH)
    for (let y = 0; y <= this.worldH; y += 80) g.lineBetween(0, y, this.worldW, y)

    this.hole = this.physics.add.image(this.worldW / 2, this.worldH / 2, this.pickAvailable('hole', 'ph-hole'))
      .setDepth(10)
      .setDamping(true)
      .setDrag(0.0001)

    this.hole.setCircle(this.holeR)
    this.hole.setCollideWorldBounds(true)
    this.hole.setDisplaySize(this.holeR * 2, this.holeR * 2)

    this.foods = this.add.group()
    this.items = this.add.group()

    for (let i = 0; i < 280; i++) this.spawnFood()
    for (let i = 0; i < 3; i++) this.spawnBot()
    // Initial skill items
    this.spawnItem('boost')
    this.spawnItem('magnet')

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.holeTarget = new Phaser.Math.Vector2(p.worldX, p.worldY)
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown || !p.wasTouch) this.holeTarget = new Phaser.Math.Vector2(p.worldX, p.worldY)
    })

    this.cameras.main.startFollow(this.hole, true, 0.08, 0.08)
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH)
    this.cameras.main.setZoom(1.05)

    this.updateHud()

    // Food respawn
    this.time.addEvent({
      delay: 450,
      loop: true,
      callback: () => {
        if (this.foods.getLength() < 340) {
          const zone = this.getZone()
          const add = zone === 'Chaos' ? 10 : zone === 'Busy' ? 8 : 6
          for (let i = 0; i < add; i++) this.spawnFood()
        }
      },
    })

    // Bot maintenance
    this.time.addEvent({
      delay: 1200,
      loop: true,
      callback: () => {
        if (this.gameOver) return
        const zone = this.getZone()
        const targetBots = zone === 'Chaos' ? 6 : zone === 'Busy' ? 4 : 3
        while (this.bots.length < targetBots) this.spawnBot()
      },
    })

    // Item respawn
    this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => {
        if (this.items.getLength() < 4) {
          this.spawnItem(Math.random() > 0.5 ? 'boost' : 'magnet')
        }
      },
    })
  }

  private pickAvailable(preferred: string, fallback: string) {
    return this.textures.exists(preferred) ? preferred : fallback
  }

  private spawnFood() {
    const r = Phaser.Math.Between(6, 26)
    const x = Phaser.Math.Between(r, this.worldW - r)
    const y = Phaser.Math.Between(r, this.worldH - r)

    let key: string
    if (r < 10) {
      key = Phaser.Utils.Array.GetRandom([
        this.pickAvailable('tree', 'ph-tree'),
        this.pickAvailable('lamp', 'ph-lamp'),
        this.pickAvailable('trash', 'ph-trash'),
      ])
    } else if (r < 18) {
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

    const obj = this.add.image(x, y, key).setDepth(5)
    obj.setDisplaySize(r * 2, r * 2)
    ;(obj as any).data = { kind: 'food', r, key } satisfies Food
    this.foods.add(obj)
  }

  private spawnItem(type: 'boost' | 'magnet') {
    const x = Phaser.Math.Between(50, this.worldW - 50)
    const y = Phaser.Math.Between(50, this.worldH - 50)
    const key = type === 'boost' ? 'icon-boost' : 'icon-magnet'
    const item = this.add.image(x, y, key).setDepth(6)
    
    // Add glowing tween
    this.tweens.add({
      targets: item,
      scale: { from: 0.8, to: 1.0 },
      alpha: { from: 0.8, to: 1 },
      yoyo: true,
      repeat: -1,
      duration: 800
    })

    ;(item as any).data = { kind: 'item', type } satisfies Item
    this.items.add(item)
  }

  private spawnBot() {
    // Spawn away from player if possible
    let x, y, dist
    let attempts = 0
    do {
      x = Phaser.Math.Between(50, this.worldW - 50)
      y = Phaser.Math.Between(50, this.worldH - 50)
      dist = Phaser.Math.Distance.Between(x, y, this.hole.x, this.hole.y)
      attempts++
    } while (dist < 400 && attempts < 5)

    const r = Phaser.Math.Between(Math.max(12, this.holeR - 8), Math.max(18, this.holeR + 15))
    
    const sprite = this.physics.add.image(x, y, this.pickAvailable('hole', 'ph-hole'))
      .setDepth(9)
      .setTint(0xff6b6b) // Red tint for enemies
      .setAlpha(0.92)

    sprite.setCircle(r)
    sprite.setCollideWorldBounds(true)
    sprite.setDisplaySize(r * 2, r * 2)

    this.bots.push({
      sprite,
      r,
      target: new Phaser.Math.Vector2(x, y),
      state: 'wander',
      stateTimer: 0,
      speedMult: Phaser.Math.FloatBetween(0.85, 1.1)
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

    overlayTitle.textContent = '你被吞掉了 💀'
    overlayText.textContent = `最終 Size ${this.holeR.toFixed(2)}，吞噬 ${this.eaten} 個物件。按下 Restart 再戰。`
    startBtn.textContent = 'Restart'
    overlay.style.display = 'grid'
  }

  private activateSkill(type: 'boost' | 'magnet') {
    this.activeSkill = type
    this.skillTimer = 5000 // 5 seconds
    this.sfx.skillPickup()
    hudSkill.textContent = type === 'boost' ? 'BOOST! ⚡' : 'MAGNET! 🧲'
    hudSkill.style.color = type === 'boost' ? '#fde047' : '#f472b6'
  }

  update(_: number, dtMs: number) {
    if (this.gameOver) return

    const dt = dtMs / 1000
    const zone = this.getZone()
    hudZone.textContent = zone

    // Update skill
    if (this.skillTimer > 0) {
      this.skillTimer -= dtMs
      if (this.skillTimer <= 0) {
        this.activeSkill = 'none'
        hudSkill.textContent = 'None'
        hudSkill.style.color = ''
      }
    }

    // Player movement
    let baseSpeed = 520 - (this.holeR - 24) * 3.2
    if (this.activeSkill === 'boost') baseSpeed *= 1.6
    
    const zoneSpeedBoost = zone === 'Chaos' ? 1.08 : zone === 'Busy' ? 1.02 : 1
    const speed = Phaser.Math.Clamp(baseSpeed * zoneSpeedBoost, 170, 800)

    if (this.holeTarget) {
      const dx = this.holeTarget.x - this.hole.x
      const dy = this.holeTarget.y - this.hole.y
      const d = Math.hypot(dx, dy)
      if (d > 6) this.hole.setVelocity((dx / d) * speed, (dy / d) * speed)
      else this.hole.setVelocity(0, 0)
    }

    // Eat check logic
    const magnetMult = this.activeSkill === 'magnet' ? 1.5 : 1.0
    const eatRange = this.holeR * 0.92 * magnetMult
    const eatCap = this.holeR * 0.90

    // Check items
    const items = this.items.getChildren() as Phaser.GameObjects.Image[]
    for (const item of items) {
      if (Phaser.Math.Distance.Between(this.hole.x, this.hole.y, item.x, item.y) < this.holeR) {
        const data = (item as any).data as Item
        this.activateSkill(data.type)
        this.items.remove(item, true, true)
      }
    }

    // Check food
    const foods = this.foods.getChildren() as Phaser.GameObjects.Image[]
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i]
      const r = (f as any).data.r as number
      const dx = f.x - this.hole.x
      const dy = f.y - this.hole.y
      const d = Math.hypot(dx, dy)

      if (d < eatRange + r * 0.5) {
        if (r < eatCap) {
          // Pull effect
          const pullStr = this.activeSkill === 'magnet' ? 12.0 : 6.5
          const pull = Phaser.Math.Clamp((eatRange + r - d) / (eatRange + r), 0, 1)
          f.x -= dx * pull * pullStr * dt
          f.y -= dy * pull * pullStr * dt

          if (d < this.holeR * 0.52) {
            this.consumeFood(f, r)
          }
        } else if (d < this.holeR * 0.6) {
          this.sfx.bump()
        }
      }
    }

    // Update Bots
    this.updateBots(dtMs)

    if (this.hole.body && (this.hole.body as Phaser.Physics.Arcade.Body).speed < 3) this.hole.setVelocity(0, 0)
  }

  private consumeFood(f: Phaser.GameObjects.Image, r: number) {
    this.foods.remove(f)
    this.tweens.add({
      targets: f,
      x: this.hole.x,
      y: this.hole.y,
      scaleX: 0.08,
      scaleY: 0.08,
      angle: f.angle + Phaser.Math.Between(120, 260),
      alpha: 0,
      duration: Phaser.Math.Between(90, 140),
      ease: 'Quad.easeIn',
      onComplete: () => f.destroy(),
    })

    this.eaten += 1
    const before = this.holeR
    const gain = Phaser.Math.Clamp(r / 90, 0.03, 0.35)
    this.holeR += gain
    this.hole.setCircle(this.holeR)
    this.hole.setDisplaySize(this.holeR * 2, this.holeR * 2)

    const zoom = Phaser.Math.Clamp(1.08 - (this.holeR - 24) / 420, 0.6, 1.08)
    this.cameras.main.setZoom(zoom)

    if (Math.floor(before) !== Math.floor(this.holeR)) this.sfx.levelUp()
    else if (r < 12) this.sfx.eatSmall()
    else this.sfx.eatBig()

    this.tweens.killTweensOf(this.hole)
    this.tweens.add({
      targets: this.hole,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 70,
      yoyo: true,
      ease: 'Sine.easeOut',
    })

    this.updateHud()
  }

  private updateBots(dtMs: number) {
    const dt = dtMs / 1000
    for (let i = this.bots.length - 1; i >= 0; i--) {
      const bot = this.bots[i]
      const b = bot.sprite
      if (!b.active) {
        this.bots.splice(i, 1)
        continue
      }

      // State machine logic
      bot.stateTimer -= dtMs
      const distToPlayer = Phaser.Math.Distance.Between(b.x, b.y, this.hole.x, this.hole.y)
      
      // State transitions
      if (bot.state === 'flee' && distToPlayer > 600) {
        bot.state = 'wander'
        bot.stateTimer = 0
      }

      // Check threats
      if (distToPlayer < 400) {
        if (this.holeR > bot.r * 1.05) {
          bot.state = 'flee'
          bot.stateTimer = 1000
        } else if (bot.r > this.holeR * 1.05) {
          bot.state = 'chase'
          bot.stateTimer = 2000
        }
      }

      if (bot.stateTimer <= 0) {
        // Pick new state
        if (Math.random() < 0.7) {
          bot.state = 'wander'
          bot.stateTimer = Phaser.Math.Between(2000, 5000)
          // Pick random point
          bot.target = new Phaser.Math.Vector2(
            Phaser.Math.Between(50, this.worldW-50),
            Phaser.Math.Between(50, this.worldH-50)
          )
        } else {
          // Idle briefly
          bot.state = 'idle'
          bot.stateTimer = Phaser.Math.Between(500, 1500)
          bot.target = undefined
        }
      }

      // Execute movement
      let moveSpeed = 0
      const botBaseSpeed = 240 - (bot.r - 20) * 2.0

      if (bot.state === 'flee') {
        // Run away from player
        const angle = Phaser.Math.Angle.Between(this.hole.x, this.hole.y, b.x, b.y)
        const vec = new Phaser.Math.Vector2().setToPolar(angle, 100)
        bot.target = new Phaser.Math.Vector2(b.x + vec.x, b.y + vec.y)
        moveSpeed = botBaseSpeed * 1.3
      } else if (bot.state === 'chase') {
        bot.target = new Phaser.Math.Vector2(this.hole.x, this.hole.y)
        moveSpeed = botBaseSpeed * 1.1
      } else if (bot.state === 'wander') {
        moveSpeed = botBaseSpeed * 0.8
      }

      if (bot.target && bot.state !== 'idle') {
        const dx = bot.target.x - b.x
        const dy = bot.target.y - b.y
        const d = Math.hypot(dx, dy) || 1
        
        if (d > 10) {
          b.setVelocity((dx / d) * moveSpeed * bot.speedMult, (dy / d) * moveSpeed * bot.speedMult)
        } else {
          b.setVelocity(0, 0)
          if (bot.state === 'wander') bot.stateTimer = 0 // Pick new target
        }
      } else {
        b.setVelocity(0, 0)
      }

      // Check collision with player
      if (distToPlayer < (this.holeR + bot.r) * 0.6) {
        // Player eats bot
        if (this.holeR > bot.r * 1.05) {
          this.bots.splice(i, 1)
          this.consumeBot(b, bot.r)
          continue
        }
        // Bot eats player
        if (bot.r > this.holeR * 1.05) {
          this.setGameOver()
          return
        }
      }
    }
  }

  private consumeBot(b: Phaser.Physics.Arcade.Image, r: number) {
    this.tweens.add({
      targets: b,
      x: this.hole.x,
      y: this.hole.y,
      scaleX: 0.05,
      scaleY: 0.05,
      alpha: 0,
      duration: 150,
      onComplete: () => b.destroy(),
    })
    
    this.holeR += Phaser.Math.Clamp(r / 140, 0.08, 0.45)
    this.hole.setCircle(this.holeR)
    this.hole.setDisplaySize(this.holeR * 2, this.holeR * 2)
    this.sfx.levelUp()
    this.updateHud()
  }

  private updateHud() {
    hudSize.textContent = this.holeR.toFixed(2)
    hudEaten.textContent = String(this.eaten)
    hudZone.textContent = this.getZone()
  }

  public sfxEnsure() {
    this.sfx.ensure()
  }

  public toggleMute() {
    const on = muteBtn.textContent?.includes('ON')
    this.sfx.setEnabled(!on)
  }
}

function createGame() {
  const config: Phaser.Types.Core.GameConfig = {
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
  }
  return new Phaser.Game(config)
}

let game: Phaser.Game | undefined

function bootOrRestart() {
  overlay.style.display = 'none'
  if (game) {
    game.destroy(true)
    game = undefined
  }
  game = createGame()
  const scene = game.scene.getScene('game') as GameScene
  scene.sfxEnsure()
}

startBtn.addEventListener('click', () => {
  startBtn.textContent = 'Start'
  overlayTitle.textContent = 'Hole Web'
  overlayText.textContent = '滑鼠移動 / 觸控拖曳。吞小物件變大，無限模式。'
  bootOrRestart()
})

restartBtn.addEventListener('click', () => bootOrRestart())

muteBtn.addEventListener('click', () => {
  const isOn = muteBtn.textContent?.includes('ON')
  muteBtn.textContent = isOn ? 'SFX: OFF' : 'SFX: ON'
  if (!game) return
  const scene = game.scene.getScene('game') as GameScene
  scene.toggleMute()
})
