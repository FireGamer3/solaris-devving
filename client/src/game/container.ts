import {Viewport} from 'pixi-viewport'
import Map from './map'
import gameHelper from '../services/gameHelper.js'
import textureService from './texture'
import type {Store} from "vuex";
import type {State} from "../store";
import {Application, BitmapText, isWebGLSupported} from "pixi.js";
import type {UserGameSettings} from "@solaris-common";
import type {Game} from "../types/game";
import { screenshot } from './screenshot';
import { DebugTools } from './debugTools';

export class DrawingContext {
  store: Store<State>;

  constructor (store) {
    this.store = store;
  }

  getPlayerColour (playerId) {
    return this.store.getters.getColourForPlayer(playerId).value
  }
}

export class GameContainer {
  app: Application | null = null;
  map: Map | undefined;
  store: Store<State> | undefined;
  context: DrawingContext | undefined;
  viewport: Viewport | undefined;
  starFieldLeft: number = 0;
  starFieldRight: number = 0;
  starFieldTop: number = 0;
  starFieldBottom: number = 0;
  userSettings: UserGameSettings | undefined;
  game: Game | undefined;
  debugTools: DebugTools | undefined;

  reportGameError: ((err: string) => void) | undefined;

  constructor () {

  }

  checkPerformance(): { webgl: boolean, performance: boolean } {
    const webgl = isWebGLSupported(false);
    const performance = isWebGLSupported(true);

    if (!webgl) {
      return {
        webgl,
        performance: false
      };
    } else {
      return {
        webgl,
        performance
      };
    }
  }

  async setupApp (store, userSettings, reportGameError) {
    this.store = store
    this.reportGameError = reportGameError;

    this.context = new DrawingContext(store)

    // Cleanup if the app already exists.
    this.destroy()

    let antialiasing = userSettings.map.antiAliasing === 'enabled';

    this.app = new Application();

    const options = {
      width: window.innerWidth, // window.innerWidth,
      height: window.innerHeight - 45, // window.innerHeight,
      backgroundColor: 0x000000, // black hexadecimal
      resolution: window.devicePixelRatio || 1,
      antialias: antialiasing,
      autoDensity: true,
    };

    await this.app!.init(options);
    this.app!.ticker.add(this.onTick.bind(this))
    this.app!.ticker.maxFPS = 0

    await textureService.loadAssets();
    textureService.initialize()

    // create viewport
    this.viewport = new Viewport({
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,

      // yolo
      worldWidth: Number.MAX_VALUE,
      worldHeight: Number.MAX_VALUE,

      stopPropagation: true,
      passiveWheel: true,

      disableOnContextMenu: true,
      events: this.app!.renderer.events
    })

    // add the viewport to the stage
    this.app!.stage.addChild(this.viewport)

    // Add a new map to the viewport
    this.map = new Map(this.app, this.store, this, this.context!)
    this.viewport.addChild(this.map.container)
  }

  destroy () {
    if (this.viewport) {
      this.viewport.destroy()
      this.viewport = undefined
    }

    // Cleanup if the app already exists.
    if (this.app) {
      this.app.destroy(false, {
        children: true
      })

      this.app = null
    }
  }

  downloadMap () {
    this.map!.unselectAllCarriers()
    this.map!.unselectAllStars()
    this.map!.clearWaypoints()
    this.map!.clearRulerPoints()

    screenshot(this, this.game!, this.reportGameError!);
  }

  zoomIn () {
    this.viewport!.zoomPercent(0.5, true)
  }

  zoomOut () {
    this.viewport!.zoomPercent(-0.3, true)
  }

  setupViewport (game: Game) {
    this.game = game

    this.starFieldLeft = gameHelper.calculateMinStarX(game) - 1500
    this.starFieldRight = gameHelper.calculateMaxStarX(game) + 1500
    this.starFieldTop = gameHelper.calculateMinStarY(game) - 750
    this.starFieldBottom = gameHelper.calculateMaxStarY(game) + 750

    const maxWidth = 2 * Math.abs(this.starFieldLeft) + Math.abs(this.starFieldRight);
    const maxHeight = 2 * Math.abs(this.starFieldBottom) + Math.abs(this.starFieldTop);

    this.viewport!.resize(window.innerWidth, window.innerHeight, maxWidth, maxHeight)

    // activate plugins
    this.viewport!
      .drag()
      .pinch()
      .wheel({
        // percent: 2,
        smooth: 5
      })
      .decelerate({ friction: 0.9 })
      .clampZoom({
        minWidth: 50,
        minHeight: 50,
        maxWidth,
        maxHeight,
      })

    this.viewport!.on('zoomed-end', this.onViewportZoomed.bind(this))
    this.viewport!.on('pointerdown', this.map!.onViewportPointerDown.bind(this.map))
  }

  setup (game: Game, userSettings: UserGameSettings, context: DrawingContext) {
    this.game = game;
    this.userSettings = userSettings

    this.map!.setup(this.game!, userSettings)


    if (userSettings?.technical?.performanceMonitor === 'enabled') {
      this.debugTools = new DebugTools(this.app!, this.map!);
    }
  }

  draw () {
    this.map!.draw()

    const zoomPercent = this.getViewportZoomPercentage()

    this.map!.refreshZoom(zoomPercent)

    if (this.debugTools) {
      this.debugTools.draw();
    }
  }

  drawWaypoints () {
    this.map!.drawWaypoints()
  }

  reloadGame (game: Game, userSettings: UserGameSettings) {
    this.game = game
    this.userSettings = userSettings

    if (userSettings?.technical?.performanceMonitor === 'enabled' && !this.debugTools) {
      this.debugTools = new DebugTools(this.app!, this.map!);
      this.debugTools.draw();
    } else if (this.debugTools) {
      this.debugTools.destroy();
      this.debugTools = undefined;
    }

    this.map!.reloadGame(game, userSettings)
  }

  reloadTerritories () {
    this.map!.drawTerritories(this.userSettings!)
  }

  reloadStar (star) {
    let starObject = this.map!.setupStar(this.game, this.userSettings, star)
    this.map!.drawStar(starObject)
    this.map!.addContainerToChunk(starObject, this.map!.chunks, this.map!.firstChunkX, this.map!.firstChunkY)
  }

  reloadCarrier (carrier) {
    let carrierObject = this.map!.setupCarrier(this.game, this.userSettings, carrier)
    this.map!.drawCarrier(carrierObject)
    this.map!.addContainerToChunk(carrierObject, this.map!.chunks, this.map!.firstChunkX, this.map!.firstChunkY)
  }

  undrawCarrier (carrier) {
    this.map!.undrawCarrier(carrier)
  }

  getViewportZoomPercentage () {
    let viewportWidth = this.viewport!.right - this.viewport!.left
    return (this.viewport!.screenWidth / viewportWidth) * 100
  }

  onTick (ticker) {
    if (this.map) {
      this.map.onTick(ticker.deltaTime)
    }
  }

  onViewportZoomed (e) {
    const zoomPercent = this.getViewportZoomPercentage()

    this.map!.refreshZoom(zoomPercent)
  }

  setMode (mode, args) {
    this.map!.setMode(mode, args)
  }

  resetMode () {
    this.map!.resetMode()
  }

  resize () {
    if (!this.app) {
      return;
    }

    this.app.renderer.resize(
      window.innerWidth,
      window.innerHeight
    )

    this.viewport!.resize(
      window.innerWidth,
      window.innerHeight,
      Number.MAX_VALUE,
      Number.MAX_VALUE
    )
  }

}

export default new GameContainer()
