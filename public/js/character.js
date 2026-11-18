import { fitCharacter, rotationClipsForRig } from './model-utils.js';
import { OPERATORS } from './operators.js';
// character.js - Multi-Character 3D Engine: Soldier, Robot, Cyborg & Heavy Titan Mech
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { disposeTrees, sharedModelResources } from './resources.js';
import { MovementBuffer } from './movement-buffer.js';

const gltfCache = {};
const modelPromises = new Map();
const zombieSkins = ['zombieMaleA.png', 'zombieFemaleA.png'];
const modelPaths = {zombie:'KenneyZombie.glb',animations:'AnimationRig.glb',soldier:'Soldier.glb',robot:'RobotExpressive.glb',cyborg:'Xbot.glb',heavy:'TitanMech.glb',scout:'Pathfinder.glb',sentinel:'Sentinel.glb',ranger:'DesertRanger.glb'};
export function preloadCharacterModel(type) {
  if (!type) return Promise.all(['soldier','robot','cyborg'].map(preloadCharacterModel));
  if (!modelPaths[type]) return Promise.resolve(null);
  if (type === 'zombie' && !modelPromises.has(type)) {
    const models = '/assets/models/';
    const loader = new THREE.TextureLoader();
    modelPromises.set(type, Promise.all([
      new GLTFLoader().loadAsync(models + modelPaths.zombie),
      ...zombieSkins.map(skin => loader.loadAsync(models + skin))
    ]).then(([gltf, ...skins]) => {
      for (const texture of skins) texture.colorSpace = THREE.SRGBColorSpace;
      gltf.zombieSkins = skins;
      return gltfCache.zombie = gltf;
    }).catch(error => {
      console.warn('[CharacterLoader] Zombie model unavailable:', error.message);
      return null;
    }));
  }
  if (!modelPromises.has(type)) modelPromises.set(type,new Promise(resolve=>{
    new GLTFLoader().load('/assets/models/'+modelPaths[type],gltf=>{gltfCache[type]=gltf;resolve(gltf);},undefined,error=>{
      console.warn('[CharacterLoader] Model unavailable:',type,error.message);resolve(null);
    });
  }));
  return modelPromises.get(type);
}

export class RemotePlayer {
  constructor(scene, playerData) {
    this.scene = scene;
    this.id = playerData.id;
    this.name = playerData.name || 'Soldier';
    this.color = playerData.color || '#3b82f6';
    this.activeSlot = playerData.combat?.slot || playerData.loadout?.[0] || 1;
    this.characterType = playerData.characterType || 'soldier'; // 'soldier' | 'robot' | 'cyborg' | 'heavy'
    this.team = playerData.team || null; // 'blue' | 'red' | null
    this.isTeammate = !!playerData.isTeammate;
    this.health = playerData.health ?? 100;
    this.isAlive = playerData.isAlive ?? true;

    this.group = new THREE.Group();
    this.hitboxes = [];
    this.isUsingGltf = false;
    this.teamRing = null;

    // Procedural animation state
    this.walkAnimTime = 0;
    this.isMoving = false;
    this.isRunning = false;
    this.movementBuffer = new MovementBuffer();
    this.bufferedTransform = {};

    // Overhead UI
    this.overheadCanvas = null;
    this.overheadTexture = null;
    this.overheadSprite = null;

    this.ready = this.initModel();
    this.buildTeamRing();
    if (this.characterType !== 'zombie') this.buildOverheadUI();

    this.group.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
    this.scene.add(this.group);
  }

  async initModel() {
    await preloadCharacterModel(this.characterType);
    if (['scout','sentinel','ranger'].includes(this.characterType)) await preloadCharacterModel('animations');
    if (this.destroyed) return;

    if (gltfCache[this.characterType]) {
      try {
        this.setupGltfModel(gltfCache[this.characterType]);
        return;
      } catch (err) {
        console.warn(`[Character] Error setting up GLTF for ${this.characterType}, using procedural:`, err);
      }
    }

    // High detail procedural fallback based on character type
    this.buildProceduralModel();
  }

  setupGltfModel(gltf) {
    this.borrowedResources = sharedModelResources(gltf.scene);
    const clonedModel = SkeletonUtils.clone(gltf.scene);

    if (['scout','sentinel','ranger','heavy','zombie'].includes(this.characterType)) {
      fitCharacter(clonedModel);
    } else if (this.characterType === 'robot') {
      clonedModel.scale.set(0.38, 0.38, 0.38);
      clonedModel.position.set(0, -1.6, 0);
      clonedModel.rotation.y = Math.PI;
    } else if (this.characterType === 'cyborg') {
      clonedModel.scale.set(0.01, 0.01, 0.01);
      clonedModel.position.set(0, -1.6, 0);
      clonedModel.rotation.y = Math.PI;
    } else {
      // Soldier
      clonedModel.scale.set(1.0, 1.0, 1.0);
      clonedModel.position.set(0, -1.6, 0);
      clonedModel.rotation.y = Math.PI;
    }

    // Normalize every imported model, including Xbot (which is already in meter units).
    fitCharacter(clonedModel);

    const zombieIndex = Number(this.id.split('-').at(-1)) || 0;
    const zombieSkin = gltf.zombieSkins?.[zombieIndex % zombieSkins.length];
    if (zombieSkin) this.borrowedResources.add(zombieSkin);

    // Apply team color accent and shadow flags
    const teamColor = new THREE.Color(this.color);
    clonedModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData = { playerId: this.id, isHead: false };
        this.hitboxes.push(child);

        // Highlight with player team color
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material = child.material.map(m => m.clone());
          } else {
            child.material = child.material.clone();
            if (zombieSkin) child.material.map = zombieSkin;
          }
        }
      }
    });

    this.mixer = new THREE.AnimationMixer(clonedModel);
    this.animations = {};
    let clips = gltf.animations || [];
    if (!clips.length && gltfCache.animations) {
      // Shared Quaternius rig names; copy rotations only to retain each model's proportions.
      clips = rotationClipsForRig(gltfCache.animations.animations,clonedModel);
      gltf.animations = clips;
    }
    if (clips.length) {
      clips.forEach((clip) => {
        const action=this.mixer.clipAction(clip);
        this.animations[clip.name] = action;
        const name=clip.name.split('|').at(-1);
        if (/^Run(ning)?$/i.test(name)) {
          this.animations.Run = action;
          if (zombieSkin) {
            this.animations.Walk = action;
            action.timeScale = .8;
          }
        }
        if (/^Walk(ing)?$/i.test(name)) this.animations.Walk=action;
        if (/^Idle$/i.test(name)) this.animations.Idle=action;
        if (name==='Idle_Gun_Pointing' || name==='Idle_Neutral') this.animations.Idle=action;
      });
    }

    // Pick suitable default animation
    const idleClip = this.animations['Idle'] || this.animations['idle'] || Object.values(this.animations)[0];
    if (idleClip) {
      this.currentAction = idleClip;
      this.currentAction.play();
    }

    this.gltfRoot = clonedModel;
    this.group.add(clonedModel);
    this.isUsingGltf = true;
    clonedModel.updateMatrixWorld(true);
    const modelBox = new THREE.Box3().setFromObject(clonedModel);
    this.setupHitboxVolumes({
      minY: Number.isFinite(modelBox.min.y) ? modelBox.min.y : -1.6,
      maxY: Number.isFinite(modelBox.max.y) ? modelBox.max.y : 0.2,
      headRadius: 0.25
    });
  }

  buildProceduralModel() {
    const armorColor = new THREE.Color(OPERATORS[this.characterType]?.color || this.color);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.4,
      metalness: 0.6
    });

    const armorMat = new THREE.MeshStandardMaterial({
      color: armorColor,
      roughness: 0.3,
      metalness: 0.5
    });

    const visorMat = new THREE.MeshBasicMaterial({
      color: this.characterType === 'cyborg' ? 0xff2244 : 0x00f0ff
    });

    const gunMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.3,
      metalness: 0.8
    });

    if (this.characterType === 'zombie') {
      bodyMat.color.setHex(0x625247);
      armorMat.roughness = 1;
      armorMat.metalness = 0;
      visorMat.color.setHex(0xe2a04e);
    }
    const isHeavy = this.characterType === 'heavy';
    const isRobot = this.characterType === 'robot';

    // 1. Torso
    const torsoW = isHeavy ? 0.8 : 0.55;
    const torsoH = isHeavy ? 0.75 : 0.65;
    const torsoD = isHeavy ? 0.45 : 0.32;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW, torsoH, torsoD), bodyMat);
    torso.position.set(0, 0, 0);
    torso.castShadow = true;
    this.group.add(torso);

    // Armor chestplate
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 1.05, torsoH * 0.7, torsoD * 1.1), armorMat);
    chestPlate.position.set(0, 0.05, 0.02);
    torso.add(chestPlate);

    // Glowing core reactor
    const core = new THREE.Mesh(new THREE.CylinderGeometry(isHeavy ? 0.12 : 0.08, isHeavy ? 0.12 : 0.08, 0.08, 16), visorMat);
    core.rotation.x = Math.PI / 2;
    core.position.set(0, 0.05, torsoD / 2 + 0.02);
    torso.add(core);

    // 2. Heavy Shoulder Pauldrons (for Heavy Titan Mech)
    if (isHeavy) {
      const pauldronMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3, metalness: 0.7 });
      const leftPauldron = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.45), pauldronMat);
      leftPauldron.position.set(-0.55, 0.3, 0);
      leftPauldron.rotation.z = -0.2;
      this.group.add(leftPauldron);

      const rightPauldron = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.45), pauldronMat);
      rightPauldron.position.set(0.55, 0.3, 0);
      rightPauldron.rotation.z = 0.2;
      this.group.add(rightPauldron);
    }

    // 3. Head & Helmet / Visor
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, isHeavy ? 0.6 : 0.55, 0);

    const headGeo = isRobot
      ? new THREE.CylinderGeometry(0.18, 0.18, 0.32, 12)
      : new THREE.BoxGeometry(isHeavy ? 0.42 : 0.36, 0.38, 0.4);
    const helmet = new THREE.Mesh(headGeo, armorMat);
    helmet.castShadow = true;
    this.headGroup.add(helmet);

    // Visor / Cyber eyes
    if (isRobot) {
      const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), visorMat);
      eye1.position.set(-0.07, 0.05, 0.18);
      const eye2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), visorMat);
      eye2.position.set(0.07, 0.05, 0.18);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 6), gunMat);
      antenna.position.set(0.14, 0.25, 0);
      this.headGroup.add(eye1, eye2, antenna);
    } else {
      const visor = new THREE.Mesh(new THREE.BoxGeometry(isHeavy ? 0.36 : 0.32, 0.12, 0.06), visorMat);
      visor.position.set(0, 0.02, 0.2);
      this.headGroup.add(visor);
    }

    this.group.add(this.headGroup);

    // 4. Legs
    const legW = isHeavy ? 0.24 : 0.18;
    const legH = isHeavy ? 0.8 : 0.75;
    const legSpread = isHeavy ? 0.24 : 0.18;

    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-legSpread, -0.35, 0);
    const lLegMesh = new THREE.Mesh(new THREE.BoxGeometry(legW, legH, 0.22), bodyMat);
    lLegMesh.position.set(0, -legH / 2, 0);
    lLegMesh.castShadow = true;
    this.leftLeg.add(lLegMesh);
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(legSpread, -0.35, 0);
    const rLegMesh = new THREE.Mesh(new THREE.BoxGeometry(legW, legH, 0.22), bodyMat);
    rLegMesh.position.set(0, -legH / 2, 0);
    rLegMesh.castShadow = true;
    this.rightLeg.add(rLegMesh);
    this.group.add(this.rightLeg);

    // 5. Arms & Carbine
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(isHeavy ? -0.48 : -0.35, 0.25, 0);
    const lArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 0.16), armorMat);
    lArmMesh.position.set(0, -0.25, 0);
    lArmMesh.castShadow = true;
    this.leftArm.add(lArmMesh);
    this.group.add(this.leftArm);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(isHeavy ? 0.48 : 0.35, 0.25, 0);
    const rArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 0.16), armorMat);
    rArmMesh.position.set(0, -0.25, 0);
    rArmMesh.castShadow = true;
    this.rightArm.add(rArmMesh);
    this.group.add(this.rightArm);

    // Rifle
    if (this.characterType !== 'zombie') {
      const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.8), gunMat);
      rifle.position.set(0.15, -0.05, 0.45);
      rifle.castShadow = true;
      this.group.add(rifle);
      this.proceduralWeapon = rifle;
    }

    if (['scout','sentinel','ranger'].includes(this.characterType)) {
      const accent=new THREE.MeshStandardMaterial({color:OPERATORS[this.characterType].color,roughness:.6});
      const detail=new THREE.Mesh(new THREE.BoxGeometry(this.characterType==='sentinel'?.95:.65,.12,.42),accent);
      detail.position.set(0,.24,0);this.group.add(detail);
      if(this.characterType==='scout') {const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.45,5),accent);antenna.position.set(.22,.7,0);this.group.add(antenna);}
      if(this.characterType==='ranger') {const hood=new THREE.Mesh(new THREE.BoxGeometry(.46,.25,.43),accent);hood.position.set(0,.56,0);this.group.add(hood);}
    }
    this.setupHitboxVolumes();
    this.setWeaponSlot(this.activeSlot || 1);
  }

  setWeaponSlot(slot) {
    this.activeSlot = slot;
    if (this.proceduralWeapon) {
      if (slot === 4) {
        // Knife
        this.proceduralWeapon.scale.set(0.3, 0.4, 0.35);
        this.proceduralWeapon.position.set(0.2, -0.1, 0.25);
      } else if (slot === 3) {
        // Sniper
        this.proceduralWeapon.scale.set(0.9, 0.9, 1.4);
        this.proceduralWeapon.position.set(0.15, -0.05, 0.55);
      } else if (slot === 2) {
        // DMR Pistol
        this.proceduralWeapon.scale.set(0.7, 0.7, 0.65);
        this.proceduralWeapon.position.set(0.15, -0.05, 0.35);
      } else if ([5,6,7,8].includes(slot)) {
        const sizes={5:[.75,.8,.65],6:[.9,1,1.25],7:[.5,.65,.4],8:[1.25,1.2,1.3]};
        this.proceduralWeapon.scale.set(...sizes[slot]);
      } else {
        // AR
        this.proceduralWeapon.scale.set(1.0, 1.0, 1.0);
        this.proceduralWeapon.position.set(0.15, -0.05, 0.45);
      }
    }
  }

  setupHitboxVolumes(bounds = null) {
    this.hitboxes = [];

    const feetY = -1.6;
    const topY = 0.2175;
    const headRadius = 0.25;

    // Position head sphere directly over the character's actual skull/face with zero body overlap
    const headCenterY = topY - headRadius * 0.75;
    const bodyTopY = headCenterY - headRadius * 0.85;
    const bodyHeight = Math.max(0.6, bodyTopY - feetY);
    const bodyCenterY = feetY + bodyHeight * 0.5;

    // Body hitbox (cylinder stopping cleanly below the neck)
    const bodyBox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, bodyHeight, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    bodyBox.position.set(0, bodyCenterY, 0);
    bodyBox.userData = { playerId: this.id, isHead: false };
    this.group.add(bodyBox);
    this.hitboxes.push(bodyBox);

    // Head hitbox (precision sphere aligned to visible head)
    const headBox = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius, 10, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    headBox.position.set(0, headCenterY, 0);
    headBox.userData = { playerId: this.id, isHead: true };
    this.group.add(headBox);
    this.hitboxes.push(headBox);

    if (this.overheadSprite) {
      this.overheadSprite.position.y = topY + 0.35;
    }
    if (this.teamRing) {
      this.teamRing.position.y = feetY + 0.03;
    }
  }

  buildTeamRing() {
    if (!this.team) return;
    const teamHex = this.team === 'red' ? 0xef4444 : 0x3b82f6;
    const ringGeo = new THREE.RingGeometry(0.45, 0.58, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: teamHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: this.isTeammate ? 0.85 : 0.65
    });
    this.teamRing = new THREE.Mesh(ringGeo, ringMat);
    this.teamRing.rotation.x = -Math.PI / 2;
    this.teamRing.position.y = -0.84;
    this.group.add(this.teamRing);
  }

  buildOverheadUI() {
    this.overheadCanvas = document.createElement('canvas');
    this.overheadCanvas.width = 256;
    this.overheadCanvas.height = 64;
    this.overheadCtx = this.overheadCanvas.getContext('2d');

    this.overheadTexture = new THREE.CanvasTexture(this.overheadCanvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: this.overheadTexture,
      transparent: true,
      depthTest: true,
      depthWrite: false
    });

    this.overheadSprite = new THREE.Sprite(spriteMat);
    this.overheadSprite.scale.set(1.8, 0.45, 1);
    this.overheadSprite.position.set(0, 1.25, 0);
    this.group.add(this.overheadSprite);

    this.updateOverheadUI();
  }

  updateOverheadUI() {
    if (!this.overheadCtx) return;
    const ctx = this.overheadCtx;
    const w = this.overheadCanvas.width;
    const h = this.overheadCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background pill with optional team border
    ctx.fillStyle = 'rgba(10, 14, 22, 0.78)';
    ctx.beginPath();
    ctx.roundRect(8, 4, w - 16, this.isTeammate ? h - 8 : 30, 8);
    ctx.fill();

    if (this.team) {
      ctx.strokeStyle = this.team === 'red' ? '#ef4444' : '#3b82f6';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Nickname & team badge
    let displayName = this.name;
    let nameColor = '#ffffff';
    if (this.team === 'blue') {
      nameColor = '#93c5fd';
      displayName = this.isTeammate ? `[ALLY] ${this.name}` : `[BLUE] ${this.name}`;
    } else if (this.team === 'red') {
      nameColor = '#fca5a5';
      displayName = this.isTeammate ? `[ALLY] ${this.name}` : `[RED] ${this.name}`;
    }

    ctx.fillStyle = nameColor;
    ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(displayName, w / 2, 25);

    // Opponents (including every other player in FFA) reveal no health bar.
    if (!this.isTeammate) {
      this.overheadTexture.needsUpdate = true;
      return;
    }

    // Health Bar
    const barW = w - 40;
    const barH = 10;
    const barX = 20;
    const barY = 36;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX, barY, barW, barH);

    const healthPercent = Math.max(0, Math.min(100, this.health)) / 100;
    let fillCol = '#10b981';
    if (healthPercent < 0.3) fillCol = '#ef4444';
    else if (healthPercent < 0.6) fillCol = '#f59e0b';

    ctx.fillStyle = fillCol;
    ctx.fillRect(barX, barY, barW * healthPercent, barH);

    this.overheadTexture.needsUpdate = true;
  }

  setHealth(hp) {
    this.health = hp;
    this.updateOverheadUI();
    if (this.health <= 0) {
      this.isAlive = false;
      this.group.visible = false;
    } else {
      this.isAlive = true;
      this.group.visible = true;
    }
  }

  setTransform(pos, rot, isMoving, isRunning, isCrouching = false) {
    if (!this.targetPos) this.targetPos = new THREE.Vector3();
    this.targetPos.copy(pos);
    this.targetRot = rot;
    this.isMoving = isMoving;
    this.isRunning = isRunning;
    this.isCrouching = isCrouching;
    this.movementBuffer?.push(pos, rot.yaw, performance.now(), isCrouching);
  }

  showAbility(duration) {
    if(!duration)return;
    if(!this.abilityRing) {
      this.abilityRing=new THREE.Mesh(new THREE.TorusGeometry(.65,.025,6,24),new THREE.MeshBasicMaterial({color:0x38dbed,transparent:true,opacity:.8}));
      this.abilityRing.rotation.x=Math.PI/2;this.abilityRing.position.y=-.7;this.group.add(this.abilityRing);
    }
    this.abilityRing.visible=true;this.abilityRemaining=duration;
  }

  update(delta) {
    if(this.abilityRing) {this.abilityRemaining-=delta;this.abilityRing.visible=this.abilityRemaining>0;this.abilityRing.rotation.z+=delta;}
    if (this.movementBuffer?.sample(performance.now(), this.bufferedTransform)) {
      const pose = this.bufferedTransform;
      this.group.position.set(pose.x, pose.y, pose.z);
      this.group.rotation.y = pose.yaw;
      this.group.scale.y = pose.heightScale;
    } else if (this.targetPos) {
      this.group.position.lerp(this.targetPos, 1 - Math.exp(-20 * delta));
    }
    if (!this.movementBuffer && this.targetRot) {
      const yawDelta = Math.atan2(Math.sin(this.targetRot.yaw - this.group.rotation.y), Math.cos(this.targetRot.yaw - this.group.rotation.y));
      this.group.rotation.y += yawDelta * (1 - Math.exp(-20 * delta));
    }
    if (!this.movementBuffer) this.group.scale.y = this.isCrouching ? 0.625 : 1;

    // GLTF animation update
    if (this.isUsingGltf && this.mixer) {
      this.mixer.update(delta);
      const actionName = this.isMoving ? (this.isRunning ? 'Run' : 'Walk') : 'Idle';
      if (this.animations && this.animations[actionName] && this.currentAction !== this.animations[actionName]) {
        if (this.currentAction) this.currentAction.fadeOut(0.2);
        this.currentAction = this.animations[actionName];
        this.currentAction.reset().fadeIn(0.2).play();
      }
    }

    // Procedural walk animation
    if (!this.isUsingGltf && this.leftLeg && this.rightLeg) {
      if (this.isMoving) {
        const speed = this.isRunning ? 14 : 9;
        this.walkAnimTime += delta * speed;
        const swing = Math.sin(this.walkAnimTime) * 0.6;

        this.leftLeg.rotation.x = swing;
        this.rightLeg.rotation.x = -swing;

        if (this.leftArm) this.leftArm.rotation.x = -swing * 0.5;
        if (this.rightArm) this.rightArm.rotation.x = swing * 0.2;
      } else {
        this.leftLeg.rotation.x = 0;
        this.rightLeg.rotation.x = 0;
        if (this.leftArm) this.leftArm.rotation.x = 0;
        if (this.rightArm) this.rightArm.rotation.x = 0;
      }
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.gltfRoot); }
    disposeTrees([this.group], this.borrowedResources);
    this.hitboxes.length = 0;
    this.movementBuffer.samples.length = 0;
  }
}
