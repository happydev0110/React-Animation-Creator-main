import BaseDemo from "./BaseDemo";
import { PixiFactory } from "../PixiFactory";
import { DragonBones } from "../../../dragonBones";

import { Texture } from 'pixi.js';
/**
 * How to use
 * 1. Load data.
 *
 * 2. Parse data.
 *    factory.parseDragonBonesData();
 *    factory.parseTextureAtlasData();
 *
 * 3. Build armature.
 *    armatureDisplay = factory.buildArmatureDisplay("armatureName");
 *
 * 4. Play animation.
 *    armatureDisplay.animation.play("animationName");
 *
 * 5. Add armature to stage.
 *    addChild(armatureDisplay);
 * 
 * 6. Add functions(Play, Build armature, Load data)
 *    addChild(armatureDisplay);
 */
export default class Character_2 extends BaseDemo {
    private skelJson;
    private texJson;
    private imagePng;

    public constructor(skelJson, texJson, imagePng, armatureName) {
        super(armatureName);
        this._resources.push(
            // "resource/characte_2/characte_2_ske.json",
            // "resource/characte_2/characte_2_tex.json",
            // "resource/characte_2/characte_2_tex.png"

            skelJson,
            texJson,
            imagePng
        );

        this.skelJson = skelJson;
        this.texJson = texJson;
        this.imagePng = imagePng;
        this.armatureName = armatureName;
    }

    protected _onStart(): void {
        DragonBones.debug = true;
        const factory = PixiFactory.factory;
        factory.parseDragonBonesData(this._pixiResources[this.skelJson]);
        factory.parseTextureAtlasData(
            this._pixiResources[this.texJson],
            this._pixiResources[this.imagePng]);

        console.log(this._pixiResources[this.skelJson], 'skeleton json');
        console.log(this._pixiResources[this.texJson], 'texture json');
        console.log(this._pixiResources[this.imagePng], 'texture png');
        // console.log(factory, 'characte_2 factory')

        const armatureDisplay = factory.buildArmatureDisplay(this.armatureName)!;
        // console.log(armatureDisplay, 'characte_2 armatureDisplay')
        // console.log(factory.getArmatureData('characte_2'), 'characte_2 ArmatureData')

        const armatureData = factory.getArmatureData(this.armatureName);
        // Get specific animation data
        const animationData = armatureData.animations[armatureData.animationNames[0]];
        // Duration in seconds
        const duration = animationData.duration;
        // console.log("Idle duration:", duration);

        const playbuttons = document.getElementById('dragonbones-mode');
        while (playbuttons?.firstChild) {
            playbuttons.removeChild(playbuttons.firstChild);
        }

        armatureData.animationNames.map((buttonName) => {
            const button = document.createElement('button');
            button.className = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2'
            button.innerText = buttonName;
            button.onclick = async () => {
                await armatureDisplay.animation.play(buttonName);
            };
            playbuttons.appendChild(button);
        })

        armatureDisplay.scale.set(0.5); // Initial scale at 50%
        armatureDisplay.x = -500;
        armatureDisplay.y = -100;

        armatureDisplay.animation.play(armatureData.animationNames[0]);
        // console.log(this.container, 'character_2 Container');

        this.container.addChild(armatureDisplay);
        // console.log(armatureDisplay);
    }
}