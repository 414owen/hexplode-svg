console.log('hexplode');

// DOM search
const q = (query, el = document) => el.querySelector(query);
const qa = (query, el = document) => Array.from(el.querySelectorAll(query));

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
const attrs = (node, attrs) =>
  Object.entries(attrs).reduce((node, [key, val]) => {
    node.setAttributeNS(null, key, val);
    return node;
  }, node);

const crel = (el, atts = {}) =>
  attrs(document.createElementNS('http://www.w3.org/2000/svg', el), atts);
const crText = str => document.createTextNode(str);

const emptyEl = node => {
  Array.from(node.childNodes).forEach(el => { el.remove(); });
  return node;
};

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

const text = (str, className = 'bottom') => append(
  crel('text', {
    'class': className,
  }),
  crText(str)
)[0];

const textAt = (str, className) =>
  append(main, text(str, className))[1];

const editText = (node, str) => {
  node.childNodes[0].nodeValue = str;
  return node;
};

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
const hasCellPredicate = stat => stat.ownedCells !== 0;

attrs(q('.hex path'), {
  d: `M${-width / 2} 0l${width / 4} ${vedge}l${width / 2} 0l${width / 4} ${-vedge}l-${width / 4} -${vedge}l-${width / 2} 0z`,
});

qa('circle').forEach(el => {
  const [cx, cy] = getAttrs(el, ['cx', 'cy']);
  el.style.transformOrigin = `${cx}px ${cy}px`;
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

const numMenu = (values, str, callback) => new Promise(res => {
  main.classList.add('menu');
  append(emptyEl(main), emptyEl(board));
  const n = values.length;
  values.forEach((value, ind) => {
    append(board, cloneOrig({
      transform: `translate(${width * ind / n + width / n / 2} ${height / 2}) scale(${1 / values.length})`,
      'class': `hex ${classes[value]}`,
      style: `animation-delay: -100s`
    }, () => {
      res(value)
      main.classList.remove('menu');
    }));
  });
  textAt(str);
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
    this.stats = Array(players).fill(0).map(_ => ({
      ownedCells: 0,
      tokens: 0,
    }));
    this.winner = false;
    this.clickLock = false;
    this.text = textAt('');
    this.updateTurnIndicator();
    append(main, attrs(q('path', cloneOrig()), {
      id: 'indicator',
    }))[1];
    this.turns = [];

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

  replaceText(str, position = 'bottom left') {
    editText(
      attrs(this.text, { 'class': `${position} ${this.playerInd}` }),
      str
    );
  }

  updateTurnIndicator() {
    this.replaceText(`Player ${this.playerInd + 1}`);
    attrs(main, { 'class': `p${this.playerInd}` });
  }

  get(ptarr) {
    return getIn(this.grid, ptarr);
  }

  getPoint(point) {
    return this.get(point.get());
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

  resolveCell(cell, delay = 300) {
    return new Promise(res => {
      const frontier = [];

      // they've claimed another player's or empty cell
      if (cell.pieces > 0 && cell.player !== this.playerInd) {

        // they've taken over another player's cell
        if (cell.player !== null) {
          this.stats[cell.player].ownedCells--;
        }

        this.stats[this.playerInd].ownedCells++;

        // take ownership
        cell.player = this.playerInd;
      }

      // cell's gonna blow
      if (cell.pieces >= cell.neighbours.length) {
        cell.neighbours.forEach(cell => {
          frontier.push(cell);
          this.incCell(cell);
        });
        cell.pieces %= cell.neighbours.length;
        if (cell.pieces === 0) {
          cell.player = null;
          this.stats[this.playerInd].ownedCells--;
        }
        this.styleCell(cell);
      }

      // base case - nothing to do
      if (frontier.length === 0) {
        return res();
      }

      // one-by-one frontier resolution
      window.setTimeout(() => {
        frontier.reduce((acc, cell) =>
          acc.then(() => this.resolveCell(cell, delay)),
          Promise.resolve()).then(res);
      }, delay);
    });
  }

  getWinner() {
    if (this.turn < 2 || this.stats.filter(hasCellPredicate).length !== 1) return;
    return this.stats.findIndex(hasCellPredicate);
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
    this.turns.push(cell.point);
    this.resolveCell(this.incCell(cell)).then(() => {
      const winner = this.getWinner();
      if (winner !== undefined) {
        this.replaceText(`Player ${winner + 1} wins`, 'center');
        main.classList.add('game-over');
        main.classList.add(`p${winner}`);
      } else {
        this.clickLock = false;
        this.turn++;
        this.playerInd = this.getNextPlayer();
        this.updateTurnIndicator();
      }
    });
  }

  debug(points, delay = 0) {
    return points.reduce((acc, point, ind) =>
      acc.then(() => {
        if (
          qa('.hex.p0:not(.zero)').length !== this.stats[0].ownedCells
          || qa('.hex.p1:not(.zero)').length !== this.stats[1].ownedCells
        ) {
          console.log(ind);
          throw new Error();
        }
        const cell = getIn(this.grid, point);
        return this.resolveCell(this.incCell(cell), delay).then(() => {
          this.playerInd = this.getNextPlayer();
          this.updateTurnIndicator();
        });
      }),
      Promise.resolve(1)
    ).catch(pass);
  }
}

const runGame = (players, size) => {
  size--;
  append(emptyEl(main), emptyEl(board));
  attrs(board, {
    transform: `translate(${width / 2} ${height / 2}) scale(${1 / (1 + 2 * size)})`,
  });
  window.game = new Game(players, size);
};

const startGame = () => {
  numMenu([2, 3, 4, 5, 6, 7, 8, 9], 'How many players?')
    .then(p => numMenu([3, 4, 5, 6, 7, 8, 9], 'Select board size')
      .then(n => [p, n]))
  .then(applier(runGame));
};

startGame();
