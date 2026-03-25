import Phaser from 'phaser'
import './style.css'

/**
 * Minimal Hole.io-like endless prototype (browser + responsive).
 * - Phaser 3
 * - RESIZE scaling for all screens
 * - Mouse follow on desktop, drag on touch
 * - Simple SFX via WebAudio (no asset files)
 */

class Sfx {
  private ctx?: AudioContext
  private enabled = true

  setEnabled(v: boolean) {
    this.enabled = v
  }

  /** Must be called after a user gesture (Start / tap) */
  ensure() {
    if (!this.enabled) return
    if (!this.ctx) this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  blip(freq = 240, durationMs = 45, gain = 0.04) {
    if (!this.enabled) return
    if (!this.ctx) return

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

  eatSmall() {
    this.blip(240 + Math.random() * 40, 35, 0.035)
  }
  eatBig() {
    this.blip(140 + Math.random() * 30, 70, 0.05)
  }
  levelUp() {
    this.blip(320, 60, 0.05)
    setTimeout(() => this.blip(420, 60, 0.045), 55)
  }
  bump() {
    this.blip(90, 80, 0.04)
  }
}

type Food = {
  kind: 'food'
  r: number
  key: string
}

class GameScene extends Phaser.Scene {
  private hole!: Phaser.Physics.Arcade.Image
  private holeR = 24
  private holeTarget?: Phaser.Math.Vector2
  private foods!: Phaser.GameObjects.Group
  private eaten = 0
  private sfx = new Sfx()
  private hudSize = document.getElementById('size')!
  private hudEaten = document.getElementById('eaten')!

  constructor() {
    super('game')
  }

  preload() {
    // OpenAI-generated sprites (public/ => served from /assets/...)
    this.load.image('hole', 'assets/ai/openai/hole/001-top-down-2d-game-sprite-stylized-black-h.png')
    this.load.image('tree', 'assets/ai/openai/tree/001-top-down-2d-game-sprite-small-stylized-t.png')
    this.load.image('car', 'assets/ai/openai/car/001-top-down-2d-game-sprite-compact-blue-cit.png')
    this.load.image('building', 'assets/ai/openai/building/001-top-down-2d-game-sprite-small-city-build.png')

    // Fallback placeholders (SVG) if you want to swap quickly later
    this.load.svg('ph-hole', 'assets/ai/placeholder-hole.svg', { width: 256, height: 256 })
    this.load.svg('ph-tree', 'assets/ai/placeholder-tree.svg', { width: 256, height: 256 })
    this.load.svg('ph-car', 'assets/ai/placeholder-car.svg', { width: 256, height: 256 })
    this.load.svg('ph-building', 'assets/ai/placeholder-building.svg', { width: 256, height: 256 })
  }

  create() {
    // Camera bounds (world bigger than view)
    const worldW = 2400
    const worldH = 2400
    this.physics.world.setBounds(0, 0, worldW, worldH)

    // Background grid
    const g = this.add.graphics()
    g.fillStyle(0x0b0c10, 1)
    g.fillRect(0, 0, worldW, worldH)
    g.lineStyle(1, 0x111827, 1)
    for (let x = 0; x <= worldW; x += 80) g.lineBetween(x, 0, x, worldH)
    for (let y = 0; y <= worldH; y += 80) g.lineBetween(0, y, worldW, y)

    // Hole (physics image)
    this.hole = this.physics.add.image(worldW / 2, worldH / 2, this.pickAvailable('hole', 'ph-hole'))
      .setDepth(10)
      .setDamping(true)
      .setDrag(0.0001) as Phaser.Physics.Arcade.Image

    this.hole.setCircle(this.holeR)
    this.hole.setCollideWorldBounds(true)
    this.hole.setDisplaySize(this.holeR * 2, this.holeR * 2)

    // Foods group
    this.foods = this.add.group()

    // Spawn initial foods
    for (let i = 0; i < 260; i++) this.spawnFood(worldW, worldH)

    // Input: desktop follow, touch drag
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.holeTarget = new Phaser.Math.Vector2(p.worldX, p.worldY)
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown || !p.wasTouch) {
        this.holeTarget = new Phaser.Math.Vector2(p.worldX, p.worldY)
      }
    })

    // Camera follow
    this.cameras.main.startFollow(this.hole, true, 0.08, 0.08)
    this.cameras.main.setBounds(0, 0, worldW, worldH)

    // Subtle zoom out as you grow (bounded)
    this.cameras.main.setZoom(1.05)

    // HUD + mute
    const muteBtn = document.getElementById('mute') as HTMLButtonElement
    let muted = false
    muteBtn.addEventListener('click', () => {
      muted = !muted
      this.sfx.setEnabled(!muted)
      muteBtn.textContent = muted ? 'SFX: OFF' : 'SFX: ON'
    })

    this.updateHud()

    // Small periodic respawn to keep endless
    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        const count = this.foods.getLength()
        if (count < 300) {
          for (let i = 0; i < 6; i++) this.spawnFood(worldW, worldH)
        }
      },
    })
  }

  private pickAvailable(preferred: string, fallback: string) {
    return this.textures.exists(preferred) ? preferred : fallback
  }

  private spawnFood(worldW: number, worldH: number) {
    const r = Phaser.Math.Between(6, 26)
    const x = Phaser.Math.Between(r, worldW - r)
    const y = Phaser.Math.Between(r, worldH - r)

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
      ])
    } else {
      key = Phaser.Utils.Array.GetRandom([
        this.pickAvailable('building', 'ph-building'),
        this.pickAvailable('tower', 'ph-tower'),
      ])
    }

    const obj = this.add.image(x, y, key).setDepth(5)
    obj.setDisplaySize(r * 2, r * 2)

    ;(obj as any).data = { kind: 'food', r, key } satisfies Food

    this.foods.add(obj)
  }

  update(_: number, dtMs: number) {
    const dt = dtMs / 1000
    // Move toward target
    const speed = Phaser.Math.Clamp(520 - (this.holeR - 24) * 3.2, 170, 520)
    if (this.holeTarget) {
      const dx = this.holeTarget.x - this.hole.x
      const dy = this.holeTarget.y - this.hole.y
      const d = Math.hypot(dx, dy)
      if (d > 6) {
        this.hole.setVelocity((dx / d) * speed, (dy / d) * speed)
      } else {
        this.hole.setVelocity(0, 0)
      }
    }

    // Eating check (simple distance test)
    const eatRange = this.holeR * 0.92
    const eatCap = this.holeR * 0.90

    const foods = this.foods.getChildren() as Phaser.GameObjects.Image[]
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i]
      const r = (f as any).data.r as number

      const dx = f.x - this.hole.x
      const dy = f.y - this.hole.y
      const d = Math.hypot(dx, dy)

      // Close enough to be sucked
      if (d < eatRange + r * 0.5) {
        // Can only eat if food smaller than cap
        if (r < eatCap) {
          // Pull toward center
          const pull = Phaser.Math.Clamp((eatRange + r - d) / (eatRange + r), 0, 1)
          f.x -= dx * pull * 6.5 * dt
          f.y -= dy * pull * 6.5 * dt

          // Actually eaten
          if (d < this.holeR * 0.52) {
            this.foods.remove(f, true, true)
            this.eaten += 1

            const before = this.holeR
            const gain = Phaser.Math.Clamp(r / 90, 0.03, 0.35)
            this.holeR += gain

            // Update physics circle and camera zoom
            this.hole.setCircle(this.holeR)
            this.hole.setDisplaySize(this.holeR * 2, this.holeR * 2)

            const zoom = Phaser.Math.Clamp(1.08 - (this.holeR - 24) / 420, 0.6, 1.08)
            this.cameras.main.setZoom(zoom)

            if (Math.floor(before) !== Math.floor(this.holeR)) {
              this.sfx.levelUp()
            } else {
              // Different SFX for small/big
              if (r < 12) this.sfx.eatSmall()
              else this.sfx.eatBig()
            }

            this.updateHud()
          }
        } else {
          // Too big -> slight bump feedback when you try to eat
          if (d < this.holeR * 0.6) this.sfx.bump()
        }
      }
    }

    // Tiny idle drift reduction
    if (this.hole.body && (this.hole.body as Phaser.Physics.Arcade.Body).speed < 3) this.hole.setVelocity(0, 0)
  }

  private updateHud() {
    this.hudSize.textContent = this.holeR.toFixed(2)
    this.hudEaten.textContent = String(this.eaten)
  }

  // Allow main.ts to control audio init (after user gesture)
  public sfxEnsure() {
    this.sfx.ensure()
  }
}

function createGame() {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0b0c10',
    physics: {
      default: 'arcade',
      arcade: {
        debug: false,
      },
    },
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

const overlay = document.getElementById('overlay')!
const startBtn = document.getElementById('start') as HTMLButtonElement

startBtn.addEventListener('click', () => {
  overlay.style.display = 'none'

  if (!game) game = createGame()

  // Ensure audio after gesture
  const scene = game.scene.getScene('game') as GameScene
  scene.sfxEnsure()
})
