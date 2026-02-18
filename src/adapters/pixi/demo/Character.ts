import BaseDemo from "./BaseDemo";
import { PixiFactory } from "../PixiFactory";
import { DragonBones } from "../../../dragonBones";
import { Texture } from "pixi.js";

export default class Character extends BaseDemo {
  private skelJson: any;
  private texJson: any;
  private imagePng: Texture;

  private armatureDisplay: any | null = null;
  private armatureData: any | null = null;
  private currentAnimationName: string = "";

  public constructor(
    skelJson: any,
    texJson: any,
    imagePng: Texture,
    skelName: string,
    armatureName: string,
    setAnimationDuration: (t: number) => void,
    startTimeLine: () => void,
  ) {
    super(armatureName);

    this.skelJson = skelJson;
    this.texJson = texJson;
    this.imagePng = imagePng;
    this.skelName = skelName;
    this.armatureName = armatureName;
    this.setAnimationDuration = setAnimationDuration;
    this.startTimeLine = startTimeLine;
  }

  /** ✅ Drive DragonBones pose from external timeline time (seconds). */
  public setTimelineTime = (timeSec: number) => {
    if (!this.armatureDisplay || !this.armatureData || !this.currentAnimationName) return;

    const anim = this.armatureData.animations[this.currentAnimationName];
    const dur = anim?.duration ?? 0;
    if (dur <= 0) return;

    // ✅ Wrap time so it loops forever
    const t = ((timeSec % dur) + dur) % dur;

    // Timeline owns time; jump to exact time
    this.armatureDisplay.animation.gotoAndStopByTime(this.currentAnimationName, t);
  };

  /** Select animation, update duration, reset timeline to 0 and show first frame. */
  private selectAnimation = (name: string) => {
    if (!this.armatureDisplay || !this.armatureData) return;

    this.currentAnimationName = name;
    const dur = this.armatureData.animations[name]?.duration ?? 0;

    this.setAnimationDuration(dur);

    // show frame 0 immediately
    this.armatureDisplay.animation.gotoAndStopByTime(name, 0);

    // reset timeline playhead to 0 and start playing (your existing behavior)
    this.startTimeLine();
  };

  protected _onStart(): void {
    DragonBones.debug = true;

    const factory = PixiFactory.factory;
    factory.parseDragonBonesData(this.skelJson);
    factory.parseTextureAtlasData(this.texJson, this.imagePng);

    const armatureDisplay = factory.buildArmatureDisplay(this.armatureName, this.skelName)!;
    this.armatureDisplay = armatureDisplay;

    const armatureData = factory.getArmatureData(this.armatureName);
    this.armatureData = armatureData;

    // Remove past buttons
    const playbuttons = document.getElementById("dragonbones-mode");
    while (playbuttons?.firstChild) playbuttons.removeChild(playbuttons.firstChild);

    // Create animation buttons
    armatureData.animationNames.forEach((buttonName: string) => {
      const button = document.createElement("button");
      button.className =
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2";
      button.innerText = buttonName;

      button.onclick = () => {
        // DO NOT play() here; timeline will control time
        this.selectAnimation(buttonName);
      };

      playbuttons?.appendChild(button);
    });

    // positioning
    armatureDisplay.scale.set(0.5);
    armatureDisplay.x = -500;
    armatureDisplay.y = -100;

    // choose default animation
    const defaultAnim = armatureData.animationNames[0];
    this.selectAnimation(defaultAnim);

    this.container.addChild(armatureDisplay);
  }
}
