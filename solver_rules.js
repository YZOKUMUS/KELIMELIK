(() => {
const SIZE = 15;
const CENTER = 7;

const PREMIUM = [
  [4,0,0,1,0,0,0,4,0,0,0,1,0,0,4],
  [0,3,0,0,0,2,0,0,0,2,0,0,0,3,0],
  [0,0,3,0,0,0,1,0,1,0,0,0,3,0,0],
  [1,0,0,3,0,0,0,1,0,0,0,3,0,0,1],
  [0,0,0,0,3,0,0,0,0,0,3,0,0,0,0],
  [0,2,0,0,0,2,0,0,0,2,0,0,0,2,0],
  [0,0,1,0,0,0,1,0,1,0,0,0,1,0,0],
  [4,0,0,1,0,0,0,3,0,0,0,1,0,0,4],
  [0,0,1,0,0,0,1,0,1,0,0,0,1,0,0],
  [0,2,0,0,0,2,0,0,0,2,0,0,0,2,0],
  [0,0,0,0,3,0,0,0,0,0,3,0,0,0,0],
  [1,0,0,3,0,0,0,1,0,0,0,3,0,0,1],
  [0,0,3,0,0,0,1,0,1,0,0,0,3,0,0],
  [0,3,0,0,0,2,0,0,0,2,0,0,0,3,0],
  [4,0,0,1,0,0,0,4,0,0,0,1,0,0,4],
];

const LETTER_VALUES = {
  A:1,B:3,C:4,Ç:4,D:3,E:1,F:7,G:5,Ğ:8,H:5,I:2,İ:1,J:10,K:1,L:1,M:2,N:1,O:2,Ö:7,P:5,R:1,S:2,Ş:4,T:1,U:2,Ü:3,V:7,Y:3,Z:4
};

function emptyBoard() {
  return Array.from({length: SIZE}, () => Array(SIZE).fill(null));
}

function emptyStarBoard() {
  return Array.from({length: SIZE}, () => Array(SIZE).fill(0));
}

function boardHasAnyLetter(committed) {
  for (let r=0;r<SIZE;r++){
    for (let c=0;c<SIZE;c++){
      const t=committed[r][c];
      if(t && t.letter) return true;
    }
  }
  return false;
}

function displayLetter(tile){
  if(!tile) return "";
  if(tile.blank && tile.jokerLetter) return tile.jokerLetter;
  return tile.letter || "";
}

// ... diğer fonksiyonlar (pendingPlayCells, mergedBoard, expandHorizontal/Vertical, validateTurn, scoreWords) aynen senin verdiğin şekilde.

window.Kelimelik = {
  SIZE,
  CENTER,
  PREMIUM,
  LETTER_VALUES,
  emptyBoard,
  emptyStarBoard,
  boardHasAnyLetter,
  displayLetter,
};
})();