export class HourglassFavicon {
    constructor() {
        // Config
        this.canvas = document.createElement('canvas');
        this.canvas.width = 32;
        this.canvas.height = 32;
        this.ctx = this.canvas.getContext('2d');

        // Link
        this.faviconLink = document.querySelector("link[rel*='icon']") || document.createElement('link');
        this.faviconLink.type = 'image/x-icon';
        this.faviconLink.rel = 'shortcut icon';
        document.getElementsByTagName('head')[0].appendChild(this.faviconLink);

        // State
        this.sandLevel = 1.0;
        this.rotationAngle = 0;
        this.isFlipping = false;

        // Control
        this.state = 'stopped'; // 'running', 'paused', 'stopped'
        this.enabled = true;
        this.reqId = null;

        // Style Constants from Image
        this.colors = {
            wood: '#8D6E63',     // Brown frame
            woodOutline: '#4E342E', // Dark brown outline
            glassBg: '#F1F8E9',  // Very light greenish/off-white
            glassOutline: '#5D4037', // Dark brown glass outline
            sand: '#C5A582',     // Slightly darker beige for depth
            sandFill: '#D2B48C', // Tan (darker than previous #E6D0B3) for contrast against white
            highlight: 'rgba(255, 255, 255, 0.4)'
        };

        // Draw initial state (Sand at bottom)
        this.sandLevel = 0; // Sand at bottom
        this.draw();
        this.sandLevel = 1.0; // Reset for animation start
    }

    setEnabled(val) {
        this.enabled = val;
        if (!val) {
            this.stop();
        }
    }

    start() {
        if (!this.enabled || this.state === 'running') return;
        this.state = 'running';
        if (!this.reqId) this.animate();
    }

    pause() {
        if (!this.enabled) return;
        this.state = 'paused';
        if (!this.reqId) this.animate();
    }

    stop() {
        this.state = 'stopped';
        this.sandLevel = 1.0;
        this.rotationAngle = 0;
        this.isFlipping = false;
        // Optionally draw once to reset favicon
        this.draw();
        // We don't necessarily cancel reqId, just let animate loop helper handle it
    }

    draw() {
        const ctx = this.ctx;
        const w = 32;
        const h = 32;

        ctx.clearRect(0, 0, w, h);
        ctx.save();

        // Rotation
        ctx.translate(w / 2, h / 2);
        ctx.rotate(this.rotationAngle);
        ctx.translate(-w / 2, -h / 2);

        // 1. Draw Glass Background (The "White" inside)
        ctx.fillStyle = this.colors.glassBg;
        ctx.beginPath();
        // Top Bulb
        ctx.moveTo(7, 5);
        ctx.bezierCurveTo(5, 14, 14, 16, 16, 16); // Left side
        ctx.bezierCurveTo(18, 16, 27, 14, 25, 5); // Right side
        ctx.lineTo(7, 5);
        // Bottom Bulb
        ctx.moveTo(7, 27);
        ctx.bezierCurveTo(5, 18, 14, 16, 16, 16);
        ctx.bezierCurveTo(18, 16, 27, 18, 25, 27);
        ctx.lineTo(7, 27);
        ctx.fill();

        // 2. Sand
        ctx.fillStyle = this.colors.sandFill;

        if (this.state === 'paused' && Math.abs(this.rotationAngle - Math.PI / 2) < 0.1) {
            // Horizontal State (Paused) - Sand "settles" to bottom (Screen Down)
            // In rotated canvas (90deg), Screen Down is Canvas Right (+X)
            // So we fill the "right" half of the bulbs (higher X values)

            // Top Bulb (Now Right)
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(7, 5);
            ctx.bezierCurveTo(5, 14, 14, 16, 16, 16);
            ctx.bezierCurveTo(18, 16, 27, 14, 25, 5);
            ctx.closePath();
            ctx.clip();
            // Fill "bottom" half (Canvas Right half). Center is roughly x=16. 
            // Actually, just fill the "lower" part relative to gravity.
            // Since rotated 90deg, gravity pulls to +X.
            // Let's assume 50% fill: Everything > x=16? 
            // The bulb width is roughly 7 to 25 (18px wide). Center 16.
            // So filling x > 16.
            ctx.fillRect(16, 0, 16, 32);
            ctx.restore();

            // Bottom Bulb (Now Left)
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(7, 27);
            ctx.bezierCurveTo(5, 18, 14, 16, 16, 16);
            ctx.bezierCurveTo(18, 16, 27, 18, 25, 27);
            ctx.closePath();
            ctx.clip();
            // Fill "bottom" half (Canvas Right half).
            // Same logic, fill x > 16.
            ctx.fillRect(16, 0, 16, 32);
            ctx.restore();

        } else {
            // Normal Vertical State

            // Top Sand
            if (this.sandLevel > 0) {
                ctx.save();
                ctx.beginPath();
                // Clip to top bulb shape
                ctx.moveTo(7, 5);
                ctx.bezierCurveTo(5, 14, 14, 16, 16, 16);
                ctx.bezierCurveTo(18, 16, 27, 14, 25, 5);
                ctx.closePath();
                ctx.clip();

                // Level
                // Full is y=5 to y=16 (height 11).
                let yLevel = 16 - (11 * this.sandLevel);
                // Draw rect 
                ctx.fillRect(0, yLevel, 32, 16 - yLevel);
                ctx.restore();
            }

            // Bottom Sand
            let bottomLevel = 1.0 - this.sandLevel;
            if (bottomLevel > 0) {
                ctx.save();
                ctx.beginPath();
                // Clip to bottom bulb shape
                ctx.moveTo(7, 27);
                ctx.bezierCurveTo(5, 18, 14, 16, 16, 16);
                ctx.bezierCurveTo(18, 16, 27, 18, 25, 27);
                ctx.closePath();
                ctx.clip();

                // Fill from bottom up
                // Bottom is y=27. Height ~11.
                let hFill = 11 * bottomLevel;

                ctx.beginPath();
                ctx.moveTo(0, 27);
                ctx.lineTo(32, 27);
                ctx.lineTo(32, 27 - hFill);
                ctx.lineTo(0, 27 - hFill);
                ctx.fill();

                ctx.restore();
            }

            // Stream - Only if actively running (not paused/lying down) and sufficient sand
            // Also don't draw stream if calculating rotation back from pause
            if (this.state === 'running' && !this.isFlipping && Math.abs(this.rotationAngle) < 0.1 && this.sandLevel > 0.02) {
                ctx.strokeStyle = this.colors.sandFill;
                ctx.lineWidth = 1.5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(16, 16);
                ctx.lineTo(16, 27 - (10 * bottomLevel));
                ctx.stroke();
            }
        }

        // 3. Glass Outline (Thick Dark Brown)
        ctx.strokeStyle = this.colors.glassOutline;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(7, 5);
        ctx.bezierCurveTo(5, 14, 14, 16, 16, 16);
        ctx.bezierCurveTo(18, 16, 27, 14, 25, 5);
        ctx.moveTo(7, 27);
        ctx.bezierCurveTo(5, 18, 14, 16, 16, 16);
        ctx.bezierCurveTo(18, 16, 27, 18, 25, 27);
        ctx.stroke();

        // 4. Wood Frame (Caps)
        ctx.fillStyle = this.colors.wood;
        ctx.strokeStyle = this.colors.woodOutline;
        ctx.lineWidth = 2;

        const drawRoundedRect = (x, y, w, h, r) => {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        };

        drawRoundedRect(4, 1, 24, 4, 2);
        drawRoundedRect(4, 27, 24, 4, 2);

        // 5. Highlights
        ctx.strokeStyle = this.colors.highlight;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(8, 7);
        ctx.quadraticCurveTo(7, 10, 9, 13);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, 20);
        ctx.quadraticCurveTo(7, 23, 9, 25);
        ctx.stroke();

        ctx.restore();

        this.faviconLink.href = this.canvas.toDataURL('image/png');
    }

    animate() {
        if (!this.enabled || this.state === 'stopped') {
            this.reqId = null;
            // Ensure we draw the 'stopped' state (upright)
            if (this.state === 'stopped' && this.rotationAngle !== 0) {
                this.rotationAngle = 0;
                this.draw();
            }
            return;
        }

        if (this.state === 'paused') {
            // Target: 90 deg (PI/2)
            const target = Math.PI / 2;
            if (Math.abs(this.rotationAngle - target) > 0.05) {
                if (this.rotationAngle < target) this.rotationAngle += 0.05;
                else this.rotationAngle -= 0.05;
            } else {
                this.rotationAngle = target;
            }
        } else if (this.state === 'running') {
            if (this.isFlipping) {
                this.rotationAngle += 0.05;
                if (this.rotationAngle >= Math.PI) {
                    this.rotationAngle = 0;
                    this.isFlipping = false;
                    this.sandLevel = 1.0;
                }
            } else {
                // If we were paused, return to 0 first
                if (this.rotationAngle > 0.05) { // using 0.05 tolerance
                    this.rotationAngle -= 0.05;
                    if (this.rotationAngle < 0) this.rotationAngle = 0;
                } else {
                    this.rotationAngle = 0;
                    this.sandLevel -= 0.005; // Adjusted speed
                    if (this.sandLevel <= 0) {
                        this.sandLevel = 0;
                        this.isFlipping = true;
                    }
                }
            }
        }

        this.draw();
        this.reqId = requestAnimationFrame(() => this.animate());
    }
}

export const faviconAnimator = new HourglassFavicon();
