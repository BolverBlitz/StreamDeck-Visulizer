require('module-alias/register')
require('dotenv').config()

process.env.APPLICATION = "AudioServer";

const { log } = require('@lib/logger');

process.log = {};
process.log = log;

const HyperExpress = require('hyper-express');
const app = new HyperExpress.Server({
    fast_buffers: process.env.HE_FAST_BUFFERS == 'false' ? false : true || false,
});

const portAudio = require('naudiodon');

const audio = require('@lib/audio_utils');
const audio_config = require('@config/audio');
const fft = require('fft-js').fft;
const fftUtil = require('fft-js').util;

const events = require('events');
const streamingEvent = new events.EventEmitter(); // Event emitter to emit events to the websocket

let inAudio; // Global variable for the audio input stream
let isConnected = false; // Global variable to check if the audio input is connected
let isWSConnected = false; // Global variable to check if a websocket is connected
let analyzerBinsArray = []; // Global variable to store the frequency ranges for each bin

let g_sampleRate = 0; // Global variable to store the sample rate
let g_frameSize = 0; // Global variable to store the frame size

let AmplituteMultiplayer = 1; // Global variable to store the AmplituteMultiplayer

// Function to filter audio
function filterAudio(buffer) {
    // Assuming buffer is a Buffer object and audio data is 16-bit PCM
    let filteredBuffer = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length; i += 2) {
        // Combine two bytes to get the 16-bit sample
        let sample = buffer.readInt16LE(i);
        filteredBuffer.writeInt16LE(sample, i);
    }
    return filteredBuffer;
}

/**
 * Start converting the audio input to a websocket stream
 * @param {Buffer} buffer 
 */
const audioToWS_Stream = (buffer) => {
    buffer = filterAudio(buffer);
    let data = [];
    for (let i = 0; i < buffer.length; i += 2) {
        // Convert 16 bit value to float (-1 to 1)
        data.push(buffer.readInt16LE(i) / 32767);
    }

    let waveform = []
    for (let i = 0; i < buffer.length; i += 2) {
        let sample = buffer.readInt16LE(i);
        waveform.push(sample);
    }

    // Zero-pad the data to increase the hz resolution of the FFT Algorithm
    /*
    let paddedDataSize = data.length * audio_config.zeroPaddingFactor;
    while (data.length < paddedDataSize) {
        data.push(0);
    }
    */

    let phasors = fft(data);
    // Get frequencies and amplitudes and get rid of higher frequencies than maxFrequency
    const frequencies = fftUtil.fftFreq(phasors, g_sampleRate).filter((freq, index) => freq <= audio_config.maxFrequency);
    const amplitudes = fftUtil.fftMag(phasors).filter((amp, index) => frequencies[index] <= audio_config.maxFrequency);

    const { averageFrequency, dominantFrequency } = audio.getAverageAndDominantFrequency(frequencies, amplitudes, audio_config.amplitudeThreshold);
    const bassAmplitude = audio.getBassAmplitude(frequencies, amplitudes, audio_config.bassFrequencyRange);
    const closestNote = audio.findClosestNote(dominantFrequency.frequency);
    //console.log(frequencies)
    const analyzer = audio.analyzer.amplitudes(frequencies, amplitudes, audio_config.analyzerBins, audio_config.minFrequency, audio_config.maxFrequency);

    // Emit the data to the websocket if it is connected
    if (isWSConnected || true) {
        streamingEvent.emit('streaming', {
            averageFrequency: averageFrequency,
            dominantFrequency: dominantFrequency,
            bassAmplitude: bassAmplitude,
            rms_db: audio.calculateDB(data),
            closestNote: closestNote,
            analyzer: analyzer,
            AmplituteMultiplayer: AmplituteMultiplayer,
            waveform: waveform
        });
    }
};

const configur_portAudio = (sampleRate, frameSize, audioDeviceID) => {
    try {
        if (isConnected) {
            inAudio.quit();
            isConnected = false;
        }

        g_sampleRate = sampleRate;
        g_frameSize = frameSize;

        // Calculate the AmplituteMultiplayer (A number to multiply the amplitudes with to get a better visualisation)
        AmplituteMultiplayer = audio.calculateMultiplier(frameSize, audio_config.analyzerBins, audio_config.multiplyerAjustment)

        // Calculate the frequency ranges for each bin
        analyzerBinsArray = audio.analyzer.ranges(audio_config.analyzerBins, audio_config.minFrequency, audio_config.maxFrequency);

        process.log.debug(`sampleRate ${sampleRate} frameSize ${frameSize} audio_config.device ${audioDeviceID}`)

        inAudio = portAudio.AudioIO({
            inOptions: {
                channelCount: 1,
                sampleFormat: portAudio.SampleFormat16Bit,
                sampleRate: sampleRate,
                highwaterMark: frameSize,
                deviceId: audioDeviceID,
                closeOnError: false // Close the stream if an audio error is detected, if set false then just log the error
            }
        });

        isConnected = true;
        inAudio.on('data', audioToWS_Stream);
    } catch (err) {
        process.log.error(err);
        process.log.error('Error while configuring portAudio');
    }
}

// {"type": "subscribe","data": {"sampleRate": 44100,"frameSize": 2048,"audioDeviceID": 5}}

app.ws('/audioStream', {
    idle_timeout: 60
}, (ws) => {
    ws.on('message', (msg) => {
        const { type, data } = JSON.parse(msg);

        if (type === 'subscribe') {
            isWSConnected = true;
            configur_portAudio(data.sampleRate, data.frameSize, data.audioDeviceID);
            inAudio.start();
        }
    });

    ws.on('close', () => {
        streamingEvent.removeListener('streaming', streamingListener);
        process.log.debug('AudioStream Websocket closed');
        isWSConnected = false;
    });

    ws.on('error', (err) => {
        streamingEvent.removeListener('streaming', streamingListener);
        process.log.error(err);
        isWSConnected = false;
    });

    // Relay the data from the event emitter to the websocket
    const streamingListener = (data) => {
        if (isWSConnected) ws.send(JSON.stringify({ type: 'streaming', data: data }));
    }

    streamingEvent.on('streaming', streamingListener);
});

app.listen(parseInt(process.env.AUDIO_WS_PORT, 10), () => {
    process.log.info(`Server running on port ${parseInt(process.env.AUDIO_WS_PORT, 10)}`);
});