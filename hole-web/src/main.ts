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
}

type Food = { kind: 'food'; r: number; key: string }

class GameScene extends Phaser.Scene {
  private hole!: Phaser.Physics.Arcade.Image
  private holeR = 24
  private holeTarget?: Phaser.Math.Vector2
  private foods!: Phaser.GameObjects.Group
  private eaten = 0
  private sfx = new Sfx()
  private hudSize = document.getElementById('size')!
  private hudEaten = document.getElementById('eaten')!

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
  }

  create() {
    const worldW = 2400
    const worldH = 2400
    this.physics.world.setBounds(0, 0, worldW, worldH)

    const g = this.add.graphics()
    g.fillStyle(0x0b0c10, 1)
    g.fillRect(0, 0, worldW, worldH)
    g.lineStyle(1, 0x111827, 1)
    for (let x = 0; x <= worldW; x += 80) g.lineBetween(x, 0, x, worldH)
    for (let y = 0; y <= worldH; y += 80) g.lineBetween(0, y, worldW, y)

    this.hole = this.physics.add.image(worldW / 2, worldH / 2, this.pickAvailable('hole', 'ph-hole'))
      .setDepth(10)
      .setDamping(true)
      .setDrag(0.0001)

    this.hole.setCircle(this.holeR)
    this.hole.setCollideWorldBounds(true)
    this.hole.setDisplaySize(this.holeR * 2, this.holeR * 2)

    this.foods = this.add.group()
    for (let i = 0; i < 260; i++) this.spawnFood(worldW, worldH)

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.holeTarget = new Phaser.Math.Vector2(p.worldX, p.worldY)
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown || !p.wasTouch) this.holeTarget = new Phaser.Math.Vector2(p.worldX, p.worldY)
    })

    this.cameras.main.startFollow(this.hole, true, 0.08, 0.08)
    this.cameras.main.setBounds(0, 0, worldW, worldH)
    this.cameras.main.setZoom(1.05)

    const muteBtn = document.getElementById('mute') as HTMLButtonElement
    let muted = false
    muteBtn.addEventListener('click', () => {
      muted = !muted
      this.sfx.setEnabled(!muted)
      muteBtn.textContent = muted ? 'SFX: OFF' : 'SFX: ON'
    })

    this.updateHud()

    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        if (this.foods.getLength() < 320) for (let i = 0; i < 8; i++) this.spawnFood(worldW, worldH)
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

  update(_: number, dtMs: number) {
    const dt = dtMs / 1000
    const speed = Phaser.Math.Clamp(520 - (this.holeR - 24) * 3.2, 170, 520)

    if (this.holeTarget) {
      const dx = this.holeTarget.x - this.hole.x
      const dy = this.holeTarget.y - this.hole.y
      const d = Math.hypot(dx, dy)
      if (d > 6) this.hole.setVelocity((dx / d) * speed, (dy / d) * speed)
      else this.hole.setVelocity(0, 0)
    }

    const eatRange = this.holeR * 0.92
    const eatCap = this.holeR * 0.9
    const foods = this.foods.getChildren() as Phaser.GameObjects.Image[]

    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i]
      const r = (f as any).data.r as number
      const dx = f.x - this.hole.x
      const dy = f.y - this.hole.y
      const d = Math.hypot(dx, dy)

      if (d < eatRange + r * 0.5) {
        if (r < eatCap) {
          const pull = Phaser.Math.Clamp((eatRange + r - d) / (eatRange + r), 0, 1)
          f.x -= dx * pull * 6.5 * dt
          f.y -= dy * pull * 6.5 * dt

          if (d < this.holeR * 0.52) {
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
        } else if (d < this.holeR * 0.6) {
          this.sfx.bump()
        }
      }
    }

    if (this.hole.body && (this.hole.body as Phaser.Physics.Arcade.Body).speed < 3) this.hole.setVelocity(0, 0)
  }

  private updateHud() {
    this.hudSize.textContent = this.holeR.toFixed(2)
    this.hudEaten.textContent = String(this.eaten)
  }

  public sfxEnsure() {
    this.sfx.ensure()
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
const overlay = document.getElementById('overlay')!
const startBtn = document.getElementById('start') as HTMLButtonElement

startBtn.addEventListener('click', () => {
  overlay.style.display = 'none'
  if (!game) game = createGame()
  const scene = game.scene.getScene('game') as GameScene
  scene.sfxEnsure()
})
