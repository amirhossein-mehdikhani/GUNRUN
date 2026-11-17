export const WEAPON_TYPES = {
  1: {
    id: 'auto',
    name: 'Assault Rifle',
    code: 'AR-556',
    maxAmmo: 30,
    fireRate: 100, // ms (automatic)
    isAutomatic: true,
    damageBody: 18,
    damageHead: 100,
    range: 120,
    speedMultiplier: 1.0,
    reloadDuration: 1500
  },
  2: {
    id: 'semi',
    name: 'Semi-Auto DMR',
    code: 'DMR-762',
    maxAmmo: 12,
    fireRate: 240, // ms (semi-auto)
    isAutomatic: false,
    damageBody: 35,
    damageHead: 100,
    range: 140,
    speedMultiplier: 1.05,
    reloadDuration: 1400
  },
  3: {
    id: 'sniper',
    name: 'Heavy Sniper',
    code: 'AWP-50',
    maxAmmo: 5,
    fireRate: 1200, // ms (bolt-action)
    isAutomatic: false,
    damageBody: 100,
    damageHead: 200,
    range: 200,
    speedMultiplier: 0.95,
    reloadDuration: 2200,
    hasScope: true
  },
  5: {id:'smg',name:'Vector SMG',code:'SMG-9',maxAmmo:32,fireRate:65,isAutomatic:true,damageBody:12,damageHead:45,range:70,speedMultiplier:1.1,reloadDuration:1300},
  6: {id:'shotgun',name:'Slug Shotgun',code:'SG-12',maxAmmo:6,fireRate:850,isAutomatic:false,damageBody:70,damageHead:140,range:45,speedMultiplier:.95,reloadDuration:2400},
  7: {id:'pistol',name:'Tactical Pistol',code:'P-45',maxAmmo:15,fireRate:190,isAutomatic:false,damageBody:24,damageHead:72,range:65,speedMultiplier:1.12,reloadDuration:1100},
  8: {id:'lmg',name:'Support LMG',code:'LMG-556',maxAmmo:80,fireRate:120,isAutomatic:true,damageBody:21,damageHead:85,range:130,speedMultiplier:.8,reloadDuration:3400},
  4: {
    id: 'knife',
    name: 'Combat Knife',
    code: 'KUKRI-X',
    maxAmmo: 999,
    fireRate: 350, // ms
    isAutomatic: false,
    damageBody: 55,
    damageHead: 120,
    range: 3.2,
    speedMultiplier: 1.15, // Fast run speed while holding knife!
    reloadDuration: 0,
    isMelee: true
  }
};
