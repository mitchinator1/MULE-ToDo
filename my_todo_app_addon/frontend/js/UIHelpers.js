export class StyleManager {
	static styleSheets = new Map();

	static addStyles(id, styles, scope = '') {
		if (!this.styleSheets.has(id)) {
			const styleElement = document.createElement('style');
			styleElement.textContent = styles;
			document.head.appendChild(styleElement);
			this.styleSheets.set(id, styleElement);
		}
	}

	static removeStyles(id) {
		const styleElement = this.styleSheets.get(id);
		if (styleElement) {
			styleElement.remove();
			this.styleSheets.delete(id);
		}
	}
}

export class Snackbar {
	static styleId = 'snackbar-styles';
	static instance = null;

	static initStyles() {
		if (!StyleManager.styleSheets.has(this.styleId)) {
			const styles = `
				.snackbar {
					display: flex;
					min-width: 250px;
					background-color: #4B286D;
					color: #fff;
					text-align: center;
					border-radius: 4px;
					padding: 16px;
					position: fixed;
					z-index: 1000;
					left: 50%;
					bottom: 30px;
					font-size: 17px;
					transform: translateX(-50%);
					justify-content: center;
					align-items: center;
					opacity: 0;
					transition: all 0.5s ease;
				}
				.snackbar.show { opacity: 1; }
				.snackbar.hide { opacity: 0; }
				.snackbar.success { background-color: #43a047; }
				.snackbar.warning { background-color: #e6e600; color: #000; }
				.snackbar.error { background-color: #d32f2f; }
			`;
			StyleManager.addStyles(this.styleId, styles);
		}
	}

	static show(text, options = {}) {
		const defaults = { duration: 1.5, type: 'default', position: 'bottom' };
		const settings = { ...defaults, ...options };
		this.initStyles();

		if (this.instance) {
			this.instance.remove();
		}

		const snackbar = document.createElement('div');
		snackbar.className = `snackbar ${settings.type}`;
		snackbar.textContent = text;
		if (settings.position === 'top') {
			snackbar.style.bottom = 'auto';
			snackbar.style.top = '30px';
		}
		document.body.appendChild(snackbar);
		this.instance = snackbar;

		snackbar.offsetHeight;
		requestAnimationFrame(() => {
			snackbar.classList.add('show');
			setTimeout(() => {
				snackbar.classList.add('hide');
				snackbar.addEventListener('transitionend', () => {
					if (snackbar.parentNode) {
						snackbar.remove();
						if (this.instance === snackbar) {
							this.instance = null;
						}
					}
				}, { once: true });
			}, settings.duration * 1000);
		});
	}
}

export class Throbber {
	static styleId = 'throbber-styles';
	static instances = new Map();

	static initStyles() {
		if (!StyleManager.styleSheets.has(this.styleId)) {
			const styles = `
		/* Common styles */
		.throbber-container {
			text-align: initial;
			border: none;
			display: flex;
			justify-content: center;
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background-color: rgba(255, 255, 255, 0.7);
			z-index: 1000;
			opacity: 0;
			transition: opacity 0.3s ease-in-out;
		}
		.throbber-container .throbber {
			position: absolute;
			top: 75%;
		}
		.throbber-container-inline {
			text-align: initial;
			border: none;
			display: flex;
			justify-content: center;
			align-items: center;
			position: fixed;
			padding: 12px;
			background-color: rgba(255, 255, 255, 0.9);
			border-radius: 4px;
			box-shadow: 0 2px 4px rgba(0,0,0,0.1);
			z-index: 1000;
			opacity: 0;
			transition: opacity 0.3s ease-in-out;
		}

		.throbber-container.show, .throbber-container-inline.show {
			opacity: 1;
		}

		/* Positioning styles for inline mode */
		.throbber-container-inline[data-position="top-left"] {
			top: 16px; left: 16px;
		}

		.throbber-container-inline[data-position="top-middle"] {
			top: 16px; left: 50%; transform: translateX(-50%);
		}

		.throbber-container-inline[data-position="top-right"] {
			top: 16px; right: 16px;
		}

		.throbber-container-inline[data-position="bottom-left"] {
			bottom: 16px; left: 16px;
		}

		.throbber-container-inline[data-position="bottom-middle"] {
			bottom: 16px; left: 50%; transform: translateX(-50%);
		}

		.throbber-container-inline[data-position="bottom-right"] {
			bottom: 16px; right: 16px;
		}

		.throbber-container-inline .throbber {
			position: relative;
			top: initial;
		}
		.throbber {
			--uib-size: 40px;
			--uib-color: black;
			--uib-speed: 1.5s;
			position: relative;
			display: flex;
			align-items: center;
			justify-content: center;
			height: var(--uib-size);
			width: var(--uib-size);
		}
		.throbber-message {
			margin-right: 12px;
			font-size: 14px;
			color: var(--uib-color);
		}
		.throbber-message.minimal {
			font-size: 12px;
			opacity: 0.8;
		}

		/* Rotate Animation */
		.throbber-rotate {
			animation: throbber-smoothRotate calc(var(--uib-speed) * 1.8) linear infinite;
		}
		.throbber-rotate .throbber-dot {
			position: absolute;
			top: 0;
			left: 0;
			display: flex;
			align-items: flex-start;
			justify-content: center;
			height: 100%;
			width: 100%;
			animation: throbber-rotate var(--uib-speed) ease-in-out infinite;
		}
		.throbber-rotate .throbber-dot::before {
			content: '';
			height: calc(var(--uib-size) * 0.17);
			width: calc(var(--uib-size) * 0.17);
			border-radius: 50%;
			background-color: var(--uib-color);
			transition: background-color 0.3s ease;
		}

		.throbber-rotate .throbber-dot:nth-child(2) {
			animation-delay: calc(var(--uib-speed) * -0.835 * 0.5);
		}

		.throbber-rotate .throbber-dot:nth-child(3) {
			animation-delay: calc(var(--uib-speed) * -0.668 * 0.5);
		}

		.throbber-rotate .throbber-dot:nth-child(4) {
			animation-delay: calc(var(--uib-speed) * -0.501 * 0.5);
		}

		.throbber-rotate .throbber-dot:nth-child(5) {
			animation-delay: calc(var(--uib-speed) * -0.334 * 0.5);
		}

		.throbber-rotate .throbber-dot:nth-child(6) {
			animation-delay: calc(var(--uib-speed) * -0.167 * 0.5);
		}

		@keyframes throbber-rotate {
			0% { transform: rotate(0deg); }
			65%, 100% { transform: rotate(360deg); }
		}
		@keyframes throbber-smoothRotate {
			0% { transform: rotate(0deg); }
			100% { transform: rotate(360deg); }
		}

		/* Pulse Animation */
		.throbber-pulse {
		width: auto;
		height: var(--uib-size);
		display: flex;
		justify-content: center;
		align-items: center;
		gap: calc(var(--uib-size) * 0.15);
		}
		.throbber-pulse .throbber-dot {
		width: calc(var(--uib-size) * 0.25);
		height: calc(var(--uib-size) * 0.25);
		border-radius: 50%;
		background-color: var(--uib-color);
		animation: pulse-animation var(--uib-speed) ease-in-out infinite;
		}

		@keyframes pulse-animation {
		0%, 100% { transform: scale(0.5); opacity: 0.3; }
		50% { transform: scale(1); opacity: 1; }
		}
		/* Bounce Animation */
		.throbber-bounce {
		width: auto;
		height: var(--uib-size);
		display: flex;
		justify-content: center;
		align-items: flex-end;
		gap: calc(var(--uib-size) * 0.15);
		}
		.throbber-bounce .throbber-dot {
		width: calc(var(--uib-size) * 0.25);
		height: calc(var(--uib-size) * 0.25);
		border-radius: 50%;
		background-color: var(--uib-color);
		animation: bounce-animation var(--uib-speed) ease-in-out infinite;
		}
		@keyframes bounce-animation {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(calc(var(--uib-size) * -0.75)); }
		}
		`;
			StyleManager.addStyles(this.styleId, styles);
		}
	}

	static show(id, options = {}) {
		const defaults = {
			color: 'black',
			size: '40px',
			speed: '1.5s',
			dotCount: 6,
			mode: 'blocking', // 'blocking' | 'inline'
			position: 'bottom-middle', // combination of bottom | top + left | middle | right
			message: '',
			messageStyle: 'default', // 'default' | 'minimal'
			animation: 'rotate', // 'rotate' | 'pulse' | 'bounce'
		};
		const settings = { ...defaults, ...options };
		this.initStyles();

		if (this.instances.has(id)) return;

		const container = document.createElement('div');
		container.className = settings.mode === 'blocking' ? 'throbber-container' : 'throbber-container-inline';
		if (settings.mode === 'inline') container.dataset.position = settings.position;

		if (settings.message) {
			const messageEl = document.createElement('div');
			messageEl.className = `throbber-message ${settings.messageStyle}`;
			messageEl.textContent = settings.message;
			container.appendChild(messageEl);
		}

		const throbber = document.createElement('div');
		throbber.className = `throbber throbber-${settings.animation}`;
		throbber.style.setProperty('--uib-color', settings.color);
		throbber.style.setProperty('--uib-size', settings.size);
		throbber.style.setProperty('--uib-speed', settings.speed);

		for (let i = 0; i < settings.dotCount; i++) {
			const dot = document.createElement('div');
			dot.className = 'throbber-dot';
			const delay = settings.animation === 'rotate'
				? -0.167 * (settings.dotCount - i) * 0.5
				: (i / settings.dotCount) * 0.5;
			dot.style.animationDelay = `calc(var(--uib-speed) * ${delay})`;
			throbber.appendChild(dot);
		}

		if (settings.animation !== 'rotate') {
			const totalWidth =
				(parseFloat(settings.size) * 0.25 * settings.dotCount) +
				(parseFloat(settings.size) * 0.15 * (settings.dotCount - 1));
			throbber.style.width = `${totalWidth}px`;
		}

		container.appendChild(throbber);
		document.body.appendChild(container);

		// Add to instances map before showing to prevent race conditions
		this.instances.set(id, container);

		// Use requestAnimationFrame to ensure the transition happens on the next frame
		requestAnimationFrame(() => {
			container.classList.add('show');
		});
	}

	static hide(id) {
		const throbber = this.instances.get(id);
		if (throbber) {
			throbber.classList.remove('show'); // This triggers the fade-out
			throbber.addEventListener('transitionend', () => {
				throbber.remove();
				this.instances.delete(id);
			}, { once: true });
		}
	}
}

export const debounce = (func, delay) => {
	let timeoutId;
	return function (...args) {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => func.apply(this, args), delay);
	};
};