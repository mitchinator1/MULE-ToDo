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
			const styles = `/* PASTE your existing Throbber CSS here */`;
			StyleManager.addStyles(this.styleId, styles);
		}
	}

	static show(id, options = {}) {
		const defaults = {
			color: 'black', size: '40px', speed: '1.5s', dotCount: 6,
			mode: 'blocking', position: 'bottom-middle',
			message: '', messageStyle: 'default', animation: 'rotate',
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
		this.instances.set(id, container);
	}

	static hide(id) {
		const throbber = this.instances.get(id);
		if (throbber) {
			throbber.remove();
			this.instances.delete(id);
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