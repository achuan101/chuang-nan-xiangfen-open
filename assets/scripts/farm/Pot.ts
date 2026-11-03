import { _decorator, Color, Component, Label, Button, Node, Tween, UIOpacity, tween } from 'cc';
import { GameModel } from '../core/GameModel';
import { ConfigManager } from '../core/ConfigManager';
import { I18n } from '../core/I18n';
import { AudioKit } from '../audio/AudioKit';
import { adEntryVisible, RewardedAd } from '../ads/RewardedAd';
import { PotState } from '../core/Types';
import {
  applySprite,
  applySpriteFit,
  bindClick,
  formatMmSs,
  labelHeightFor,
  makeButton,
  makeLabel,
  makeNode,
  paint,
  paintStroke,
  Palette,
  setLabel,
  Type,
} from '../ui/UiKit';
import { floatUp, shakeX, squash } from '../ui/Motion';

const { ccclass, property } = _decorator;
const PANEL_STROKE = new Color(225, 210, 195, 255);

/** 进度落在 [from, to] 区间内的归一化量，区间外钳 0/1 */
function ramp01(v: number, from: number, to: number): number {
  if (to <= from) return v >= to ? 1 : 0;
  return Math.max(0, Math.min(1, (v - from) / (to - from)));
}

@ccclass('Pot')
export class Pot extends Component {
  @property
  public potIndex: number = 0;

  @property(Label)
  public statusLabel: Label | null = null;

  @property(Button)
  public harvestBtn: Button | null = null;

  @property(Button)
  public speedupBtn: Button | null = null;

  @property(Button)
  public switchBtn: Button | null = null;

  @property(Button)
  public adSpeedupBtn: Button | null = null;

  private _timer: number = 0;
  private _opSoil: number = -1;
  private _opSprout: number = -1;
  private _opReady: number = -1;
  private _swayed: boolean = false;

  public static create(parent: Node, index: number, x: number, y: number): Pot {
    const node = makeNode(parent, `Pot${index + 1}`, 210, 430, x, y);
    paintStroke(node, new Color(255, 251, 245, 245), PANEL_STROKE, 24, 1.5);

    // 顶部标题与换种按钮
    const potTitle = `${index + 1}号盆`;
    makeLabel(node, 'Title', potTitle, 90, labelHeightFor(Type.card), -45, 175, Type.card, new Color(74, 53, 37, 255));
    const switchSeed = makeButton(node, 'BtnSwitchSeed', '↻ ' + I18n.t('action_switch_seed'), 68, 26, 48, 175, Palette.paper);
    paintStroke(switchSeed.node, Palette.paper, PANEL_STROKE, 8, 1);
    switchSeed.label.color = Palette.wood;
    setLabel(switchSeed.label, '↻ ' + I18n.t('action_switch_seed'), 12);

    // 生长态：空土 / 幼苗 / 成熟（单态独立呈现，互斥激活与透明度联动，彻底根除叠影错位）
    const plantIcon = makeNode(node, 'PlantIcon', 116, 160, 0, 60);
    ([
      ['GrowSoil', 'ui/plant_empty', 255, true],
      ['GrowSprout', 'ui/plant_sprout', 0, false],
      ['GrowReady', 'ui/plant_ready', 0, false],
    ] as Array<[string, string, number, boolean]>).forEach(([layerName, artPath, opacity, active]) => {
      const layer = makeNode(plantIcon, layerName, 116, 160, 0, 0);
      const op = layer.getComponent(UIOpacity) || layer.addComponent(UIOpacity);
      op.opacity = opacity;
      layer.active = active;
      applySpriteFit(layer, artPath, sp => {
        sp.color = Color.WHITE;
      });
    });

    // 植物名称与状态
    const nameLabel = makeLabel(node, 'PlantName', '', 188, labelHeightFor(18), 0, -45, 18, new Color(74, 53, 37, 255));
    nameLabel.isBold = true;

    const status = makeLabel(node, 'Status', '', 188, labelHeightFor(15), 0, -75, 15, Palette.inkSoft);

    // 可采摘 / 生长中按钮
    const harvest = makeButton(node, 'BtnHarvest', I18n.t('action_pick'), 180, 48, 0, -140, new Color(185, 132, 83, 255));
    paintStroke(harvest.node, new Color(185, 132, 83, 255), Palette.gold, 16, 1.5);
    harvest.label.color = Palette.paper;
    harvest.label.isBold = true;
    setLabel(harvest.label, I18n.t('action_pick'), 15);

    const speed = makeButton(node, 'BtnSpeedup', I18n.t('action_speedup_card'), 180, 48, 0, -140, new Color(140, 107, 78, 255));
    paintStroke(speed.node, new Color(140, 107, 78, 255), PANEL_STROKE, 16, 1.2);
    speed.label.color = Palette.paper;
    setLabel(speed.label, I18n.t('action_speedup_card'), 14);

    // 广告位 3「花盆立刻成熟」
    const adSpeed = adEntryVisible()
      ? makeButton(node, 'BtnAdSpeedup', I18n.t('action_speedup'), 180, 36, 0, -185, Palette.paper)
      : null;
    if (adSpeed) {
      paintStroke(adSpeed.node, Palette.paper, PANEL_STROKE, 14, 1);
      adSpeed.label.color = Palette.wood;
      setLabel(adSpeed.label, I18n.t('action_speedup'), 12);
    }

    let pot = node.getComponent(Pot);
    if (!pot) {
      pot = node.addComponent(Pot);
    }
    pot.potIndex = index;
    pot.statusLabel = status;
    pot.harvestBtn = harvest.button;
    pot.speedupBtn = speed.button;
    pot.switchBtn = switchSeed.button;
    pot.adSpeedupBtn = adSpeed ? adSpeed.button : null;

    bindClick(harvest.node, () => pot!.onHarvestClick(), pot);
    bindClick(speed.node, () => pot!.onSpeedupClick(), pot);
    bindClick(switchSeed.node, () => pot!.onSwitchSeedClick(), pot);
    if (adSpeed) bindClick(adSpeed.node, () => pot!.onAdSpeedupClick(), pot);

    return pot;
  }

  start() {
    if (!this.switchBtn) {
      const switchNode = this.node.getChildByName('BtnSwitchSeed');
      if (switchNode) this.switchBtn = switchNode.getComponent(Button);
    }
    if (this.switchBtn) bindClick(this.switchBtn.node, () => this.onSwitchSeedClick(), this);
    this.refreshView();
  }

  update(dt: number) {
    this._timer += dt;
    if (this._timer >= 1.0) {
      this._timer = 0;
      this.refreshView();
    }
  }

  public getPotData(): PotState | null {
    const pots = GameModel.instance.pots;
    return pots.find(p => p.id === this.potIndex + 1) || null;
  }

  public getRemainingSeconds(): number {
    const data = this.getPotData();
    if (!data) return 0;
    const now = Date.now();
    if (now < data.plantTime) {
      data.plantTime = now;
    }
    const elapsed = Math.floor((now - data.plantTime) / 1000);
    return Math.max(0, data.growDuration - elapsed);
  }

  public isReady(): boolean {
    return this.getRemainingSeconds() <= 0;
  }

  public refreshView(): void {
    const data = this.getPotData();
    if (!data) {
      if (this.statusLabel) setLabel(this.statusLabel, '未解锁');
      if (this.harvestBtn) {
        this.harvestBtn.interactable = false;
        this.harvestBtn.node.active = false;
      }
      if (this.speedupBtn) this.speedupBtn.node.active = false;
      if (this.adSpeedupBtn) this.adSpeedupBtn.node.active = false;
      const icon = this.node.getChildByName('PlantIcon');
      if (icon) icon.active = false;
      return;
    }
    const plantIcon = this.node.getChildByName('PlantIcon');
    if (plantIcon) plantIcon.active = true;

    const noteName = I18n.tNote(data.plantNoteId);
    const remain = this.getRemainingSeconds();

    const nameLab = this.node.getChildByName('PlantName')?.getComponent(Label);
    if (nameLab) {
      setLabel(nameLab, noteName, 18);
    }

    const tutorialLock = !GameModel.instance.tutorialCompleted && this.potIndex > 0;
    if (remain <= 0) {
      if (this.statusLabel) {
        setLabel(this.statusLabel, '可采摘', 16);
        this.statusLabel.color = new Color(33, 140, 50, 255);
        this.statusLabel.isBold = true;
      }
      if (this.harvestBtn) {
        this.harvestBtn.node.active = true;
        this.harvestBtn.interactable = !tutorialLock;
      }
      if (this.speedupBtn) this.speedupBtn.node.active = false;
      if (this.adSpeedupBtn) this.adSpeedupBtn.node.active = false;
    } else {
      const timeStr = formatMmSs(remain);
      const speedups = GameModel.instance.speedups;
      const waitTip = speedups > 0 ? `${timeStr} · 可加速` : `${timeStr}`;
      if (this.statusLabel) {
        setLabel(this.statusLabel, waitTip, 15);
        this.statusLabel.color = new Color(140, 109, 82, 255);
        this.statusLabel.isBold = false;
      }
      if (this.harvestBtn) this.harvestBtn.node.active = false;
      if (this.speedupBtn) {
        this.speedupBtn.node.active = !tutorialLock;
        const lab = this.speedupBtn.node.getChildByName('Label');
        const label = lab ? lab.getComponent(Label) : null;
        if (label) {
          const speedCardText = speedups > 0 ? `加速卡 ×${speedups}` : '等待自然成熟';
          setLabel(label, speedCardText, Type.badge);
        }
        this.speedupBtn.interactable = speedups > 0 && !tutorialLock;
      }
      if (this.adSpeedupBtn) this.adSpeedupBtn.node.active = !tutorialLock;
    }

    if (this.switchBtn) {
      this.switchBtn.node.active = GameModel.instance.tutorialCompleted;
    }
    this.refreshPlantIcon(data, remain);
  }

  private refreshPlantIcon(data: PotState, remain: number): void {
    const host = this.node.getChildByName('PlantIcon');
    if (!host) return;
    const p = data.growDuration > 0 ? Math.max(0, Math.min(1, 1 - remain / data.growDuration)) : 1;

    // 三态互斥呈现：成熟态仅激活 GrowReady；生长中期激活 GrowSprout；初期激活 GrowSoil
    let targetSoil = 0;
    let targetSprout = 0;
    let targetReady = 0;

    if (remain <= 0 || p >= 1) {
      targetReady = 255;
    } else if (p >= 0.35) {
      targetSprout = 255;
    } else {
      targetSoil = 255;
    }

    this.fadeLayer(host.getChildByName('GrowSoil'), targetSoil, '_opSoil');
    this.fadeLayer(host.getChildByName('GrowSprout'), targetSprout, '_opSprout');
    this.fadeLayer(host.getChildByName('GrowReady'), targetReady, '_opReady');
    this.startSway(host);
  }

  private fadeLayer(node: Node | null, target: number, slot: '_opSoil' | '_opSprout' | '_opReady'): void {
    if (!node) return;
    this[slot] = target;
    const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
    op.opacity = target;
    node.active = target > 0;
  }

  private startSway(host: Node): void {
    if (this._swayed) return;
    this._swayed = true;
    tween(host)
      .repeatForever(
        tween(host)
          .to(2.6, { angle: 2.4 }, { easing: 'sineInOut' })
          .to(2.6, { angle: -2.4 }, { easing: 'sineInOut' }),
      )
      .start();
  }

  public onHarvestClick(): void {
    if (!GameModel.instance.tutorialCompleted && this.potIndex > 0) return;
    const data = this.getPotData();
    if (!data || !this.isReady()) return;

    const model = GameModel.instance;
    const eco = ConfigManager.economy;

    if (!model.consumeActionPoints(eco.gatherCost)) {
      if (this.statusLabel) setLabel(this.statusLabel, '行动点不足');
      shakeX(this.node);
      return;
    }

    const note = ConfigManager.getNote(data.plantNoteId);
    const noteName = note ? note.name : data.plantNoteId;
    model.addNote(data.plantNoteId, 1);
    AudioKit.play('harvest');
    const harvestedNote = data.plantNoteId;
    data.plantNoteId = model.getNextRotatedNote(data.id, harvestedNote);
    data.plantTime = Date.now();
    model.save();
    model.emit('pot_changed');
    this.refreshView();
    squash(this.node.getChildByName('PlantIcon') ?? this.node);
    floatUp(this.node, `+1 ${noteName}`, 0, 60, Palette.mint);

    if (this.potIndex === 0) {
      model.advanceTutorial('go_bench');
    }
    console.log(`[Pot] 采摘成功，获得 ${harvestedNote}，已轮换为 ${data.plantNoteId}`);
  }

  public onSwitchSeedClick(): void {
    if (!GameModel.instance.tutorialCompleted) return;
    const data = this.getPotData();
    if (!data) return;
    const model = GameModel.instance;
    const nextNote = model.getNextRotatedNote(data.id, data.plantNoteId);
    if (nextNote === data.plantNoteId) return;
    data.plantNoteId = nextNote;
    data.plantTime = Date.now();
    model.save();
    model.emit('pot_changed');
    this.refreshView();
    AudioKit.play('ui_tap');
    const noteConf = ConfigManager.getNote(nextNote);
    floatUp(this.node, `换种：${noteConf ? noteConf.name : nextNote}`, 0, 60, Palette.mint);
    console.log(`[Pot] ${data.id} 号盆换种为 ${data.plantNoteId}`);
  }

  public onSpeedupClick(): void {
    if (!GameModel.instance.tutorialCompleted && this.potIndex > 0) return;
    const data = this.getPotData();
    if (!data || this.isReady()) return;

    if (!GameModel.instance.consumeSpeedup()) {
      if (this.statusLabel) {
        setLabel(
          this.statusLabel,
          this.adSpeedupBtn ? '加速卡用完，可看短片加速' : '加速卡用完，等它自然成熟',
        );
      }
      return;
    }
    this.finishGrowing(data);
  }

  public onAdSpeedupClick(): void {
    if (!GameModel.instance.tutorialCompleted && this.potIndex > 0) return;
    const data = this.getPotData();
    if (!data || this.isReady()) return;

    RewardedAd.show(
      () => {
        this.finishGrowing(data);
        AudioKit.play('cure_ready');
      },
      () => {
        if (this.statusLabel) setLabel(this.statusLabel, '短片没看完，再等等');
      },
    );
  }

  private finishGrowing(data: PotState): void {
    data.plantTime = Date.now() - data.growDuration * 1000 - 1000;
    GameModel.instance.save();
    GameModel.instance.emit('pot_changed');
    this.refreshView();
    squash(this.node.getChildByName('PlantIcon') ?? this.node);
  }
}
