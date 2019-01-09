console.log('hexplode');

const q = query => document.querySelector(query);
const svg  = q('svg');
const main = q('#main');
const orig = q('#orig');
const classes = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

const pass = () => {};
const constant = a => b => a;

const view = () => svg.getAttributeNS(null, 'viewBox').split(' ')
  .map(a => parseInt(a, 10));
const dims = () => view().slice(2);
const [width, height] = dims();
const rads = n => Math.PI * n / 180;
const edge = (width / 2) * Math.cos(rads(30));
const vedge = (width / 2) * Math.sin(rads(30));
const signum = a => a > 0 ? 1 : a < 0 ? -1 : 0;

if (location.hash === '#reduced') {
  main.classList.remove('advanced');
}

const withClick = (el, callback) => {
  el.onclick = callback;
  return el;
};

const attrs = (node, attrs) => {
  Object.entries(attrs).forEach(([key, val]) => {
    node.setAttributeNS(null, key, val);
  });
  return node;
};

attrs(q('.hex path'), {
  d: `M0 ${height / 2}l${width / 4} ${edge}l${width / 2} 0L${width} ${height / 2}l-${width / 4} -${edge}l-${width / 2} 0z`,
});

const cloneOrig = (att = {}, onClick = pass) => {
  const res = orig.cloneNode(true);
  res.id = '';
  return attrs(withClick(res, onClick), att);
};

const crel = el => document.createElementNS('http://www.w3.org/2000/svg', el);
const append = (par, child) => {
  par.appendChild(child);
  return par;
};

const crText = (x, y, text) => append(
  attrs(crel('text'), { x, y }),
  document.createTextNode(text)
);

let text;

const addText = text => {
  const [width, height] = dims();
  const node = attrs(
    crText(width / 2, height, text), {
      fill: '#fff',
      'text-anchor': 'middle',
      'dominant-baseline': 'text-after-edge',
    }
  );
  append(main, node);
  return node;
};

const replaceText = string => {
  if (text) {text.remove();}
  return addText(string);
};

const emptyMain = () => {
  Array.from(main.childNodes).forEach(el => { el.remove(); });
};

const numMenu = (values, text, callback) => {
  emptyMain();
  main.classList.add('menu');
  const n = values.length;
  const newWidth = width * n;
  const newHeight = height * n;
  attrs(svg, {'viewBox': `0 0 ${newWidth} ${newHeight}`});
  values.forEach((value, ind) => {
    append(main, cloneOrig({
      transform: `translate(${100 * ind} ${newHeight / 2 - 50})`,
      'class': `hex button ${classes[value]}`,
      style: `animation-delay: ${ind / 10}s`
    }, () => {
      callback(value)
      main.classList.remove('menu');
    }));
  });
  replaceText(text);
};

const isOnGrid = (n, ptarr) => Math.max(...ptarr.map(Math.abs)) <= n;
const isPointOnGrid = (n, point) => isOnGrid(n, point.get());
const sum = arr => arr.reduce((a, b) => a + b);
const isHexPoint = point => sum(point.get()) === 0;

const surround = [
  [0, 1, 1],
  [0, 1, -1],
  [0, -1, 1],
  [0, -1, -1],
  [1, 1, 0],
  [1, -1, 0],
  [1, 0, 1],
  [1, 0, -1],
  [-1, 1, 0],
  [-1, -1, 0],
  [-1, 0, 1],
  [-1, 0, -1],
];

class Point {
  constructor(x, y, z) {
    this.pt = [x, y, z];
  }

  get() {
    return this.pt;
  }

  add(pt) {
    const [x, y, z] = pt.get();
    const [i, j, k] = this.pt;
    return new Point(x + i, y + j, z + k);
  }

  surrounding() {
    return surround.map(a => new Point(...a).add(this));
  }

  equals(pt) {
    const [x, y, z] = pt.get();
    const [i, j, k] = this.pt;
    return x === i && y === j && z === k;
  }

  pathFrom(pt) {
    const par = this.get();
    const path = [];
    while (!this.equals(pt)) {
      let step;
      const p = pt.get();
      const [a, b, c] = par.map((a, i) => Math.abs(a - p[i]));
      if (a <= b && a <= c) {
        step = new Point(0, signum(par[1] - p[1]), signum(par[2] - p[2]));
      } else if (b <= a && b <= c) {
        step = new Point(signum(par[0] - p[0]), 0, signum(par[2] - p[2]));
      } else {
        step = new Point(signum(par[0] - p[0]), signum(par[1] - p[1]), 0);
      }
      path.push(step);
      pt = pt.add(step);
    }
    return path;
  }
}

const offsets = {
  '-1': {
    0: [-3 * width / 4, -edge],
    1: [-3 * width / 4, edge],
  },
  0: {
    '-1': [0, -2 * edge],
    1: [0, 2 * edge],
  },
  1: {
    0: [3 * width / 4, edge],
    '-1': [3 * width / 4, -edge],
  },
};

console.log(offsets);

const translate = point => {
  const [nw, nh] = dims();
  const path = point.pathFrom(new Point(0, 0, 0));
  return path.map(a => a.get()).reduce(([x, y], [x1, y1]) => {
    const [dx, dy] = offsets[x1][y1];
    return [x + dx, y + dy];
  }, [nw / 2 - width / 2, nh / 2 - height / 2]);
};

const newCell = (n, point, onClick) => {
  const [x, y, z] = point.get();
  const node = cloneOrig({
    transform: `translate(${translate(point)})`,
    style: `animation-delay: ${(Math.random() + n + Math.min(x, y, z)) / 10}s`,
    'data-point': JSON.stringify(point.get()),
  }, onClick);
  append(main, node);
  return {
    id: point.get().toString(),
    player: null,
    pieces: 0,
    point,
    node: node,
    neighbours: point.surrounding()
      .filter(isHexPoint)
      .filter(isPointOnGrid.bind(null, n))
  };
}

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

const getIn = (root, path) => path.reduce((acc, seg) => acc[seg], root);

let turn = 0;
let playerInd = 0;
let ownedCells = [0, 0];
let winner = false;
let clickLock = false;

class Grid {
  constructor(n) {
    this.n = n;
    const grid = this.grid = {};
    this.points = 0;
    pointsIn(n, point => {
      this.points++;
      updateIn(grid, point.get(), constant(newCell(n, point, data => {
        this.handleCellClick(data)
      })));
    });
    pointsIn(n, point => {
      const cell = getIn(grid, point.get());
      cell.neighbours = cell.neighbours.map(point =>
        getIn(grid, point.get()));
    });
    this.origin = getIn(grid, [0, 0, 0]);
  }

  get(x, y, z) {
    return this.grid[x][y][z];
  }

  getPoint(point) {
    return this.get(...point.get());
  }

  addToCell(cell) {
    let frontier = [cell];
    while (frontier.length > 0) {
      const newFrontier = [];
      frontier.forEach(cell => {
        cell.pieces++;
        if (cell.node.classList.contains('zero') || !cell.node.classList.contains(`p${playerInd}`)) {
          ownedCells[playerInd]++;
        }
        if (cell.node.classList.contains(`p${(playerInd + 1) % 2}`)) {
          ownedCells[(playerInd + 1) % 2]--;
        }
        if (cell.pieces >= cell.neighbours.length) {
          ownedCells[playerInd]--;
          cell.neighbours.forEach(cell => {
            newFrontier.push(cell);
          })
          cell.pieces = 0;
        }
        attrs(cell.node, {
          'class': `hex ${cell.pieces > 0 ? `p${playerInd}` : ''} ${classes[cell.pieces]}`
        });
      });
      frontier = newFrontier;
      console.log(ownedCells);
      if (turn > 1 && ownedCells[(playerInd + 1) % 2] === 0) {
        winner = playerInd;
        replaceText(`Player ${playerInd + 1} Wins`);
        main.classList.add('game-over');
        main.classList.add(`p${playerInd}`);
        return;
      }
    }
    clickLock = false;
  }

  handleCellClick(data) {
    const pointStr = data.target.dataset.point;
    if (pointStr) {
      const cell = this.get(...JSON.parse(pointStr));
      if (cell.node.classList.contains('zero') || !cell.node.classList.contains(`p${(playerInd + 1) % 2}`)) {
        if (clickLock) return;
        clickLock = true;
        this.addToCell(cell);
        turn++;
        playerInd = (playerInd + 1) % 2;
      }
    } else {
      this.handleCellClick({ target: data.target.parentNode });
    }
  }
}

const runGame = size => {
  emptyMain();
  attrs(svg, {
    viewBox: `0 0 ${(size * 2 + 1) * width} ${(size * 2 + 1) * height}`,
  });
  const grid = new Grid(size);
};

const startGame = () => {
  numMenu([2, 3, 4, 5, 6, 7, 8, 9], 'Board size', runGame)
};

startGame();
