console.log('hexplode');

const main = document.getElementById('main');
const orig = document.getElementById('orig');
const classes = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];

const cloneOrig = () => {
  const res = orig.cloneNode();
  [...orig.querySelectorAll('*')].forEach(el => {
    res.appendChild(el.cloneNode());
  });
  res.id = '';
  let classInd = 0;
  res.onclick = () => {
    classInd = (classInd + 1) % classes.length;
    res.setAttribute('class', classes[classInd]);
  };
  return res;
};

main.appendChild(cloneOrig());
