const { createCanvas } = require('canvas');
const EventEmitter = require('events');

class CanvasManager extends EventEmitter {
    constructor(streamDeck, width, height) {
        super();
        this.streamDeck = streamDeck;
        this.canvas = createCanvas(width, height);
        this.ctx = this.canvas.getContext('2d');
        this.animationFrameRequested = false;
        this.isAnimating = false;

        this.lastBuffer = new Buffer.alloc(0);
    }

    fillLCDScreen(r, g, b) {
        this.ctx.fillStyle = `rgb(${r},${g},${b})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.stroke();
    }

    #convertBGRAtoRGBA(buffer) {
        for (let i = 0; i < buffer.length; i += 4) {
            let red = buffer[i];
            buffer[i] = buffer[i + 2];
            buffer[i + 2] = red;
        }
        return buffer;
    }

    #areBuffersEqual(buf1, buf2) {
        if (buf1.length !== buf2.length) {
            return false;
        }
        for (let i = 0; i < buf1.length; i++) {
            if (buf1[i] !== buf2[i]) {
                return false;
            }
        }
        return true;
    }

    async updateStreamDeck() {
        const buffer = this.canvas.toBuffer('raw');
        const bufferRGBA = this.#convertBGRAtoRGBA(buffer);
        if(this.#areBuffersEqual(bufferRGBA, this.lastBuffer)) {
            return;
        }
        this.lastBuffer = bufferRGBA;
        await this.streamDeck.fillLcdRegion(0, 0, bufferRGBA, {
            width: this.canvas.width,
            height: this.canvas.height,
            offset: 0,
            format: 'rgba',
        });
        if(process.env.LOG_SCREENUPDATES == "true") process.log.debug('Updated StreamDeck');
    }

    getCanvas() {
        return this.canvas;
    }

    getContext() {
        return this.ctx;
    }

    requestAnimationFrame(callback) {
        if (typeof performance === 'undefined') {
            global.performance = { now: require('perf_hooks').performance.now };
        }
    
        this.isAnimating = true;
        this.drawCallback = callback;
    
        if (!this.animationFrameRequested) {
            this.animationFrameRequested = true;
            this.lastFrameTime = performance.now();
    
            const animate = async () => {
                const now = performance.now();
                const deltaTime = now - this.lastFrameTime;
                this.lastFrameTime = now;
                const fps = deltaTime > 0 ? 1000 / deltaTime : 0;
    
                this.emit('fps', fps);
    
                // Draw
                await this.drawCallback();
                await this.updateStreamDeck();
    
                if (this.isAnimating) {
                    this.animationFrameRequested = false;
                    setTimeout(animate, 1); // Slight delay to smooth out the frame rate
                }
            };
    
            animate(); // Start the loop
        }
    }
    


    stopAnimation() {
        this.isAnimating = false;
    }
}

module.exports = CanvasManager;