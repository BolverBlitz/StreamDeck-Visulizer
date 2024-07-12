/**
 * Function to get the default sample rate for a given device id.
 *
 * @param {Array} devices The array of device objects.
 * @param {number} id The id of the device.
 * @return {number|null} The default sample rate of the device with the given id, or null if no such device is found.
 */
const getDefaultSampleRate = (devices, id) => {
    for (let i = 0; i < devices.length; i++) {
        if (devices[i].id === id) {
            return devices[i].defaultSampleRate;
        }
    }
    return null;
}

/**
 * Returns the id of the device with the given name
 * @param {String} name Name of the device
 * @param {Array} array Array of devices
 * @returns 
 */
const findIdByName = (name, array) => {
    const obj = array.find(o => o.name === name);
    return obj ? obj.id : null;
}

/**
 * Function to calculate the frame size for a given frames per second (FPS).
 *
 * @param {number} sampleRate The sample rate of the audio input.
 * @param {number} fps The desired frames per second.
 * @return {number} The frame size that would result in the desired FPS.
 */
const calculateFrameSize = (sampleRate, fps) => {
    let frameSize = sampleRate / fps;

    // If frameSize is below 1024, set it to 1024
    if (frameSize < 1024) {
        frameSize = 1024;
    } else {
        // If frameSize is not a power of 2, round up to the next power of 2
        frameSize = Math.pow(2, Math.ceil(Math.log(frameSize) / Math.log(2)));
    }

    return frameSize;
}

/**
 * Function to calculate frequency ranges for each bin.
 *
 * @param {number} numBins The number of bins.
 * @param {number} [minFreq] The minimum frequency.
 * @param {number} [maxFreq] The maximum frequency.
 * @return {Array} An array of frequency ranges for each bin.
 */
const BinsfrequencyRanges = (numBins, minFreq, maxFreq) => {
    let minLog = Math.log10(minFreq);
    let maxLog = Math.log10(maxFreq);
    let binSize = (maxLog - minLog) / numBins;

    let ranges = new Array(numBins).fill(0).map((_, index) => {
        return [
            Math.pow(10, (index * binSize + minLog)),
            Math.pow(10, ((index + 1) * binSize + minLog))
        ];
    });

    return ranges;
}

/**
 * Function to calculate amplitudes for each bin with logarithmic spacing and optional bin aggregation.
 *
 * @param {Array} frequencies The frequencies from the FFT.
 * @param {Array} amplitudes The amplitudes from the FFT.
 * @param {number} numBins The number of bins.
 * @param {number} [minFreq=20] The minimum frequency.
 * @param {number} maxFreq The maximum frequency.
 * @param {number} [aggregationFactor=1] The factor by which to aggregate adjacent bins.
 * @return {Array} An array of total amplitudes for each bin.
 */
const Binsamplitudes = (frequencies, amplitudes, numBins, minFreq = 20, maxFreq, aggregationFactor = 1) => {
    // Calculate logarithmic step for each bin
    const minLog = Math.log10(minFreq);
    const maxLog = Math.log10(maxFreq);
    const binSize = (maxLog - minLog) / numBins;

    // Adjust the number of bins based on the aggregation factor
    const adjustedNumBins = Math.ceil(numBins / aggregationFactor);
    const binAmplitudes = new Array(adjustedNumBins).fill(0);

    for (let i = 0; i < frequencies.length; i++) {
        if (frequencies[i] < minFreq || frequencies[i] > maxFreq) continue;

        // Calculate the bin index for the current frequency
        const binIndex = Math.floor((Math.log10(frequencies[i]) - minLog) / binSize);
        const adjustedBinIndex = Math.floor(binIndex / aggregationFactor);
        if (adjustedBinIndex >= 0 && adjustedBinIndex < adjustedNumBins) {
            binAmplitudes[adjustedBinIndex] += amplitudes[i];
        }
    }

    return binAmplitudes;
};

/**
 * Function to calculate average and dominant frequency.
 *
 * @param {Array} frequencies The frequencies from the FFT.
 * @param {Array} amplitudes The amplitudes from the FFT.
 * @param {number} [amplitudeThreshold=50] The minimum amplitude to consider.
 * @return {Object} An object with the average and dominant frequencies.
 */
const getAverageAndDominantFrequency = (frequencies, amplitudes, amplitudeThreshold = 50) => {
    let totalFrequency = 0;
    let totalAmplitude = 1;
    let dominantFrequency = { frequency: 0, amplitude: 0 };

    for (let i = 0; i < frequencies.length; i++) {
        // If the current amplitude is greater than the current dominant amplitude,
        // then this frequency becomes the new dominant frequency
        if (amplitudes[i] > dominantFrequency.amplitude) {
            dominantFrequency = { frequency: frequencies[i], amplitude: amplitudes[i] };
        }

        // Ignore frequencies with small amplitudes
        if (amplitudes[i] <= amplitudeThreshold) {
            continue;
        }

        totalFrequency += frequencies[i] * amplitudes[i];
        totalAmplitude += amplitudes[i];
    }

    let averageFrequency = totalFrequency / totalAmplitude;

    return { averageFrequency, dominantFrequency };
}

/**
 * Function to find the closest note to a given frequency.
 *
 * @param {number} frequency The frequency to match to a note.
 * @return {string} The note closest to the given frequency.
 */
const findClosestNote = (frequency) => {
    if (frequency === 0) return 'A0';
    const A4 = 440;

    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

    // Calculate how many semitones this frequency is from A4
    let semitonesFromA4 = Math.floor(12 * Math.log2(frequency / A4) + 0.5);  // Use floor instead of round

    // Calculate the octave and the note within the octave
    let noteIndex = (semitonesFromA4 + 9) % 12;
    let octave = 4 + Math.floor((semitonesFromA4 + 9) / 12);
    if (noteIndex < 0) {
        noteIndex += 12;
        octave--;
    }

    // Get the note name
    let noteName = noteNames[noteIndex];

    // If the octave is less than 4, increment the octave
    if (octave < 4) octave++;
    // Construct the full note name
    let fullNoteName = noteName + octave.toString();

    return fullNoteName;
}

/**
 * Function to calculate the bass amplitude. (20Hz - 250Hz)
 * @param {Array} frequencies 
 * @param {Array} amplitudes 
 * @param {Array} bassFrequencyRange
 * @returns 
 */
const getBassAmplitude = (frequencies, amplitudes, bassFrequencyRange) => {
    let bassAmplitude = 0;
    for (let i = 0; i < frequencies.length; i++) {
        // Check if the frequency is in the bass range
        if (frequencies[i] >=parseInt(bassFrequencyRange[0], 10) && frequencies[i] <= parseInt(bassFrequencyRange[1], 10)) {
            bassAmplitude += amplitudes[i] * 2.5;
        }
    }

    return bassAmplitude;
}

/**
 * Calculated the volume of an audio signal in decibels (dB).
 * @param {Array} amplitudes - An array of amplitudes of the audio signal.
 * @returns {number} The volume of the audio signal in decibels.
 */
const calculateDB = (amplitudes) => {
    var rms = 0;
    for (var i = 0; i < amplitudes.length; i++) {
        rms += amplitudes[i] * amplitudes[i];
    }
    rms /= amplitudes.length;
    rms = Math.sqrt(rms);

    var db = 20 * Math.log10(rms);

    return db || -1000;
}

/**
 * Calculates the multiplier for the amplitude to counter diffrent sample rates and analyzerBins
 * With less sampes per frame, the amplitued becomes lower on avrage, so we need to multiply it with a factor
 * @param {Number} frameSize 
 * @param {Number} analyzerBins 
 * @param {Number} ajustment 
 * @returns 
 */
const calculateMultiplier = (frameSize, analyzerBins, ajustment) => {
    // sampleRate: sampleRate = 512 -> 4, sampleRate = 1024 -> 2, sampleRate = 2048 -> 1
    let multiplier1 = 1024 / frameSize;

    // analyzerBins: mit jeder Verdoppelung erhöht sich der Multiplikator um 1
    let multiplier2 = (analyzerBins === 0) ? 0 : Math.log2(analyzerBins);

    // Multiplikator ist das Produkt von multiplier1 und multiplier2
    let finalMultiplier = multiplier1 * multiplier2;

    return finalMultiplier * ajustment;
}

/**
 * Will check if the device with the given id has at least 2 input channels.
 * @param {Array} devices 
 * @param {Number} name
 * @returns 
 */
const checkDeviceByName = (devices, name) => {
    const device = devices.find(device => device.name === name);
    return device ? device.maxInputChannels >= 2 : false;
}

module.exports = {
    getDefaultSampleRate,
    calculateFrameSize,
    calculateDB,
    findIdByName,
    getBassAmplitude,
    analyzer: {
        amplitudes: Binsamplitudes,
        ranges: BinsfrequencyRanges
    },
    getAverageAndDominantFrequency,
    findClosestNote,
    calculateMultiplier,
    checkDeviceByName
}