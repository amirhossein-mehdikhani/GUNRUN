export const EXTRA_ARENAS = {
  switchyard: {
    title: 'Switchyard',
    subtitle: 'Rail freight yard with long lanes and staggered cargo cover.',
    sky: 0xa7bacb, ground: 0x5c6266, wall: 0x566973, cover: 0x9a4e34,
    width: 64, depth: 88
  },
  cistern: {
    title: 'Cistern Works',
    subtitle: 'Sandstone pumping station with a raised central platform and flanking routes.',
    sky: 0xdcc7a6, ground: 0x9f8969, wall: 0xb39164, cover: 0x47736c,
    width: 70, depth: 76
  }
};

export const PLAYABLE_MAPS = ['killhouse','dust2','stalkyard','turbine','frenzy','italy',...Object.keys(EXTRA_ARENAS)];

export function arenaSpawns(id) {
  const z = EXTRA_ARENAS[id].depth / 2 - 6;
  return [-z,z].flatMap(side => [-20,-10,0,10,20].map(x => ({x,y:1.6,z:side})));
}
