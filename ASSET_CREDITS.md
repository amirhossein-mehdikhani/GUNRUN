# Downloaded character and weapon models

The nine newly bundled GLB files are by **Quaternius**, released under **CC0 1.0 Universal**. The creator's pack pages below identify the applicable license. The converted GLB distribution is pinned to revision `0128ca510d653bb04d6d1e4885bd8890b5050b4f` of [trebeljahr/quaternius-showcase](https://github.com/trebeljahr/quaternius-showcase). Exact download URLs and SHA-256 checksums are stored in [new-assets.json](public/assets/models/new-assets.json).

| Local file / game role | Source model | Creator's pack and license |
| --- | --- | --- |
| Pathfinder.glb / Pathfinder | modular_men/Adventurer.glb | [Ultimate Modular Men — CC0](https://quaternius.com/packs/ultimatemodularcharacters.html) |
| TitanMech.glb / Titan Mech | mech_pack/George.glb | [Animated Mech — CC0](https://quaternius.com/packs/animatedmech.html) |
| AnimationRig.glb / shared animations | cyberpunk_pack/Character.glb | [Cyberpunk Game Kit — CC0](https://quaternius.com/packs/cyberpunkgamekit.html) |
| Sentinel.glb / Sentinel | modular_men/Swat.glb | [Ultimate Modular Men — CC0](https://quaternius.com/packs/ultimatemodularcharacters.html) |
| DesertRanger.glb / Desert Ranger | modular_women/Soldier.glb | [Ultimate Modular Women — CC0](https://quaternius.com/packs/ultimatemodularwomen.html) |
| VectorSMG.glb / Vector SMG | modular_sci_fi_guns_pack/SMG_1.glb | [Sci-Fi Modular Guns — CC0](https://quaternius.com/packs/scifimodularguns.html) |
| TacticalPistol.glb / Tactical Pistol | modular_sci_fi_guns_pack/Pistol_1.glb | [Sci-Fi Modular Guns — CC0](https://quaternius.com/packs/scifimodularguns.html) |
| SupportLMG.glb / Support LMG | modular_sci_fi_guns_pack/AR_4.glb | [Sci-Fi Modular Guns — CC0](https://quaternius.com/packs/scifimodularguns.html) |
| SlugShotgun.glb / Slug Shotgun | survival_pack/Shotgun_1.glb | [Survival Pack — CC0](https://quaternius.com/packs/survival.html) |

Game names and weapon stats are RUNGUN assignments; the Support LMG appearance uses the creator's AR_4 mesh. No claim of an exact real-world firearm replica is made.

License deed: https://creativecommons.org/publicdomain/zero/1.0/

## Integration

- Models are stored locally under `public/assets/models`, included in executable builds and usable offline. New files have no external image or buffer dependencies.
- The modular adventurer, SWAT and soldier GLBs contain skins without animation clips. The game reuses compatible quaternion tracks from the Cyberpunk character, filtering by bone name and retaining each target rig's translations/proportions. Character size and feet are normalized to the existing player convention; hitboxes and gameplay stats stay shared.
- Gun models replace the procedural extra-gun meshes after loading and are fitted to FPS dimensions. If a model cannot load, the existing procedural fallback remains playable.
- All seven operator PNG thumbnails are front-view renders of the actual game character models, not downloaded website thumbnails or flat avatar icons. Normal menu use reads these small static PNGs and does not create another WebGL context.
- For developer preview regeneration, open `/?generatePreviews=1`, then Operators. A single temporary renderer produces all previews, releases its context afterward, and places the PNG data URLs on the gallery images for export.
- `npm run download-assets` restores missing new assets from the pinned source and checks their hashes. It no longer substitutes a soldier model for a missing Dust II map.

Earlier Soldier, RobotExpressive and Xbot models retain their existing sources; this document records the newly imported models rather than reassigning their licenses.

## Killhouse recreation

`public/js/killhouse.js` is original code-built geometry, inspired by the training warehouse described in [Activision’s Killhouse map guide](https://blog.activision.com/call-of-duty/2019-10/Call-of-Duty-Mobile-Map-Snapshot-Killhouse). No COD assets or third-party map meshes are bundled. The thumbnail is a roofless overview render of this geometry. It is a lightweight recreation, not an exact COD Mobile map import.

## Locally downloaded Killhouse

[Killhouse by Blenderworks](https://www.cgtrader.com/free-3d-models/exterior/other/call-of-duty-killhouse-map), downloaded through the user's signed-in account, is installed locally as an optimized map. The source has no textures; the importer assigns game materials. It is marked Royalty Free (no AI), not CC0. The source FBX, GLB, collision and import metadata are deliberately excluded from Git; the rendered thumbnail is included as game UI imagery. The [license](https://help.cgtrader.com/hc/en-us/articles/360015124437-Royalty-Free-License) limits standalone redistribution. These files must not be added to public source archives as freely redistributable assets.
