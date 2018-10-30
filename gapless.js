function load(audio_id, log_id, has_elst) {
    const codecString = 'audio/mp4; codecs="mp4a.40.2"';
    const timescale = 44100;

    // Please See README for more details about the test files.

    // audioUrlsWithElst contains audio files with ELST box and final packet 
    // duration less than 1024.
    const audioUrlsWithElst = [
        './resources/tone_1.mp4',
        './resources/tone_2.mp4'
    ];
    // Unfortunately most media stacks don't handle ELST correctly. In order to
    // workaround this we have another test case to remove all the special 
    // features that browser can mess up on trimming. 
    // audioUrlsWithElst contains audio files without ELST box and final packet 
    // duration equal to 1024.
    const audioUrlsNoElst = [
        './resources/tone_1_no_elst.mp4',
        './resources/tone_2_no_elst.mp4'
    ];
    const audioUrls = has_elst ? audioUrlsWithElst : audioUrlsNoElst;

    // Parsing gapless metadata is unfortunately non trivial and a bit messy, so
    // we'll glaze over it here. See README for more details about the test files.

    // For test files in audioUrlsWithElst, according to 
    // https://www.w3.org/TR/mse-byte-stream-format-isobmff/#iso-init-segments,
    // Let's assume that browser does these things correctly:
    // - Parse ELST
    // - Set timestamp offset according to media_time in ELST
    // - Trim exactly leading samples as media_time suggests
    // Then it's client's obligation to trim extra trailing samples 
    // according to the final packet duration described in TRUN. 
    const gaplessInfosWithElst = [
        new GaplessInfo(0, 790, 112640 - (1600 + 790), timescale),
        new GaplessInfo(0, 790, 112640 - (1600 + 790), timescale),
    ]
    // For test files in audioUrlsNoElst, browsers are supposed to do
    // nothing about timestamp shifting and sample trimming. In order to get
    // gapless playback, client should do those things explicitly.
    const gaplessInfosNoElst = [
        new GaplessInfo(1600, 790, 112640 - (1600 + 790), timescale),
        new GaplessInfo(1600, 790, 112640 - (1600 + 790), timescale),
    ]
    const gaplessInfos = has_elst ? gaplessInfosWithElst : gaplessInfosNoElst;

    let audio = document.getElementById(audio_id);
    // log_element is used to output some important logs on the page.
    let log_element = document.getElementById(log_id);
    console.log('log_element is ' + log_element);
    let mediaSource = new MediaSource();
    audio.src = window.URL.createObjectURL(mediaSource);

    mediaSource.addEventListener('sourceopen', function() {
        URL.revokeObjectURL(audio.src);
        let sourceBuffer = mediaSource.addSourceBuffer(codecString);
        // As for gapless playback, some browsers (like Chrome) do things 
        // differently between sequence mode and segments mode. Using sequence
        // mode could make things more complicated and unpredictable. So Let's 
        // use segments mode, and leave sequence mode alone for now.
        sourceBuffer.mode = "segments";

        function onAudioLoaded(data, index) {
            // When appendBuffer() completes, it will fire an updateend event 
            // signaling that it's okay to append another segment of media.  
            // Here, we'll chain the append for the next segment to the 
            // completion of our current append.
            sourceBuffer.addEventListener('updateend', function() {
                log(log_element, 'After updateend, timestampOffset = ' +
                    sourceBuffer.timestampOffset + ' (frames: ' +
                    sourceBuffer.timestampOffset * timescale + ')');

                if (index < audioUrls.length - 1) {
                    ++index;
                    get(audioUrls[index], function(data) {
                        onAudioLoaded(data, index);
                    });
                } else {
                    mediaSource.endOfStream();
                }
            }, { once: true });

            const gaplessInfo = gaplessInfos[index];
            let start, end, offset = 0;

            start = index > 0 ? sourceBuffer.appendWindowEnd : 0;
            end = start + gaplessInfo.duration;
            offset = has_elst ? start : start - gaplessInfo.delay;
            // Use append window to trim off leading/trailing audio samples.
            sourceBuffer.appendWindowEnd = end;
            sourceBuffer.appendWindowStart = start;
            // Shift all of the padding we want to discard before our append
            // window.
            sourceBuffer.timestampOffset = offset;

            log(log_element, '****** buffer mode = ' + sourceBuffer.mode +
                ', audio index = ' + index + ' *******');
            log(log_element, 'appendWindowStart = ' +
                sourceBuffer.appendWindowStart);
            log(log_element, 'appendWindowEnd = ' +
                sourceBuffer.appendWindowEnd);
            log(log_element, 'timestampOffset = ' +
                sourceBuffer.timestampOffset);
            // appendBuffer() will now use the timestamp offset and append 
            // window settings to filter and timestamp the data we're appending.
            sourceBuffer.appendBuffer(data);
        }

        get(audioUrls[0], function(data) { onAudioLoaded(data, 0); });

    }, { once: true });
}

function get(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.send();

    xhr.onload = function(e) {
        if (xhr.status != 200) {
            alert("Unexpected status code " + xhr.status + " for " + url);
        }
        callback(new Uint8Array(xhr.response));
    };
}

function log(element, message) {
    element.innerText += message + '\n';
    console.log(message);
}

function GaplessInfo(delay, padding, duration, timescale) {
    this.delay = delay / timescale;
    this.padding = padding / timescale;
    this.duration = duration / timescale;
}