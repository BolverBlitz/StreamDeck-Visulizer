# WARNING
THIS SOFTWARE LISTS ALL AUDIO DEVICES, SOME MIGHT CAUSE A BLUESCREEN/KERNEL PANIC WHEN SELECTED (REFER TO #Usage Tipps FOR MORE INFO)

# Usage
1. Install dependencies with `npm i`
2. Create .env File from .env.example
3. Start Main Application with `node index.js`
4. User first Dial on Streamdek to select your Audio Output device
5. Pres the Dial to select it

## Usage Tipps
- Select only "Loopback or Digital Audio Interface" Devices to make sure it works and won´t bluescreen.
- Select a device with more than 40000Hz because a FFT Function can only calculate half the samplingrate.
- You can set most of the Virtual Devices to 192kHz Sampling Rate, if you do that you can set the "zeroPaddingFactor" to 0 in /config/audio.js because 192kHz is more than enoth spacial resolution.

# Info
For now the Software runs with a Target FPS of 30, 60 or even 78 FPS are possible if you only draw very little.
You can open waveform.html in your Browser to get a visulizer and waveform aswell.

## Code AudioServer.js
Is reading the output device as a (16 Bit) stream.
You can apply custom filters in the filterAudio function before its processed by the FFT.
It provides a Websocket Server for the StreamDeck Software or other Software to connect to.
