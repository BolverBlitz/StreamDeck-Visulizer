const audio = require('@lib/audio_utils');
const WebSocket = require('ws');

class AudioAdapter {
    constructor() {
        this.inAudio = null;

        this.isConnected = false;
        this.device = null;

        this.subscribeToAudioStream = null;
        this.sampleRate = 0;
        this.frameSize = 0;
        this.audioDeviceID = 0;

        this.reconnectInterval = 1000;

        this.shouldDraw = false;
        this.visualizerMode = 1;
        this.ctx = null;
        this.canvas = null;
        this.canvasManager = null;

        this.#connect();

        // Store Values for the visualizer(s)
        this.peaks = [];
        this.peakColor = 'rgb(255,0,0)';
        this.midColor = 'rgb(255,255,0)';
        this.lowColor = 'rgb(0,255,0)';
    }

    #connect() {
        this.ws = new WebSocket(`ws://localhost:${process.env.AUDIO_WS_PORT}/audioStream`);

        this.ws.on('open', () => {
            this.isConnected = true;
            process.log.info(`Connected to audio server (${`localhost:${process.env.AUDIO_WS_PORT}`})`);
            this.ws.send(JSON.stringify({ type: 'getDevices' }));
            if (this.subscribeToAudioStream) this.ws.send(this.subscribeToAudioStream);
        });

        this.ws.on('close', () => {
            this.isConnected = false;
            process.log.error('Connection to audio server closed');
            this.#reconnect();
        });

        this.ws.on('error', (err) => {
            process.log.error(err);
            console.log(err)
            this.ws.close(); // Close the connection to trigger reconnect
        });

        this.ws.on('message', (msg) => {
            const { type, data } = JSON.parse(msg);
            if (type === 'streaming') this.#visualize(data)
            if (type === 'devices') this.audioDevices = data;
        });
    }

    #reconnect() {
        if (!this.isConnected) {
            process.log.warn(`Reconnecting in ${this.reconnectInterval / 1000} seconds to ${`ws://localhost:${process.env.AUDIO_WS_PORT}/audioStream`}`);
            setTimeout(() => {
                this.#connect();
            }, this.reconnectInterval);
        }
    }

    /**
     * Returns the id of the device with the given name
     * @param {String} name Name of the device
     * @param {Array} array Array of devices
     * @returns 
     */
    #findIdByName(name, array) {
        const obj = array.find(o => o.name === name);
        return obj ? obj.id : null;
    }

    #createGradientColor() {
        let gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, this.peakColor);
        gradient.addColorStop(0.5, this.midColor);
        gradient.addColorStop(1, this.lowColor);
        return gradient;
    }

    #drawSpectrum(data) {
        const { analyzer, AmplituteMultiplayer } = data;
        // Filter out bars with 0 amplitude
        let filteredData = analyzer.filter(amp => amp > 0);

        // Clear the canvas before each draw
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Determine the width of each bar
        let barWidth = this.canvas.width / filteredData.length;

        // Iterate through the filtered data to draw each bar
        for (let i = 0; i < filteredData.length; i++) {
            // Determine the height of the bar based on the data
            let barHeight = filteredData[i] * AmplituteMultiplayer;

            // Determine the position of the bar on the canvas
            let x = barWidth * i;
            let y = this.canvas.height - barHeight;

            // Set the bar color as a gradient
            this.ctx.fillStyle = this.#createGradientColor(barHeight);

            // Draw the bar
            this.ctx.fillRect(x, y, barWidth, barHeight);

            // Update the peak value
            if (this.peaks[i] === undefined || barHeight > this.peaks[i]) {
                this.peaks[i] = barHeight;
            }

            // Draw the peak line
            this.ctx.strokeStyle = this.peakColor;
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.canvas.height - this.peaks[i]);
            this.ctx.lineTo(x + barWidth, this.canvas.height - this.peaks[i]);
            this.ctx.stroke();

            // Reduce the peak value slowly
            this.peaks[i] *= 0.98;
        }

        this.canvasManager.updateStreamDeck(); // Write changes to the StreamDeck
    }

    #drawWaveform(data) {
        const { waveform } = data;
        // Clear the canvas before each draw
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Set the line color
        this.ctx.strokeStyle = 'white';

        // Set the line width
        this.ctx.lineWidth = 2;

        // Begin drawing the waveform
        this.ctx.beginPath();

        // Calculate the width of each segment
        let segmentWidth = this.canvas.width / waveform.length;

        // Iterate through the waveform data to draw the waveform
        for (let i = 0; i < waveform.length; i++) {
            // Calculate the height of the segment
            let segmentHeight = waveform[i] / 32767 * this.canvas.height / 2;

            // Calculate the x and y coordinates of the segment
            let x = segmentWidth * i;
            let y = this.canvas.height / 2 + segmentHeight;

            // Draw the segment
            this.ctx.lineTo(x, y);
        }

        // End drawing the waveform
        this.ctx.stroke();

        this.canvasManager.updateStreamDeck(); // Write changes to the StreamDeck
    }

    #visualize(data) {
        /* Audio Data Format
        averageFrequency: 0,
        dominantFrequency: { frequency: 0, amplitude: 0.00521866512039552 },
        bassAmplitude: 0.015609998859942818,
        rms_db: -95.68416869605997,
        closestNote: 'A0',
        analyzer: [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        AmplituteMultiplayer: 8,
        waveform: [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        */
        if (!this.shouldDraw) return;
        switch (this.visualizerMode) {
            case 0:
                this.#drawSpectrum(data);
                break;
            case 1:
                this.#drawWaveform(data);
            default:
                break;
        }
    }

    /**
     * Start the visualizer
     * @param {ctx} ctx 
     * @param {canvas} canvas
     * @param {InstanceType} canvasManager
     */
    startVisualizer(ctx, canvas, canvasManager) {
        process.log.info('Starting audio visualizer');
        this.shouldDraw = true;

        this.ctx = ctx;
        this.canvas = canvas;
        this.canvasManager = canvasManager;
    }

    /**
     * Stop the visualizer
     */
    stopVisualizer() {
        process.log.info('Stopping audio visualizer');
        this.shouldDraw = false;

        this.ctx = null;
        this.canvas = null;
        this.canvasManager = null;
    }

    /**
     * 
     * @param {ctx} ctx 
     * @param {canvas} canvas 
     * @param {InstanceType} canvasManager 
     * @returns 
     */
    selectDevice(ctx, canvas, canvasManager) {
        return new Promise(async (resolve, reject) => {
            try {
                // wait here until we have the devices
                while (!this.audioDevices) await new Promise(resolve => setTimeout(resolve, 100)); // Check every 100 milliseconds
                // Find all output devices, filter them a bit and make sure they fit on the screen
                const out_devices_name = this.audioDevices.map(device => { if (device.name.length > 42) { return device.name.substring(0, 42) + '...'; } else { return device.name; } });
                let offset = 0; // Roteryencoder offset

                const drawNames = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
                    ctx.fillStyle = "white";
                    ctx.textAlign = "left";
                    ctx.font = "20px Arial";

                    let startIndex = Math.floor(offset) % out_devices_name.length;
                    if (startIndex < 0) startIndex += out_devices_name.length; // Ensure positive index

                    for (let i = 0; i < 3; i++) {
                        let nameIndex = (startIndex + i) % out_devices_name.length;
                        let x = 20; // Fixed X position
                        let y = canvas.height / 2 + (i - 1) * 30; // Adjust Y position

                        ctx.globalAlpha = i === 0 || i === 2 ? 0.5 : 1;
                        ctx.fillText(out_devices_name[nameIndex], x, y);
                    }

                    canvasManager.updateStreamDeck();
                }

                const rotate = (amount, direction) => {
                    offset += direction * amount;
                    drawNames();
                }

                const getPositiveModulo = (n, m) => {
                    return ((n % m) + m) % m;
                }

                const onRotateLeft = (index, amount) => {
                    if (index === 0) rotate(amount, -1);
                }

                const onRotateRight = (index, amount) => {
                    if (index === 0) rotate(amount, 1);
                }

                const onEncoderPress = (index) => {
                    if (index === 0) {
                        // Clean up
                        process.streamDeck.removeAllListeners('rotateLeft');
                        process.streamDeck.removeAllListeners('rotateRight');
                        process.streamDeck.removeAllListeners('encoderDown');
                        // Return selected device
                        let index = getPositiveModulo(Math.floor(offset), out_devices_name.length);
                        let resolvedIndex = (index + 1) % out_devices_name.length;
                        const audioDeviceID = this.#findIdByName(this.audioDevices[resolvedIndex].name, this.audioDevices);

                        // Set the sample rate to the default sample rate of the device
                        const sampleRate = audio.getDefaultSampleRate(this.audioDevices, audioDeviceID);
                        // This is the size of the buffer that will be filled when calling read()
                        const frameSize = audio.calculateFrameSize(sampleRate, 30);

                        process.log.system(`Selected device: ${this.audioDevices[resolvedIndex].name} with ID: ${audioDeviceID}`);


                        this.sampleRate = sampleRate;
                        this.frameSize = frameSize;
                        this.audioDeviceID = audioDeviceID;

                        this.subscribeToAudioStream = JSON.stringify({ type: 'subscribe', data: { sampleRate: this.sampleRate, frameSize: this.frameSize, audioDeviceID: this.audioDeviceID } })

                        this.ws.send(this.subscribeToAudioStream);

                        resolve();
                    }
                }

                process.streamDeck.on('rotateLeft', onRotateLeft)
                process.streamDeck.on('rotateRight', onRotateRight)
                process.streamDeck.on('encoderDown', onEncoderPress)

                drawNames(); // Initial draw
            } catch (err) {
                reject(err);
            }
        });
    }
}

module.exports = AudioAdapter;