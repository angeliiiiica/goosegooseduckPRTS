/* PRTS — map points of interest (tasks, sabotages, mechanisms) for built-in maps.
 * Source: 鹅鸭杀 BWIKI interactive map (Widget:地下室互动任务地图).
 * x/y are per-mille (0–1000) of the map image, so they survive a resize of the image.
 * zh names are the wiki's; en names are ours. Speed: f = fast, n = normal, s = slow.
 * UMD: module.exports in Node, self.GGDPoi in the browser. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GGDPoi = factory();
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict';

  // marker type → toggle group (the panel switches groups, not single types)
  const GROUP_OF = {
    goose: 'task', special: 'task', destroy: 'sab', torch: 'torch',
    spawn: 'spawn', food: 'food', shelter: 'hide', peek: 'peek',
    furnace: 'misc', portal: 'misc', tribute: 'misc',
  };
  const GROUPS = ['task', 'sab', 'torch', 'spawn', 'food', 'hide', 'peek', 'misc'];

  const ROOMS = {
    lab: { zh: '实验室', en: 'Laboratory' },
    boiler: { zh: '锅炉房', en: 'Boiler Room' },
    dungeon: { zh: '地牢', en: 'Dungeon' },
    curio: { zh: '奇珍异品收藏室', en: 'Storage (Curios)' },
    altar: { zh: '祭坛', en: 'Sacrificial Altar' },
    study: { zh: '书房', en: 'Study' },
    lockers: { zh: '储物柜', en: 'Lockers' },
    fog: { zh: '雾洞', en: 'Foggy Cave' },
    storage: { zh: '储物间', en: 'Storage' },
    tunnelEnt: { zh: '隧道入口', en: 'Tunnel Entrance' },
    hall: { zh: '礼堂', en: 'Auditorium' },
    pit: { zh: '坑', en: 'The Pit' },
    tunnelPit: { zh: '隧道 / 坑', en: 'Tunnels / Pit' },
    corridor: { zh: '走廊', en: 'Hallway' },
    all: { zh: '全图', en: 'Whole map' },
  };

  // [type, zh, en, room, speed, x, y, labelAbove]
  const BASEMENT = [
    ['goose', '清洁哭泣雕像', 'Clean Weeping Statue', 'curio', 'f', 344, 352],
    ['goose', '整理箱子', 'Organize Crates', 'curio', 's', 308, 304],
    ['goose', '调谐信号', 'Tune Signal', 'lab', 's', 411, 129],
    ['goose', '混合化学品', 'Mix Chemicals', 'lab', 'f', 305, 138, 1],
    ['goose', '清洁克隆舱', 'Clean Clone Pod', 'lab', 'f', 348, 182],
    ['goose', '重组烧瓶', 'Reassemble Flasks', 'lab', 's', 267, 136],
    ['goose', '点燃蜡烛', 'Light Candles', 'corridor', 'f', 437, 54],
    ['goose', '抛光盔甲', 'Polish Armor', 'corridor', 'f', 210, 191],
    ['goose', '把煤扔进炉子里', 'Shovel Coal', 'boiler', 's', 700, 223],
    ['goose', '玩三张牌蒙特', 'Three-Card Monte', 'boiler', 'n', 573, 161],
    ['goose', '掸肖像上的灰尘', 'Dust Portrait', 'corridor', 'f', 596, 43],
    ['goose', '打开牢笼', 'Open Cage', 'dungeon', 'f', 198, 293],
    ['goose', '打开铁牢笼', 'Open Iron Cage', 'dungeon', 'f', 260, 338],
    ['goose', '掸肖像上的灰尘', 'Dust Portrait', 'study', 'f', 674, 302],
    ['goose', '印章文件', 'Stamp Documents', 'study', 'f', 674, 364],
    ['goose', '修剪灌木', 'Trim Hedge', 'corridor', 'n', 756, 175],
    ['goose', '印章文件', 'Stamp Documents', 'hall', 'f', 770, 889],
    ['goose', '获取书籍 1/2', 'Collect Books 1/2', 'hall', 'f', 628, 534],
    ['goose', '擦黑板', 'Clean Chalkboard', 'hall', 'n', 821, 855],
    ['goose', '扫楼梯', 'Sweep Stairs', 'hall', 'f', 667, 702],
    ['goose', '摆放金属球', 'Place Metal Orbs', 'hall', 'n', 764, 820],
    ['goose', '整理书架上的书 2/2', 'Shelve Books 2/2', 'hall', 'f', 531, 666],
    ['goose', '清扫玻璃', 'Sweep Glass', 'storage', 'f', 329, 693],
    ['goose', '清洁吊灯', 'Clean Chandelier', 'storage', 'f', 426, 675],
    ['goose', '敲晕老鼠', 'Whack Rats', 'corridor', 's', 338, 604],
    ['goose', '戳垃圾袋', 'Poke Trash Bags', 'fog', 'f', 835, 236],
    ['goose', '去钓鱼', 'Go Fishing', 'fog', 'n', 924, 288],
    ['goose', '捡起长袍 1/2', 'Pick Up Robes 1/2', 'lockers', 'f', 389, 548],
    ['goose', '洗长袍 2/2', 'Wash Robes 2/2', 'lockers', 'f', 391, 471],
    ['goose', '开箱', 'Open Chest', 'tunnelEnt', 'f', 387, 891],
    ['goose', '重新组装画', 'Reassemble Painting', 'tunnelEnt', 'f', 404, 811],
    ['special', '表示敬意（献花）', 'Pay Respects (Flowers)', 'tunnelPit', 'f', 56, 773],
    ['goose', '调味牛排', 'Season Steak', 'altar', 'n', 504, 357],
    ['goose', '重新组装画', 'Reassemble Painting', 'corridor', 'f', 539, 218],

    ['destroy', '心灵感应', 'Telepathy', 'curio', '', 345, 350, 1],
    ['destroy', '关灯', 'Lights Out', 'lab', '', 374, 148],
    ['destroy', '投喂神明', 'Feed the God', 'study', '', 672, 361, 1],
    ['destroy', '关门', 'Lock Doors', 'storage', '', 424, 682, 1],
    ['destroy', '千里眼', 'Clairvoyance', 'fog', '', 924, 286, 1],
    ['destroy', '牺牲铃', 'Sacrifice Bell', 'pit', '', 78, 906],

    ['torch', '点燃火把', 'Light Torch', 'all', '', 610, 370],
    ['torch', '点燃火把', 'Light Torch', 'all', '', 219, 27],
    ['torch', '点燃火把', 'Light Torch', 'all', '', 718, 61],
    ['torch', '点燃火把', 'Light Torch', 'all', '', 609, 206],
    ['torch', '点燃火把', 'Light Torch', 'all', '', 807, 296],
    ['torch', '点燃火把', 'Light Torch', 'all', '', 735, 423],
    ['torch', '点燃火把', 'Light Torch', 'all', '', 728, 641],
    ['torch', '点燃火把', 'Light Torch', 'all', '', 422, 215],

    ['furnace', '鸡腿处理处', 'Drumstick Disposal', '', '', 701, 195],
    ['furnace', '鸡腿处理处', 'Drumstick Disposal', '', '', 839, 211],
    ['shelter', '藏身处', 'Hiding Spot', '', '', 208, 189],
    ['shelter', '藏身处', 'Hiding Spot', '', '', 614, 563],
    ['shelter', '藏身处', 'Hiding Spot', '', '', 543, 124],
    ['shelter', '藏身处', 'Hiding Spot', '', '', 777, 515],
    ['shelter', '藏身处', 'Hiding Spot', '', '', 328, 661],
    ['peek', '透视点', 'Peek Point', '', '', 585, 613],
    ['peek', '透视点', 'Peek Point', '', '', 327, 227],
    ['peek', '透视点', 'Peek Point', '', '', 537, 217],
    ['peek', '透视点', 'Peek Point', '', '', 414, 356],
    ['peek', '透视点', 'Peek Point', '', '', 674, 286],
    ['portal', '传送门', 'Portal', '', '', 38, 662],
    ['spawn', '出生点', 'Spawn', '', '', 657, 411],
    ['spawn', '出生点', 'Spawn', '', '', 343, 499],
    ['spawn', '出生点', 'Spawn', '', '', 750, 100],
    ['spawn', '出生点', 'Spawn', '', '', 244, 65],
    ['spawn', '出生点', 'Spawn', '', '', 483, 395],
    ['spawn', '出生点', 'Spawn', '', '', 861, 381],
    ['spawn', '出生点', 'Spawn', '', '', 168, 573],
    ['spawn', '出生点', 'Spawn', '', '', 382, 848],
    ['spawn', '出生点', 'Spawn', '', '', 665, 636],
    ['food', '食物刷新点', 'Food Spawn', '', '', 225, 78],
    ['food', '食物刷新点', 'Food Spawn', '', '', 335, 144],
    ['food', '食物刷新点', 'Food Spawn', '', '', 707, 95],
    ['food', '食物刷新点', 'Food Spawn', '', '', 585, 584],
    ['food', '食物刷新点', 'Food Spawn', '', '', 507, 413],
    ['food', '食物刷新点', 'Food Spawn', '', '', 421, 253],
    ['food', '食物刷新点', 'Food Spawn', '', '', 636, 244],
    ['food', '食物刷新点', 'Food Spawn', '', '', 361, 853],
    ['food', '食物刷新点', 'Food Spawn', '', '', 251, 511],
    ['food', '食物刷新点', 'Food Spawn', '', '', 369, 505],
    ['food', '食物刷新点', 'Food Spawn', '', '', 675, 440],
    ['food', '食物刷新点', 'Food Spawn', '', '', 769, 562],
    ['food', '食物刷新点', 'Food Spawn', '', '', 40, 864],
    ['food', '食物刷新点', 'Food Spawn', '', '', 372, 692],
    ['food', '食物刷新点', 'Food Spawn', '', '', 687, 672],
    ['food', '食物刷新点', 'Food Spawn', '', '', 864, 468],
    ['tribute', '致敬', 'Tribute', 'tunnelPit', '', 56, 752],
  ];

  const expand = (rows) => rows.map(([type, zh, en, room, speed, x, y, up], i) => ({
    id: i, type, group: GROUP_OF[type], zh, en, room: ROOMS[room] || null, speed, x, y, up: !!up,
  }));

  return {
    GROUPS,
    sets: { basement: expand(BASEMENT) },
  };
});
