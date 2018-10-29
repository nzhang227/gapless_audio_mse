function load(id, log_id, has_elst, sourceBufferMode = 'sequence') {
    let audio;
    let log_element;
    let mediaSource;
    const codecString = 'audio/mp4; codecs="mp4a.40.2"';
    let sourceBuffer;

    const audioUrlsWithElst = [
        './resources/tone_1.mp4',
        './resources/tone_2.mp4'
    ];

    const audioUrlsNoElst = [
        './resources/tone_1_no_elst.mp4',
        './resources/tone_2_no_elst.mp4'
    ];    

    const audioUrls = has_elst ? audioUrlsWithElst : audioUrlsNoElst;

    const timescale = 44100;

    const gaplessInfosWithElst = [
        new GaplessInfo(0, 790, 112640 - (1600 + 790), timescale),
        new GaplessInfo(0, 790, 112640 - (1600 + 790), timescale),
    ]

    const gaplessInfosNoElst = [
        new GaplessInfo(1600, 790, 112640 - (1600 + 790), timescale),
        new GaplessInfo(1600, 790, 112640 - (1600 + 790), timescale),
    ]

    const gaplessInfos = has_elst ? gaplessInfosWithElst : gaplessInfosNoElst;

    audio = document.getElementById(id);
    log_element = document.getElementById(log_id);
    console.log('log_element is ' + log_element);
    mediaSource = new MediaSource();
    audio.src = window.URL.createObjectURL(mediaSource);

    mediaSource.addEventListener('sourceopen', function() {
        URL.revokeObjectURL(audio.src);
        let sourceBuffer = mediaSource.addSourceBuffer(codecString);
        sourceBuffer.mode = sourceBufferMode;

        function onAudioLoaded(data, index) {
            sourceBuffer.addEventListener('updateend', function() {
                log(log_element, 'After updateend, timestampOffset = ' + sourceBuffer.timestampOffset + ' (frames: ' + sourceBuffer.timestampOffset * timescale + ')');

                if (index < audioUrls.length - 1) {
                    ++index;
                    get(audioUrls[index], function(data) { onAudioLoaded(data, index); });
                } else {
                    mediaSource.endOfStream();
                }
            }, { once: true } );

            const gaplessInfo = gaplessInfos[index];
            let start, end, offset = 0;

            // start = index > 0 ? sourceBuffer.buffered.end(0) : 0;
            start = index > 0 ? sourceBuffer.appendWindowEnd : 0;
            end = start + gaplessInfo.duration;
            offset = has_elst ? start : start - gaplessInfo.delay; 

           sourceBuffer.appendWindowEnd = end;
           sourceBuffer.appendWindowStart = start;
           sourceBuffer.timestampOffset = offset;

           log(log_element, '****** buffer mode = ' + sourceBufferMode + ', trim index = ' + index + ' *******');
           log(log_element, 'appendWindowStart = ' + sourceBuffer.appendWindowStart);
           log(log_element, 'appendWindowEnd = ' + sourceBuffer.appendWindowEnd);
           log(log_element, 'timestampOffset = ' + sourceBuffer.timestampOffset);

            sourceBuffer.appendBuffer(data);
        }

        get(audioUrls[0], function(data) { onAudioLoaded(data, 0); });
        // audio.play();

    }, { once: true} );
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

class GaplessInfo {
    constructor(delay, padding, duration, timescale) {
        this.delay = delay / timescale;
        this.padding = padding / timescale;
        this.duration = duration / timescale;
    }
}
