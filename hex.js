console.log('hexplode');

// DOM search
const q = query => document.querySelector(query);
const qa = query => Array.from(document.querySelectorAll(query));

// constants
const classes = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const svg   = q('svg');
const main  = q('#main');
const orig  = q('#orig');
const board = q('#board');

const getAttrs = (node, attrs) => attrs.map(a => node.getAttributeNS(null, a));
const view = () => getAttrs(svg, ['viewBox'])[0].split(' ')
  .map(a => parseInt(a, 10));

const dims = () => view().slice(2);
const [width, height] = dims();
const rads = n => Math.PI * n / 180;
const vedge = (width / 2) * Math.cos(rads(30));

// DOM creation
const crel = el => document.createElementNS('http://www.w3.org/2000/svg', el);
const crText = str => document.createTextNode(str);

const emptyEl = node => {
  Array.from(node.childNodes).forEach(el => { el.remove(); });
  return node;
};

const attrs = (node, attrs) =>
  Object.entries(attrs).reduce((node, [key, val]) => {
    node.setAttributeNS(null, key, val);
    return node;
  }, node);

const withClick = (el, callback) => {
  el.onclick = callback;
  return el;
};

const cloneOrig = (att = {}, onClick = pass) =>
  attrs(withClick(orig.cloneNode(true), onClick), {...att, id: ''});

const append = (par, child) => {
  par.appendChild(child);
  return [par, child];
};

const text = (x, y, str, {bl = 'text-after-edge'} = {}) => append(
  attrs(
    crel('text'), {
    'text-anchor': 'middle',
    x,
    y,
    'dominant-baseline': bl,
  }),
  crText(str)
)[0];

const bottomText = str =>
  append(main, text(width / 2, height, str))[1];

const middleText = str =>
  append(main, text(width / 2, height / 2, str, {bl: 'middle'}))[1];

// functional helpers
const pass = () => {};
const constant = a => b => a;
const applier = fn => arr => fn(...arr);
const getIn = (root, path) => path.reduce((acc, seg) => acc[seg], root);
const updateIn = (root, path, updater) => {
  let node = root;
  path.forEach((seg, ind) => {
    if (ind === path.length - 1) {
      node[seg] = updater(node[seg]);
    } else {
      if (!(node[seg] instanceof Object)) node[seg] = {};
      node = node[seg];
    }
  });
};
const setIn = (root, path, el) => updateIn(root, path, constant(el));

attrs(q('.hex path'), {
  d: `M0 ${height / 2}l${width / 4} ${vedge}l${width / 2} 0L${width} ${height / 2}l-${width / 4} -${vedge}l-${width / 2} 0z`,
});

// hex points
const isOnGrid = (n, ptarr) => Math.max(...ptarr.map(Math.abs)) <= n;
const isPointOnGrid = (n, point) => isOnGrid(n, point.get());
const sum = arr => arr.reduce((a, b) => a + b);

const surround = [
  [0, 1, -1],
  [0, -1, 1],
  [1, -1, 0],
  [1, 0, -1],
  [-1, 1, 0],
  [-1, 0, 1],
];

class Point {
  constructor(x, y, z) {
    this.pt = [x, y, z];
  }

  add(pt) {
    const [x, y, z] = pt.get();
    const [i, j, k] = this.pt;
    return new Point(x + i, y + j, z + k);
  }

  get() {
    return this.pt;
  }

  equals(pt) {
    const [x, y, z] = pt.get();
    const [i, j, k] = this.pt;
    return x === i && y === j && z === k;
  }

  static parse(str) {
    return new Point(...JSON.parse(str));
  }

  surrounding() {
    return surround.map(a => new Point(...a).add(this));
  }
}

// translation constants
const dx = [width / 2, 0];
const dy = [-width / 4, vedge];
const dz = [-width / 4, -vedge];
const diffs = [dx, dy, dz];
const zip = (a, b) => a.map((ea, i) => [ea, b[i]]);

const translate = point => {
  const [nw, nh] = dims();
  const [ox, oy] = [nw / 2 - width / 2, nh / 2 - height / 2];
  return zip(point.get(), diffs).reduce(([x, y], [n, [dx, dy]]) =>
    [x + dx * n, y + dy * n], [ox, oy]);
};

const numMenu = (values, text, callback) => new Promise(res => {
  main.classList.add('menu');
  append(emptyEl(main), emptyEl(board));
  const n = values.length;
  const newWidth = width * n;
  const newHeight = height * n;
  values.forEach((value, ind) => {
    append(board, cloneOrig({
      transform: `scale(${1 / values.length}) translate(${width * ind} ${newHeight / 2 - height / 2})`,
      'class': `hex ${classes[value]}`,
      style: `animation-delay: -100s`
    }, () => {
      res(value)
      main.classList.remove('menu');
    }));
  });
  bottomText(text);
});

const pointsIn = (n, callback) => {
  for (let i = 0; i <= n * 2; i++) {
    const x = i - n;
    for (let j = 0; j <= n * 2; j++) {
      const y = j - n;
      const z = 0 - x - y;
      const point = new Point(x, y, z);
      if (isPointOnGrid(n, point)) callback(point);
    }
  }
};

const newCell = (n, point, onClick) => {
  const [x, y, z] = point.get();
  const node = cloneOrig({
    transform: `translate(${translate(point)})`,
    style: `animation-delay: ${(Math.random() + n + Math.min(x, y, z)) / 10}s`,
    'data-point': JSON.stringify(point.get()),
  }, onClick);
  return {
    id: point.get().toString(),
    player: null,
    pieces: 0,
    point,
    node: append(board, node)[1],
    neighbours: point.surrounding()
      .filter(isPointOnGrid.bind(null, n))
  };
}

class Game {
  constructor(players, size) {

    this.players = players;
    this.size = size;
    this.turn = 0;
    this.playerInd = 0;
    this.ownedCells = Array(players).fill(0);
    this.winner = false;
    this.clickLock = false;

    const grid = this.grid = {};

    const clickHandler = data => this.handleCellClick(data);

    // create cells
    pointsIn(this.size, point => {
      setIn(grid, point.get(), newCell(this.size, point, clickHandler));
    });

    // connect cells
    pointsIn(this.size, point => {
      const cell = getIn(grid, point.get());
      cell.neighbours = cell.neighbours.map(point => getIn(grid, point.get()));
    });
  }

  getPoint(point) {
    return getIn(this.grid, point.get());
  }

  getNextPlayer() {
    return (this.playerInd + 1) % this.players;
  }

  styleCell(cell) {
    return attrs(cell.node, {
      'class': `hex p${this.playerInd} ${classes[cell.pieces]}`
    });
  }

  incCell(cell) {
    cell.pieces++;
    this.styleCell(cell);
    return cell;
  }

  resolveCell(cell) {
    return new Promise(res => {
      const frontier = [];

      // they've taken over another player's cell
      if (cell.pieces > 0
        && cell.player !== null
        && cell.player !== this.playerInd) this.ownedCells[cell.player]--;

      // they've claimed an other player's or empty cell
      if (cell.pieces === 0 || cell.player !== this.playerInd)
        this.ownedCells[this.playerInd]++;

      // cell's gonna blow
      if (cell.pieces >= cell.neighbours.length) {
        this.ownedCells[this.playerInd]--;
        cell.neighbours.forEach(cell => {
          frontier.push(cell);
          this.incCell(cell);
        });
        cell.pieces %= cell.neighbours.length;
        this.styleCell(cell);
      }

      // style this cell and frontier
      cell.player = this.playerInd;

      // game over
      const winner = this.getWinner();
      if (winner) {
        middleText(`Player ${winner + 1} Wins`);
        main.classList.add('game-over');
        main.classList.add(`p${winner}`);
        return;
      }

      // base case - nothing to do
      if (frontier.length === 0) {
        res();
        return;
      }

      // one-by-one frontier resolution
      window.setTimeout(() => {
        return frontier.reduce((acc, cell) => {
          return acc.then(() => this.resolveCell(cell));
        }, Promise.resolve()).then(res);
      }, 300);
    });
  }

  getWinner() {
    if (this.turn <= 1) return;
    const zeros = this.ownedCells.filter(el => el === 0);
    if (zeros.length !== this.ownedCells.length - 1) return;
    const nonZeros = this.ownedCells.filter(el => el !== 0);
    return this.ownedCells.indexOf(nonZeros[0]);
  }

  handleCellClick(data) {

    if (this.clickLock) return;

    let node = data.target;
    while (!node.dataset.point) {
      node = node.parentNode;
    }

    const cell = this.getPoint(Point.parse(node.dataset.point));
    if (!(cell.player === this.playerInd || cell.pieces === 0)) return;

    this.clickLock = true;
    this.resolveCell(this.incCell(cell)).then(() => {
      this.clickLock = false;
      this.turn++;
      this.playerInd = this.getNextPlayer();
    });
  }
}

const runGame = (players, size) => {
  size--;
  append(emptyEl(main), emptyEl(board));
  attrs(board, {
    'transform-origin': 'center',
    transform: `scale(${1 / (1 + 2 * size)})`,
  });
  new Game(players, size);
};

const startGame = () => {
  numMenu([2, 3, 4, 5, 6, 7, 8, 9], 'How many players?')
    .then(p => numMenu([3, 4, 5, 6, 7, 8, 9], 'Select board size')
      .then(n => [p, n]))
  .then(applier(runGame));
};

startGame();
