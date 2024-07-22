require('module-alias/register')
require('dotenv').config()

const { openStreamDeck } = require('@elgato-stream-deck/node');
const { fork } = require('child_process');
const HID = require('node-hid');
const { log } = require('@lib/logger');
const path = require('path');
const CanvasManager = require('@lib/gfx');
const AudioAdapter = require('@lib/audio_adapter');

process.log = {};
process.log = log;

let firstDevicePath = {};

// Spawn the audioserver.js as a background process
const audioserverPath = path.join(__dirname, 'audioserver.js');
const audioserver = fork(audioserverPath);

audioserver.on('message', (msg) => {
    console.log(msg.text);
});

audioserver.on('error', (err) => {
    console.error('Failed to start audioserver.js:', err);
});

HID.devices().forEach(d => {
    if (d.manufacturer === 'Elgato' && d.product.startsWith('Stream Deck')) {
        process.log.system(`Found "${d.product} (${d.productId})" and Serial ${d.serialNumber}`);
        if (Object.entries(firstDevicePath).length === 0) firstDevicePath = d;
    }
});

(async () => {
    process.log.system(`Using first found StreamDeck: "${firstDevicePath.product} (${firstDevicePath.productId})" and Serial ${firstDevicePath.serialNumber}`);
    const streamDeck = await openStreamDeck(firstDevicePath.path);
    process.streamDeck = streamDeck;
    streamDeck.clearPanel(); // clear the StreamDeck
    //console.log(streamDeck);

    streamDeck.setBrightness(100);

    const canvasManager = new CanvasManager(streamDeck, 800, 100);
    const audioAdapter = new AudioAdapter();

    const ctx = canvasManager.getContext();
    const canvas = canvasManager.getCanvas();

    const device = await audioAdapter.selectDevice(ctx, canvas, canvasManager);
    audioAdapter.startVisualizer(ctx, canvas, canvasManager);
    //console.log(device);
    // Now you can use ctx to draw directly on the canvas.

    /*
    streamDeck.on('lcdSwipe', (index, index2, pos, pos2) => {
        ctx.beginPath();
        ctx.strokeStyle = 'rgb(255, 0, 0)';
        ctx.lineWidth = 5;
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos2.x, pos2.y);
        ctx.stroke();

        canvasManager.updateStreamDeck();
    })
    */

    canvasManager.on('fps', fps => {
        process.log.system(`FPS: ${fps}`);
    });

    // Start the drawing loop
    //canvasManager.requestAnimationFrame(draw);


})()