<div align="center">
	<p>
	   <img src="https://owen.cafe/res/hexplode.svg" height="150">
	</p>
	<h1>Hexvg</h1>
</div>

Hexplode is a turn-based strategy game with a simple ruleset.

You can [try it online](https://owen.cafe/hex.svg).

<aside class="warning">
Warning, the current version only works properly in Chrome.
</aside>

## Rules

* Each turn a player adds one piece to a cell. This cell can be empty or have
  the player's pieces on it already.
* When a cell contains as many pieces as neighbouring cells, each neighbour
  receives a piece from the donor cell, and pieces already on the neighbour are
  transferred to the current player, and stay on their cell.
* The above process can cause chain reactions.
* To win, a player must eliminate other all other players from the board.
