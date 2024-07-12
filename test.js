const fs = require('fs');
const portAudio = require('naudiodon');

//const inputFilePath = 'sine_wave_8500Hz.wav';
const inputFilePath = 'sine_wave_9300Hz.wav';
const outputLogFilePath = 'audio_debug_9300.log';
const fileStream = fs.createWriteStream(outputLogFilePath);

const readStream = fs.createReadStream(inputFilePath);

let headerBuffer = Buffer.alloc(44);
let headerRead = false;
let startTime = Date.now();
let isConnected = true;

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

// Create an instance of AudioIO with outOptions
const ao = new portAudio.AudioIO({
    outOptions: {
        channelCount: 2,
        sampleFormat: portAudio.SampleFormat16Bit,
        sampleRate: 48000,
        deviceId: -1, // Use -1 or omit the deviceId to select the default device
        closeOnError: true // Close the stream if an audio error is detected, if set false then just log the error
    }
});

// Handle audio data from the read stream
readStream.on('data', (buffer) => {
    if (!headerRead) {
        headerBuffer = buffer.slice(0, 44);
        buffer = buffer.slice(44);
        headerRead = true;
    }

    // Filter the audio buffer
    const filteredBuffer = filterAudio(buffer);

    // Write only 1 second of audio to a file
    if (Date.now() - startTime <= 1000) {
        for (let i = 0; i < filteredBuffer.length; i += 2) {
            let sample = filteredBuffer.readInt16LE(i);
            fileStream.write(sample + '\n');
        }
    } else {
        if (isConnected) {
            inAudio.quit();
            isConnected = false;
            fileStream.end();
        }
    }

    // Pipe the filtered buffer to the audio output
    ao.write(filteredBuffer);
});

// Start the audio output stream
ao.start();
