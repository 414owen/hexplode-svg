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

attrs(q('#hex'), {
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

const addText = text => {
  const [width, height] = dims();
  return append(main, attrs(
    crText(width / 2, height, text), {
      fill: '#fff',
      'text-anchor': 'middle',
      'dominant-baseline': 'text-after-edge',
    }
  ));
};

const emptyMain = () => {
  Array.from(main.childNodes).forEach(el => { el.remove(); });
};

const numMenu = (values, text, callback) => {
  emptyMain();
  const n = values.length;
  const newWidth = width * n;
  const newHeight = height * n;
  attrs(svg, {'viewBox': `0 0 ${newWidth} ${newHeight}`});
  values.forEach((value, ind) => {
    append(main, cloneOrig({
      transform: `translate(${100 * ind} ${newHeight / 2 - 50})`,
      'class': `hex button ${classes[value]}`,
    }, callback.bind(null, value)))
  });
  addText(text);
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

const newCell = (n, point, onClick) => ({
  id: point.get().toString(),
  player: null,
  pieces: 0,
  point,
  node: append(main, cloneOrig({
    transform: `translate(${translate(point)})`,
  }, onClick)),
  neighbours: point.surrounding()
    .filter(isHexPoint)
    .filter(isPointOnGrid.bind(null, n))
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

const bfs = (root, fn) => {
  const traversed = {};
  let frontier = [root];
  while (frontier.length > 0) {
    const newFrontier = [];
    frontier.forEach(node => {
      traversed[node.id] = true;
      fn(node);
      node.neighbours.forEach(neighbour => {
        newFrontier.push(neighbour);
      });
    });
    frontier = newFrontier.filter(n => !(n.id in traversed));;
  }
};

let playerInd = 0;

class Grid {
  constructor(n) {
    this.n = n;
    const grid = this.grid = {};
    let points = 0;
    const onClick = point => {
      const cell = this.getPoint(point);
      let frontier = [cell];
      while (frontier.length > 0) {
        frontier.forEach(cell => {
          const newFrontier = [];
          cell.pieces++;
          if (cell.pieces >= cell.neighbours.length) {
            cell.neighbours.forEach(cell => {
              newFrontier.push(cell);
            })
            cell.pieces %= cell.neighbours;
          }
          cell.node.className = `hex p${playerInd} ${classes[cell.pieces]}`;
          frontier = newFrontier;
        });
      }
      playerInd = (playerInd + 1) % 2;
    };
    pointsIn(n, point => {
      updateIn(grid, point.get(), constant(newCell(n, point, onClick.bind(null, point))));
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
