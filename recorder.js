AudioRecorder.fn = {};
AudioRecorder.isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor) && (navigator.userAgent.split('Chrome/')[1].split('.')[0] >= 74);
AudioRecorder.initFailure = false;
AudioRecorder.initSuccess = false;
AudioRecorder.initAttach = false;
AudioRecorder.isRecording = false;
AudioRecorder.showInitError = true;
AudioRecorder.isSaved = true;
AudioRecorder.extention = 'webm';
AudioRecorder.codecs = 'opus';
AudioRecorder.disableCalls = 0;

const Toast = Swal.mixin({
    toast: true,
    position: 'top-right',
    showConfirmButton: false,
    timer: 5000,
    timerProgressBar: true,
});

AudioRecorder.fn.log = function(details) {
    details = details || "";
    let record = getParameterByName('id');
    let eventid = getParameterByName('event_id');

    if (!record || !eventid)
        return;

    $.ajax({
        method: 'POST',
        url: AudioRecorder.router,
        data: {
            route: 'log',
            changes: details,
            record: record,
            eventid: eventid,
        },
        error: (jqXHR, textStatus, errorThrown) => console.log(`${jqXHR}\n${textStatus}\n${errorThrown}`)
        success: (data) => {
            console.log(data);
        }
    });
}

AudioRecorder.fn.mergeAudioStreams = function(desktopStream, voiceStream) {
    const context = new AudioContext();
    const destination = context.createMediaStreamDestination();
    let hasDesktop = false;
    let hasVoice = false;

    if (desktopStream && desktopStream.getAudioTracks().length > 0) {
        // If you don't want to share Audio from the desktop it should still work with just the voice.
        const source1 = context.createMediaStreamSource(desktopStream);
        const desktopGain = context.createGain();
        desktopGain.gain.value = 0.7;
        source1.connect(desktopGain).connect(destination);
        hasDesktop = true;
    }

    if (voiceStream && voiceStream.getAudioTracks().length > 0) {
        const source2 = context.createMediaStreamSource(voiceStream);
        const voiceGain = context.createGain();
        voiceGain.gain.value = 0.7;
        source2.connect(voiceGain).connect(destination);
        hasVoice = true;
    }

    return hasDesktop || hasVoice ? destination.stream.getAudioTracks() : [];
};

AudioRecorder.fn.permissionFailure = function() {
    AudioRecorder.initFailure = true;

    Swal.fire({
        icon: 'error',
        title: 'Unable to Record',
        text: 'Failed to get user permission to record. Please refresh the page to capture a recording.',
    }).then((result) => {
        $(AudioRecorder.settings.buttons.start).prop('disabled', true);
    });
}

AudioRecorder.fn.pipe = function(base) {
    let timestamp = formatDate(new Date(), 'yMMdd_HHmmss');
    return base.replace(/\[timestamp\]/g, timestamp);
}

AudioRecorder.fn.onBeforeUnload = function() {
    if (!AudioRecorder.isSaved)
        return false;

    if (AudioRecorder.fn.oldUnload != null)
        return AudioRecorder.fn.oldUnload();
}

AudioRecorder.fn.init = async function() {
    if (!AudioRecorder.isChrome) {
        Swal.fire({
            icon: 'error',
            title: 'Unsupported Browser',
            text: 'Currently only Google Chrome is supported for audio recording.',
        });
        return;
    }

    if (AudioRecorder.initSuccess)
        return;

    if (!AudioRecorder.settings.recording.mic && !AudioRecorder.settings.recording.desktop)
        return;

    AudioRecorder.isRecording = false;
    $(AudioRecorder.settings.buttons.download).prop('disabled', true);
    $(AudioRecorder.settings.buttons.upload).prop('disabled', true);
    $(AudioRecorder.settings.buttons.download).prop('href', '#').prop('download', '');

    try {
        if (AudioRecorder.settings.recording.mic) {
            AudioRecorder.voiceStream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true
            });
        }
        if (AudioRecorder.settings.recording.desktop) {
            AudioRecorder.desktopStream = await navigator.mediaDevices.getDisplayMedia({
                video: true, //required
                audio: true
            });
        }
    } catch (e) {
        AudioRecorder.fn.permissionFailure();
    }

    if (AudioRecorder.settings.recording.desktop && AudioRecorder.desktopStream.getAudioTracks().length < 1) {
        AudioRecorder.fn.permissionFailure();
        return;
    }

    let tracks = [
        ...AudioRecorder.fn.mergeAudioStreams(AudioRecorder.desktopStream, AudioRecorder.voiceStream)
    ];
    AudioRecorder.stream = new MediaStream(tracks);
    AudioRecorder.blobs = [];

    AudioRecorder.rec = new MediaRecorder(AudioRecorder.stream, {
        mimeType: "audio/" + AudioRecorder.extention + ";codecs=" + AudioRecorder.codecs
    });
    AudioRecorder.rec.ondataavailable = (e) => AudioRecorder.blobs.push(e.data);
    AudioRecorder.rec.onstop = async() => {
        AudioRecorder.blob = new Blob(AudioRecorder.blobs, {
            type: "audio/" + AudioRecorder.extention
        });
        AudioRecorder.url = window.URL.createObjectURL(AudioRecorder.blob);
        AudioRecorder.file = AudioRecorder.fn.pipe(AudioRecorder.settings.destination) + '.' + AudioRecorder.extention;
        AudioRecorder.download = AudioRecorder.file.includes(':\\') ? AudioRecorder.file.split('\\').pop() : AudioRecorder.file.split('/').pop();
        if (AudioRecorder.settings.buttons.download)
            $(AudioRecorder.settings.buttons.download).prop('href', AudioRecorder.url).prop('download', download).prop('disabled', false);
        $(AudioRecorder.settings.buttons.upload).prop('disabled', false);
    };

    if (AudioRecorder.initFailure)
        return;
    $(AudioRecorder.settings.buttons.start).prop('disabled', false);
    $(AudioRecorder.settings.buttons.init).prop('disabled', true);
    Toast.fire({
        icon: 'success',
        title: 'Recording Initalized!'
    });
    AudioRecorder.initSuccess = true;
    AudioRecorder.fn.log('Initalized');
}

AudioRecorder.fn.start = function() {
    if (AudioRecorder.isRecording || !(AudioRecorder.settings.recording.desktop || AudioRecorder.settings.recording.mic))
        return;

    if (!AudioRecorder.initSuccess) {
        if (AudioRecorder.showInitError) { // Show only every other click, we might be using a toggle
            Swal.fire({
                icon: 'error',
                title: 'Recorder not Initalized',
                text: 'Please initalize before attempting to record.',
            });
        }
        AudioRecorder.showInitError = !AudioRecorder.showInitError;
        return;
    }

    AudioRecorder.blob = null;
    AudioRecorder.blobs = [];
    AudioRecorder.isSaved = false;
    $(AudioRecorder.settings.buttons.start).prop('disabled', true);
    $(AudioRecorder.settings.buttons.stop).prop('disabled', false);

    try {
        AudioRecorder.rec.start();
        AudioRecorder.fn.disableSaveButtons('recording audio');
        AudioRecorder.toast = Toast.fire({
            icon: 'info',
            title: 'Recording Audio',
            timer: 0
        });

        //Record atleast 1 second of audio before allowing a stop
        setTimeout(function() { AudioRecorder.isRecording = true; }, 1000);

        AudioRecorder.fn.log('Recording Started');
    } catch (e) {
        if (AudioRecorder.settings.noStartError)
            return;
        Swal.fire({
            icon: 'error',
            title: 'Nothing to record!',
            text: 'No live feeds are available for audio recording. This may be a browser or OS issue.',
        });
    }
}

AudioRecorder.fn.stop = function() {
    if (!AudioRecorder.isRecording)
        return;

    AudioRecorder.isRecording = false;
    $(AudioRecorder.settings.buttons.init).prop('disabled', false);
    $(AudioRecorder.settings.buttons.start).prop('disabled', true);
    $(AudioRecorder.settings.buttons.stop).prop('disabled', true);
    AudioRecorder.fn.enableSaveButtons();

    AudioRecorder.rec.stop();
    AudioRecorder.toast.close();
    AudioRecorder.fn.log('Recording Stoped');
}

AudioRecorder.fn.upload = function() {
    if (AudioRecorder.isRecording)
        return;

    // Nothing recorded yet, blob is only set on stop
    if (AudioRecorder.blob == null) {
        setTimeout(AudioRecorder.fn.upload, 250);
        return;
    }

    AudioRecorder.fn.disableSaveButtons('uploading audio');
    AudioRecorder.isSaved = true;
    let formData = new FormData();
    formData.append('file', AudioRecorder.blob);
    formData.append('destination', AudioRecorder.file);
    formData.append('route', 'upload');
    $(AudioRecorder.settings.buttons.upload).prop('disabled', true);
    $.ajax({
        type: 'POST',
        url: AudioRecorder.router,
        data: formData,
        contentType: false,
        processData: false,
        success: function(data) {
            data = JSON.parse(data);
            console.log(data);

            if (data.success) {
                Toast.fire({
                    icon: 'success',
                    title: 'Recording Successfully Uploaded!'
                });

                AudioRecorder.fn.log('Recording Uploaded:\n' + AudioRecorder.download);
                if (AudioRecorder.settings.outcome)
                    $(`[name=${AudioRecorder.settings.outcome}]`).val(formatDate(new Date(), 'MM-dd-y hh:mma').toLowerCase());
                AudioRecorder.fn.enableSaveButtons();
                return;
            }

            AudioRecorder.fn.log('Error Uploading File');
            let footer = '';
            let text = 'Issue uploading recording to REDCap server.';
            if (AudioRecorder.errorEmail) {
                let msg = `tmp: ${data.tmp}\ndst: ${data.target}\nuser: ${$("#username-reference").text()}\ntime: ${(new Date()).toString()}\nurl: ${window.location.href}`;
                sendSingleEmail(AudioRecorder.sendingEmail, AudioRecorder.errorEmail, 'AudioRecorder - Failed to move file', msg);
                text = text + ' Your REDCap administrator has been notified of this issue and may be able to recover the recording.'
            }

            if (AudioRecorder.settings.fallback) {
                footer = `<a href="${AudioRecorder.url}" download="${AudioRecorder.download}"><b>Download Recording</b></a>`;
                text = text + ' It is strongly recommended that you download the recording below.';
            }

            if (AudioRecorder.settings.outcome)
                $(`[name=${AudioRecorder.settings.outcome}]`).val("Failure");

            Swal.fire({
                icon: 'error',
                title: 'Recoverable Upload Error',
                text: text,
                footer: footer,
                allowOutsideClick: !AudioRecorder.settings.fallback
            });

            AudioRecorder.fn.enableSaveButtons();
        },
        error: function(jqXHR, textStatus, errorMessage) {
            let footer = '';
            let text = 'Unable to upload recording to REDCap server.';
            let error = errorMessage ? JSON.stringify(errorMessage) : "";
            error += textStatus ? JSON.stringify(textStatus) : "";

            if (AudioRecorder.errorEmail) {
                let msg = `user: ${$("#username-reference").text()}\ntime: ${(new Date()).toString()}\nurl: ${window.location.href}\nerror: ${JSON.stringify(error)}`;
                sendSingleEmail(AudioRecorder.sendingEmail, AudioRecorder.errorEmail, 'AudioRecorder - Failed to post file', msg);
            }

            if (AudioRecorder.settings.fallback) {
                footer = `<a href="${AudioRecorder.url}" download="${AudioRecorder.download}"><b>Download Recording</b></a>`;
                text = text + ' It is strongly recommended that you download the recording below and report this incident to your REDCap administrator.';
            }

            if (AudioRecorder.settings.outcome)
                $(`[name=${AudioRecorder.settings.outcome}]`).val("Failure");

            Swal.fire({
                icon: 'error',
                title: 'Unrecoverable Upload Error',
                text: text,
                footer: footer,
                allowOutsideClick: !AudioRecorder.settings.fallback
            });
            AudioRecorder.fn.enableSaveButtons();
        }
    });
}

AudioRecorder.fn.download = function() {
    let link = $(AudioRecorder.settings.buttons.download).prop('href');
    if (AudioRecorder.isRecording || !link || link == '#')
        return
    AudioRecorder.isSaved = true;
}

AudioRecorder.fn.attachEvents = function() {
    if (AudioRecorder.initAttach)
        return;

    AudioRecorder.initAttach = true;
    $(AudioRecorder.settings.buttons.init).on('click', AudioRecorder.fn.init);
    $(AudioRecorder.settings.buttons.start).on('click', AudioRecorder.fn.start);
    $(AudioRecorder.settings.buttons.stop).on('click', AudioRecorder.fn.stop);
    $(AudioRecorder.settings.buttons.upload).on('click', AudioRecorder.fn.upload);
    $(AudioRecorder.settings.buttons.download).on('click', AudioRecorder.fn.download);
    AudioRecorder.fn.oldUnload = window.onbeforeunload;
    window.onbeforeunload = AudioRecorder.fn.onBeforeUnload;
}

AudioRecorder.fn.enableSaveButtons = function() {
    AudioRecorder.disableCalls += AudioRecorder.disableCalls > 0 ? -1 : 0;
    setTimeout(function() {
        if (AudioRecorder.disableCalls == 0) {
            $("#__SUBMITBUTTONS__-tr button").css('pointer-events', '').removeClass('disabled');
            $(".tmpDisableSave").remove();
            $(window).resize();
        }
    }, 500);
}

AudioRecorder.fn.disableSaveButtons = function(displayText) {
    AudioRecorder.disableCalls++;
    $("#__SUBMITBUTTONS__-tr button").css('pointer-events', 'none').addClass('disabled');
    if ($(".tmpDisableSave").length == 0)
        $("#__SUBMITBUTTONS__-tr button").last().after(`<span class='text-bold text-danger tmpDisableSave'><br>* Form saving disabled while ${displayText}</span>`);
    else
        $('.tmpDisableSave').html(`<br>* Form saving disabled while ${displayText}`);
    $(window).resize();
}

$(window).on("beforeunload", function() {
    if (AudioRecorder.isRecording)
        return "Recording in progress!";
    return;
});

$(document).ready(function() {
    // Remove illegal charachters from file path, allow : due to windows needing it for drive letter
    AudioRecorder.settings.destination = AudioRecorder.settings.destination.replace(/[\/*?"<>|]/g, '');
    // Load the recorder, play nice w/ Shazam
    if (typeof Shazam == "object") {
        let oldCallback = Shazam.beforeDisplayCallback;
        Shazam.beforeDisplayCallback = function() {
            if (typeof oldCallback == "function")
                oldCallback();
            AudioRecorder.fn.attachEvents();
        }
        setTimeout(AudioRecorder.fn.attachEvents, 2000);
    } else {
        AudioRecorder.fn.attachEvents();
    }
});