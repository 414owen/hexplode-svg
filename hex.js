console.log('hexplode');

const svg  = document.querySelector('svg');
const main = document.querySelector('#main');
const orig = document.querySelector('#orig');
const classes = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const pass = () => {};

const view = () => svg.getAttributeNS(null, 'viewBox').split(' ');
const dims = () => view().slice(2);
const [width, height] = dims();

const cloneOrig = (onClick = pass) => {
  const res = orig.cloneNode(true);
  res.id = '';
  res.onclick = onClick;
  return res;
};

const crel = el => document.createElementNS('http://www.w3.org/2000/svg', el);
const append = (par, child) => {
  par.appendChild(child);
  return par;
};

const attrs = (node, attrs) => {
  Object.entries(attrs).forEach(([key, val]) => {
    node.setAttributeNS(null, key, val);
  });
  return node;
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
    }
  ));
};

const withClick = (el, callback) => {
  el.onclick = callback;
  return el;
};

const numMenu = (values, text, callback) => {
  [...document.querySelectorAll('#main > g:not(#orig)')].forEach(node => {
    main.removeChild(node);
  });
  const n = values.length;
  const newWidth = width * n;
  const newHeight = height * n;
  attrs(svg, {'viewBox': `0 0 ${newWidth} ${newHeight}`});
  values.forEach((value, ind) => {
    append(main, withClick(attrs(cloneOrig(), {
      transform: `translate(${100 * ind} ${newHeight / 2 - 50})`,
      'class': `hex button ${classes[value]}`,
    }), () => {
      callback(value);
    }));
  });
  addText(text);
};

const startGame = () => {
  numMenu([2, 3, 4, 5, 6, 7, 8, 9], 'Board size', console.log);
};

startGame();
