import { _decorator, Component, Node, Label, Color, BlockInputEvents } from 'cc';
import { ComicPanel } from '../core/Types';
import {
  applySpriteFit,
  bindClick,
  labelHeightFor,
  makeButton,
  makeLabel,
  makeNode,
  paint,
  paintStroke,
  Palette,
  setLabel,
  Type,
} from './UiKit';
import { AudioKit } from '../audio/AudioKit';
import { I18n } from '../core/I18n';

const { ccclass, property } = _decorator;
const PANEL_STROKE = new Color(210, 185, 160, 255);

const MOOD_ICONS: Record<number, string> = {
  1: '🍂 🌧️',
  2: '📜 🌿',
  3: '💼 🏢',
  4: '🕯️ ✨',
  5: '🔥 🪵',
};

@ccclass('ComicPanelModal')
export class ComicPanelModal extends Component {
  @property(Node)
  public modalRoot: Node | null = null;

  @property(Node)
  public imageNode: Node | null = null;

  @property(Label)
  public moodIconLabel: Label | null = null;

  @property(Label)
  public bubbleLabelCn: Label | null = null;

  @property(Label)
  public bubbleLabelEn: Label | null = null;

  @property(Label)
  public speakerLabel: Label | null = null;

  @property(Label)
  public sfxLabel: Label | null = null;

  @property(Label)
  public pageLabel: Label | null = null;

  @property(Label)
  public skipBtnLabel: Label | null = null;

  @property(Label)
  public hintLabel: Label | null = null;

  private _panels: ComicPanel[] = [];
  private _currentIndex: number = 0;
  private _onFinished: (() => void) | null = null;

  public static attach(parent: Node): ComicPanelModal {
    let node = parent.getChildByName('ComicPanelModalRoot');
    if (!node) {
      // 遮罩层 (全屏 720×1280)
      node = makeNode(parent, 'ComicPanelModalRoot', 720, 1280, 0, 0);
      paint(node, new Color(20, 16, 12, 225), 0);
      node.addComponent(BlockInputEvents);

      // 主卡片 (宽 640, 高 780)
      const card = makeNode(node, 'ComicCard', 640, 780, 0, 10);
      paintStroke(card, Palette.paper, PANEL_STROKE, 24, 1.5);

      // 顶部条：章节徽章 + 跳过按钮
      const headerBar = makeNode(card, 'ComicHeader', 580, 40, 0, 340);
      const pageLabel = makeLabel(headerBar, 'ComicPage', '📜 窗南旧忆 · 序章 (1/5)', 360, 30, -100, 0, Type.sub, Palette.woodDark);
      pageLabel.isBold = true;

      const skipBtn = makeButton(headerBar, 'ComicSkipBtn', '跳过 ›', 84, 32, 230, 0, Palette.cream);
      paintStroke(skipBtn.node, Palette.cream, PANEL_STROKE, 10, 1);
      skipBtn.label.color = Palette.inkSoft;
      setLabel(skipBtn.label, '跳过 ›', Type.badge);

      // 故事插画框 (宽 580, 高 340, 居中 y=125)
      const illusBox = makeNode(card, 'ComicIllusBox', 580, 340, 0, 125);
      paint(illusBox, Palette.cream, 16);

      // 插画节点
      const illustration = makeNode(illusBox, 'ComicIllustration', 560, 320, 0, 0);

      // 情绪氛围大图标（用于无位图时的氛围表达）
      const moodIcon = makeLabel(illusBox, 'ComicMoodIcon', '🍂 🌧️', 200, 70, 0, 20, 54, Palette.woodDark);

      // 音效标签 (挂在插画框底部)
      const sfx = makeLabel(illusBox, 'ComicSfx', '', 400, 30, 0, -125, Type.sub, Palette.wood);
      sfx.isBold = true;

      // 说话者药丸徽章
      const speakerBadge = makeNode(card, 'ComicSpeakerBadge', 140, 34, -200, -85);
      paint(speakerBadge, Palette.mint, 12);
      const speaker = makeLabel(speakerBadge, 'ComicSpeaker', '旁白', 120, 26, 0, 0, 15, Palette.ink);
      speaker.isBold = true;

      // 中文对白
      const bubbleCn = makeLabel(card, 'ComicBubbleCn', '', 560, labelHeightFor(24, 2), 0, -155, 23, Palette.ink);
      bubbleCn.isBold = true;
      bubbleCn.enableWrapText = true;

      // 英文对白
      const bubbleEn = makeLabel(card, 'ComicBubbleEn', '', 560, labelHeightFor(16, 2), 0, -225, 16, Palette.inkSoft);
      bubbleEn.enableWrapText = true;

      // 底部提示
      const hint = makeLabel(card, 'ComicHint', '点击任意处继续 ›', 240, 30, 0, -325, 15, Palette.wood);
      hint.isBold = true;

      const modal = node.addComponent(ComicPanelModal);
      modal.modalRoot = node;
      modal.imageNode = illustration;
      modal.moodIconLabel = moodIcon;
      modal.pageLabel = pageLabel;
      modal.skipBtnLabel = skipBtn.label;
      modal.hintLabel = hint;
      modal.bubbleLabelCn = bubbleCn;
      modal.bubbleLabelEn = bubbleEn;
      modal.speakerLabel = speaker;
      modal.sfxLabel = sfx;

      bindClick(skipBtn.node, () => modal.skipAll(), modal);
      card.on(Node.EventType.TOUCH_END, (e: any) => {
        e.propagationStopped = true;
        modal.next();
      });
      bindClick(node, () => modal.next(), modal);

      node.active = false;
      return modal;
    }
    return node.getComponent(ComicPanelModal)!;
  }

  public isShowing(): boolean {
    return !!(this.modalRoot && this.modalRoot.active);
  }

  public showPanels(panels: ComicPanel[], onFinished?: () => void): void {
    if (!panels || panels.length === 0) {
      if (onFinished) onFinished();
      return;
    }
    this._panels = [...panels];
    this._currentIndex = 0;
    this._onFinished = onFinished || null;
    if (this.modalRoot && this.modalRoot.parent) {
      this.modalRoot.setSiblingIndex(this.modalRoot.parent.children.length - 1);
      this.modalRoot.active = true;
    }
    this.renderCurrentPanel();
  }

  public next(): void {
    AudioKit.play('ui_tap');
    this._currentIndex++;
    if (this._currentIndex >= this._panels.length) {
      this.finish();
    } else {
      this.renderCurrentPanel();
    }
  }

  public skipAll(): void {
    AudioKit.play('ui_tap');
    this.finish();
  }

  private finish(): void {
    this.close();
    if (this._onFinished) {
      const cb = this._onFinished;
      this._onFinished = null;
      cb();
    }
  }

  public close(): void {
    if (this.modalRoot) this.modalRoot.active = false;
  }

  private renderCurrentPanel(): void {
    const p = this._panels[this._currentIndex];
    if (!p) return;

    if (this.pageLabel) {
      setLabel(
        this.pageLabel,
        I18n.t('prologue_title', { curr: this._currentIndex + 1, total: this._panels.length }),
        Type.sub,
      );
    }
    if (this.skipBtnLabel) {
      setLabel(this.skipBtnLabel, I18n.t('prologue_skip'), 13);
    }
    if (this.hintLabel) {
      setLabel(this.hintLabel, I18n.t('prologue_continue'), 15);
    }
    if (this.speakerLabel) {
      const spRaw = p.speaker || '旁白';
      const spKey = `prologue_speaker_${spRaw}`;
      const spText = I18n.t(spKey);
      setLabel(this.speakerLabel, spText !== spKey ? spText : spRaw, 15);
    }
    if (this.bubbleLabelCn) {
      setLabel(this.bubbleLabelCn, p.text_cn, 23);
    }
    if (this.bubbleLabelEn) {
      if (p.text_en) {
        this.bubbleLabelEn.node.active = true;
        setLabel(this.bubbleLabelEn, p.text_en, 16);
      } else {
        this.bubbleLabelEn.node.active = false;
      }
    }
    if (this.sfxLabel) {
      const sfx = p.sfx;
      if (sfx) {
        this.sfxLabel.node.active = true;
        setLabel(this.sfxLabel, `[ ${sfx} ]`, Type.sub);
      } else {
        this.sfxLabel.node.active = false;
      }
    }

    // 情绪氛围图标
    if (this.moodIconLabel) {
      const icon = MOOD_ICONS[p.panelIndex] || '🌿';
      setLabel(this.moodIconLabel, icon, 54);
    }

    if (this.imageNode) {
      if (p.image) {
        const cleanPath = p.image.replace(/^art\//i, '').replace(/\.png$/i, '');
        applySpriteFit(this.imageNode, cleanPath);
        this.imageNode.active = true;
        if (this.moodIconLabel) this.moodIconLabel.node.active = false;
      } else {
        this.imageNode.active = false;
        if (this.moodIconLabel) this.moodIconLabel.node.active = true;
      }
    }
  }
}
