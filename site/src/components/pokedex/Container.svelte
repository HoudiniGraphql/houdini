<div id="pokedex">
	<div id="left-panel" class="panel">
		<slot name="left" />
	</div>
	<div id="middle-panel" class="panel">
		<div id="divider">
			<div class="gap" />
			<div class="hinge" />
			<div class="gap" />
			<div class="hinge" />
			<div class="gap" />
			<div class="hinge" />
			<div class="gap" />
		</div>
	</div>
	<div id="right-panel" class="panel">
		<slot name="right" />
	</div>
	<div>
		<div id="ball-highlight" />
		<div id="ball" />
		<div id="highlights">
			<div class="highlight" />
			<div class="highlight" />
			<div class="highlight" />
		</div>
		<div id="light-container">
			<div id="red-light" class="light" />
			<div id="yellow-light" class="light" />
			<div id="green-light" class="light" />
		</div>
		<div id="left-header" />
		<div id="left-cap" />
		<div id="left-cap-border" />
		<div id="left-cap-shadow" />
		<div id="right-cap" />
		<div id="right-cap-shadow" />
		<div id="outer-line" />
		<div id="border-spacing" />
		<div id="inner-border" />
		<div id="top-left-corner" class="corner" />
		<div id="middle-corner" class="corner" />
		<div id="bottom-right-corner" class="corner" />
		<div id="bottom-left-corner" class="corner" />
		<div id="right-panel-shadow" />
		<div id="background" />
	</div>
</div>

<style>
	#pokedex {
		display: flex;
		flex-direction: row;
		height: 600px;
		width: 800px;
		flex-shrink: 0;
		align-items: flex-end;
		margin: 0 auto;
		margin-top: 100px;
		position: relative;
	}

	#left-panel,
	#divider,
	#right-panel {
		background-color: var(--pokedex-red);
	}

	#divider {
		height: calc(90% + 23px);
		display: flex;
		flex-direction: column;
		align-items: center;
		border: inset #460f0f 4px;
		background: #460f0f;
		border-top-width: 3px;
		margin-bottom: -10px;
		border-bottom-color: black;
		border-bottom-width: 2px;
	}

	#left-panel {
		width: 10px;
		flex-grow: 1;
		border-bottom-left-radius: 5px;
		padding: 16px;
		padding-top: 13px;
		padding-left: 12px;
		margin-right: 4px;
		box-sizing: border-box;
		height: 81%;
		background-color: var(--pokedex-red);
	}

	#right-panel {
		width: 10px;
		height: 80%;
		flex-grow: 1;
		padding: 1em;
		box-sizing: border-box;
		margin-top: -30px;
		border-bottom-right-radius: 5px;
		display: flex;
		flex-direction: column;
		gap: 30px;
	}

	#right-panel *:not(#cap) {
		z-index: 10;
	}

	#middle-panel {
		height: 100%;
		width: 30px;
		display: flex;
		justify-content: flex-end;
		flex-direction: column;
		border-top-right-radius: 10px;
	}

	.panel {
		z-index: 10;
		display: flex;
		flex-direction: column;
	}

	#divider > * {
		border-radius: 4px;
		border: solid #2d0d0d 2px;
	}

	.gap {
		background-color: #b31818;
		border-top-color: #891313 !important;
		border-right-color: #b31818 !important;
		flex: 1;
		width: 95%;
	}
	.gap:first-child {
		border-radius: 0 0 5px 5px;
		border-top: none;
	}
	.gap:last-child {
		border-radius: 5px 5px 0 0;
	}

	.hinge {
		background: #e61515;
		border-right-color: #fd5555 !important;
		border-top-color: #fd5555 !important;
		flex: 10;
		width: 100%;
		border-left-color: #5f1010 !important;
	}

	#right-cap {
		height: 128px;
		position: absolute;
		left: calc(50% + 15px);
		right: 0px;
		bottom: 70%;
		clip-path: polygon(
			0% 1px,
			calc(30% + 2px) 1%,
			calc(60% - 2px) calc(49.8% + 1px),
			97% calc(49.8% + 1px),
			100% 62%,
			100% 100%,
			0% 100%
		);
		background: var(--pokedex-red);
		z-index: 5;
	}

	#right-cap-shadow {
		height: calc(21%);
		position: absolute;
		left: calc(50% + 15px);
		right: 3px;
		bottom: calc(70% + 3px);
		clip-path: polygon(
			0% 1px,
			calc(30% + 1px) 1%,
			calc(60.1% - 1px) calc(49.8% + 3px),
			101% calc(49.8% + 3px),
			100% 62%,
			99% 99%,
			calc(90% - 15px) 100%,
			calc(30% + 1px) 4%,
			0 4%
		);
		background: var(--pokedex-shadow);
		z-index: 6;
	}

	#outer-line {
		position: absolute;
		background: black;
		left: -10px;
		right: -10px;
		top: -10px;
		bottom: -10px;
		clip-path: polygon(
			/* top of left panel */ 3% 0%,
			49% 0%,
			calc(50% + 15px) 3%,
			calc(50% + 15px) calc(10% - 9px),
			/* right panel */ calc(65% + 10px) calc(10% - 9px),
			80% calc(19% - 1px),
			100% calc(19% - 1px),
			/* bottom line */ 100% 97%,
			97% 100%,
			3% 100%,
			0% 97%,
			0% 3%
		);
	}

	#border-spacing {
		position: absolute;
		background: var(--pokedex-red);
		left: -7px;
		right: -7px;
		top: calc(-7px - 0.1%);
		bottom: -7px;
		clip-path: polygon(
			/* top of left panel */ calc(3% - 4px) 0%,
			calc(48% + 3px) 0%,
			calc(49.1% + 18px) calc(3%),
			calc(49.1% + 18px) calc(10% - 8px),
			calc(49% + 22px) calc(10% - 8px),
			/* right panel */ calc(65% + 10px) calc(10% - 8px),
			calc(80% + 1px) calc(19% + 0px),
			100% calc(19%),
			/* bottom line */ 100% calc(97% + 3px),
			calc(97% + 3px) 100%,
			calc(3% - 3px) 100%,
			0% calc(97% + 3px),
			0% calc(3% - 3px)
		);
		z-index: 2;
	}

	#inner-border {
		position: absolute;
		background: black;
		left: -4px;
		right: -3px;
		top: -4px;
		bottom: -3px;
		clip-path: polygon(
			/* top of left panel */ calc(3% - 3px) 1px,
			calc(48.3% + 20px) 1px,
			calc(48.3% + 20px) calc(10% - 7px),
			/* right panel */ calc(65% + 12px) calc(10% - 7px),
			calc(80% + 2px) calc(19% + 2px),
			100% calc(19% + 2px),
			/* bottom line */ 100% calc(97% + 3px),
			calc(97% + 3px) 100%,
			50% 100%,
			1px calc(3% - 3px)
		);
		z-index: 3;
	}

	#top-left-corner {
		top: -10px;
		left: -10px;
		clip-path: polygon(0 0, 50% 0, 50% 50%, 0 50%);
		border: 3px solid black;
	}

	#bottom-right-corner {
		bottom: -10px;
		right: -10px;
		clip-path: polygon(100% 50%, 100% 100%, 50% 100%, 50% 50%);
		border: 10px double black;
	}

	#middle-corner {
		top: -10px;
		right: calc(50% - 15px);
		clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 50% 50%);
		border: 3px solid black;
	}

	#bottom-left-corner {
		bottom: -10px;
		left: -10px;
		clip-path: polygon(0% 50%, 50% 50%, 50% 100%, 0% 100%);
		border: 3px solid black;
	}

	.corner {
		background-color: var(--pokedex-red);
		height: 50px;
		width: 50px;
		border-radius: 13px;

		position: absolute;
		z-index: 5;
	}

	#left-cap {
		height: 128px;
		position: absolute;
		right: calc(50% + 14px);
		left: 0px;
		bottom: calc(70% + 3px);
		clip-path: polygon(
			0% 1px,
			calc(30% + 2px) 1%,
			calc(60% - 2px) calc(49.8% + 1px),
			100% calc(49.8% + 1px),
			100% 62%,
			100% 100%,
			0% 100%
		);
		background: var(--pokedex-red);
		z-index: 5;
		transform: scaleX(-1);
	}

	#left-cap-shadow {
		height: 128px;
		position: absolute;
		right: calc(50% + 15px);
		left: -7px;
		bottom: calc(70% + 10px);
		clip-path: polygon(
			0% 3px,
			calc(30% + 1px) 2%,
			calc(60% - 4px) calc(49.8% + 2px),
			100% calc(49.8% + 2px),
			100% 62%,
			100% 56.4%,
			0% 56.4%
		);
		background: var(--pokedex-shadow);
		z-index: 4;
		transform: scaleX(-1);
	}

	#left-cap-border {
		height: calc(12% - 5px);
		position: absolute;
		right: calc(50% - 15px);
		left: calc(-6px - 0.2%);
		top: 41px;
		background: black;
		z-index: 4;
		clip-path: polygon(
			100% 0,
			100% 100%,
			0 100%,
			0 calc(100% - 4px),
			37.9% calc(100% - 4px),
			64.5% 0
		);
	}

	#left-header {
		height: calc(18% + 3px);
		position: absolute;
		right: calc(49.9% - 12px);
		left: calc(-6px - 0.2%);
		top: -4px;
		background: var(--pokedex-red);
		z-index: 4;
		transform: scaleX(-1);
	}

	#right-panel-shadow {
		position: absolute;
		background-color: var(--pokedex-shadow);
		right: 0;
		bottom: 0;
		top: calc(20% - 3px);
		width: 4px;
		z-index: 12;
		border-bottom-right-radius: 12px;
	}

	#ball {
		position: absolute;
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background-color: #429bd3;
		top: 10px;
		left: 20px;
		z-index: 10;
		border: 7px solid #d8d8d8;
		outline: 3px solid black;
	}

	#ball-highlight {
		position: absolute;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background-color: #90c3e2;
		top: 24px;
		left: 35px;
		z-index: 11;
	}

	#light-container {
		position: absolute;
		top: 10px;
		left: 105px;
		height: 20px;
		width: 100px;
		display: flex;
		flex-direction: row;
		z-index: 12;
	}

	.light {
		height: 15px;
		width: 15px;
		border-radius: 50%;
		margin-right: 10px;
		border: 2px solid black;
	}

	#red-light {
		background: rgb(167, 3, 3);
	}

	#yellow-light {
		background: rgb(250, 226, 10);
	}

	#green-light {
		background: rgb(16, 145, 33);
	}

	#highlights {
		position: absolute;
		top: 15px;
		left: 111px;
		height: 20px;
		width: 100px;
		display: flex;
		flex-direction: row;
	}

	.highlight {
		height: 4px;
		width: 4px;
		border-radius: 50%;
		margin-right: 25px;
		background: rgba(255, 255, 255, 0.5);
		z-index: 13;
	}

	#background {
		position: absolute;
		top: 28%;
		left: 10px;
		right: 10px;
		bottom: 10px;
		background: var(--pokedex-red);
		z-index: 3;
	}
</style>
