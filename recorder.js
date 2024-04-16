const AudioRecorder = { init: null, start: null, stop: null, upload: null, download: null };

(() => {
    // Constants
    const module = ExternalModules.UWMadison.AudioRecorder;
    const extention = 'webm';
    const codecs = 'opus';
    const timeOut = 5000;
    const defaultFileName = "[timestamp]";

    // Remove illegal charachters from file path, allow : due to windows needing it for drive letter
    // We will only use this for a file name if we download the file locally
    module.destination ??= defaultFileName;
    module.destination = module.destination.replace(/[\/*?"<>|]/g, '');

    // State globals
    let isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor) && (navigator.userAgent.split('Chrome/')[1].split('.')[0] >= 74);
    let initFailure = false;
    let initSuccess = false;
    let isRecording = false;
    let showInitError = true;
    let isSaved = true;
    let disableCalls = 0;

    // Streaming globals
    let stream;
    let rec;
    let blob;
    let blobs;
    let downloadName;
    let downloadUrl;
    let file;
    let autoStopTimeout;
    let recordingToast;

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-right',
        showConfirmButton: false,
        timer: timeOut,
        timerProgressBar: true,
    });

    const log = (details) => {
        details = details || "";
        let record = getParameterByName('id');
        if (!record) return; // Skip log on demo page

        $.ajax({
            method: 'POST',
            url: module.router,
            data: {
                route: 'log',
                text: details,
                record: record,
                event_id: event_id,
                project_id: pid,
                redcap_csrf_token: module.csrf
            },
            error: (jqXHR, textStatus, errorThrown) => console.log(`${jqXHR}\n${textStatus}\n${errorThrown}`),
            success: (data) => console.log(data)
        });
    }

    const mergeAudioStreams = (desktopStream, voiceStream) => {
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
    }

    const permissionFailure = () => {
        initFailure = true;
        Swal.fire({
            icon: 'error',
            title: 'Unable to Record',
            text: 'Failed to get user permission to record. Please refresh the page to capture a recording.',
        }).then((result) => {
            $(module.buttons.start).prop('disabled', true);
        });
    }

    const pipe = (base) => {
        let timestamp = formatDate(new Date(), 'yMMdd_HHmmss');
        return base.replace(/\[timestamp\]/g, timestamp);
    }

    const onBeforeUnload = () => {
        if (!isSaved)
            return false;

        if (oldUnload != null)
            return oldUnload();
    }

    const init = async () => {
        if (!isChrome) {
            Swal.fire({
                icon: 'error',
                title: 'Unsupported Browser',
                text: 'Currently only Google Chrome is supported for audio recording.',
            });
            return;
        }

        if (initSuccess)
            return;

        if (!module.recording.mic && !module.recording.desktop)
            return;

        isRecording = false;
        $(module.buttons.download).prop('disabled', true);
        $(module.buttons.upload).prop('disabled', true);
        $(module.buttons.download).prop('href', '#').prop('download', '');
        let voiceStream = null;
        let desktopStream = null

        try {
            if (module.recording.mic) {
                voiceStream = await navigator.mediaDevices.getUserMedia({
                    video: false,
                    audio: true
                });
            }
            if (module.recording.desktop) {
                desktopStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true, //required
                    audio: true
                });
            }
        } catch (e) {
            permissionFailure();
        }

        if (module.recording.desktop && desktopStream.getAudioTracks().length < 1) {
            permissionFailure();
            return;
        }

        let tracks = [
            ...mergeAudioStreams(desktopStream, voiceStream)
        ];
        stream = new MediaStream(tracks);
        blobs = [];

        rec = new MediaRecorder(stream, {
            mimeType: "audio/" + extention + ";codecs=" + codecs
        });
        rec.ondataavailable = (e) => blobs.push(e.data);
        rec.onstop = async () => {
            blob = new Blob(blobs, {
                type: "audio/" + extention
            });
            downloadUrl = window.URL.createObjectURL(blob);
            file = pipe(module.destination) + '.' + extention;
            downloadName = file.includes(':\\') ? file.split('\\').pop() : file.split('/').pop();
            if (module.buttons.download) {
                $(module.buttons.download).prop('href', downloadUrl).prop('download', downloadName).prop('disabled', false);
            }
            $(module.buttons.upload).prop('disabled', false);
        };

        if (initFailure)
            return;
        $(module.buttons.start).prop('disabled', false);
        $(module.buttons.init).prop('disabled', true);
        Toast.fire({
            icon: 'success',
            title: 'Recording Initalized!'
        });
        initSuccess = true;
        log('Initalized');
    }

    const start = () => {
        if (isRecording || !(module.recording.desktop || module.recording.mic))
            return;

        if (!initSuccess) {
            if (showInitError) { // Show only every other click, we might be using a toggle
                Swal.fire({
                    icon: 'error',
                    title: 'Recorder not Initalized',
                    text: 'Please initalize before attempting to record.',
                });
            }
            showInitError = !showInitError;
            return;
        }

        blob = null;
        blobs = [];
        isSaved = false;
        $(module.buttons.start).prop('disabled', true);
        $(module.buttons.stop).prop('disabled', false);

        try {
            rec.start();
            disableSaveButtons('recording audio');
            recordingToast = Toast.fire({
                icon: 'info',
                title: 'Recording Audio',
                timer: 0
            });

            //Record atleast 1 second of audio before allowing a stop
            setTimeout(() => { isRecording = true; }, 1000);

            if (module.maxTime > 0)
                autoStopTimeout = setTimeout(stop, 1000 * 60 * module.maxTime, null, true)

            log('Recording Started');
        } catch (e) {
            if (module.noStartError)
                return;
            Swal.fire({
                icon: 'error',
                title: 'Nothing to record!',
                text: 'No live feeds are available for audio recording. This may be a browser or OS issue.',
            });
        }
    }

    const stop = (e = null, timedout = false) => {
        if (module.maxTime > 0)
            clearTimeout(autoStopTimeout)

        if (timedout)
            Swal.fire({
                icon: 'info',
                title: 'Recorder Auto Stopped',
                text: 'Maximum recording length has been reached and the recording stopped. Please manually upload or download the recording.',
            });

        if (!isRecording)
            return;

        isRecording = false;
        $(module.buttons.init).prop('disabled', false);
        $(module.buttons.start).prop('disabled', true);
        $(module.buttons.stop).prop('disabled', true);
        enableSaveButtons();

        rec.stop();
        recordingToast.close();
        log('Recording Stoped');
    }

    const upload = () => {
        if (isRecording) return;

        // Nothing recorded yet, blob is only set on stop
        if (blob == null) {
            setTimeout(upload, 250);
            return;
        }

        disableSaveButtons('uploading audio');
        isSaved = true;
        let formData = new FormData();
        formData.append('file', blob);
        formData.append('route', 'upload');
        formData.append('record', getParameterByName("id"));
        formData.append('event_id', event_id);
        formData.append('instrument', getParameterByName("page"));
        formData.append('instance', getParameterByName("instance"));
        formData.append('project_id', pid);
        formData.append('redcap_csrf_token', module.csrf);
        $(module.buttons.upload).prop('disabled', true);
        $.ajax({
            type: 'POST',
            url: module.router,
            data: formData,
            contentType: false,
            processData: false,
            success: (data) => {
                console.log(data);

                if (data.success) {
                    Toast.fire({
                        icon: 'success',
                        title: 'Recording Successfully Uploaded!'
                    });

                    log('Recording Uploaded:\n' + downloadName);
                    if (module.uploadTime)
                        $(`[name=${module.uploadTime}]`).val(formatDate(new Date(), 'y-MM-dd HH:mm'));
                    if (module.fileName)
                        $(`[name=${module.fileName}]`).val(data.file.split(/\\|\//).slice(-1)[0]);
                    enableSaveButtons();
                    return;
                }

                log('Error Uploading File');
                let footer = '';
                let text = 'Issue uploading recording to REDCap server.';

                if (module.fallback) {
                    footer = `<a href="${downloadUrl}" download="${downloadName}"><b>Download Recording</b></a>`;
                    text = text + ' It is strongly recommended that you download the recording below.';
                }

                if (module.uploadTime)
                    $(`[name=${module.uploadTime}]`).val("");
                if (module.fileName)
                    $(`[name=${module.fileName}]`).val("");

                Swal.fire({
                    icon: 'error',
                    title: 'Recoverable Upload Error',
                    text: text,
                    footer: footer,
                    allowOutsideClick: !module.fallback
                });

                enableSaveButtons();
                $(module.buttons.start).prop('disabled', false);
            },
            error: (jqXHR, textStatus, errorMessage) => {
                let footer = '';
                let text = 'Unable to upload recording to REDCap server.';
                let error = errorMessage ? JSON.stringify(errorMessage) : "";
                error += textStatus ? JSON.stringify(textStatus) : "";

                if (module.fallback) {
                    footer = `<a href="${downloadUrl}" download="${downloadName}"><b>Download Recording</b></a>`;
                    text = text + ' It is strongly recommended that you download the recording below and report this incident to your REDCap administrator.';
                }

                if (module.uploadTime)
                    $(`[name=${module.uploadTime}]`).val("");
                if (module.fileName)
                    $(`[name=${module.fileName}]`).val("");

                Swal.fire({
                    icon: 'error',
                    title: 'Unrecoverable Upload Error',
                    text: text,
                    footer: footer,
                    allowOutsideClick: !module.fallback
                });
                enableSaveButtons();
            }
        });
    }

    const download = () => {
        if (!downloadName || !downloadUrl)
            return;
        let el = document.createElement('a');
        el.download = downloadName;
        el.href = downloadUrl;
        el.click().remove();
    }

    const enableSaveButtons = () => {
        disableCalls += disableCalls > 0 ? -1 : 0;
        setTimeout(() => {
            if (disableCalls == 0) {
                $("#__SUBMITBUTTONS__-tr button").css('pointer-events', '').removeClass('disabled');
                $(".tmpDisableSave").remove();
                $(window).resize();
            }
        }, 500);
    }

    const disableSaveButtons = (displayText) => {
        disableCalls++;
        $("#__SUBMITBUTTONS__-tr button").css('pointer-events', 'none').addClass('disabled');
        if ($(".tmpDisableSave").length == 0)
            $("#__SUBMITBUTTONS__-tr button").last().after(`<span class='text-bold text-danger tmpDisableSave'><br>* Form saving disabled while ${displayText}</span>`);
        else
            $('.tmpDisableSave').html(`<br>* Form saving disabled while ${displayText}`);
        $(window).resize();
    }

    $(window).on("beforeunload", () => {
        if (isRecording)
            return "Recording in progress!";
    });

    module.afterRender(() => {

        let attached = false;

        const attach = () => {
            if (attached) return;
            attached = true;
            $(module.buttons.init).on('click', init);
            $(module.buttons.start).on('click', start);
            $(module.buttons.stop).on('click', stop);
            $(module.buttons.upload).on('click', upload);
            oldUnload = window.onbeforeunload;
            window.onbeforeunload = onBeforeUnload;
        };

        if (typeof Shazam !== "object") {
            attach();
            return;
        }

        let oldCallback = Shazam.beforeDisplayCallback;
        Shazam.beforeDisplayCallback = () => {
            if (typeof oldCallback == "function")
                oldCallback();
            attach();
        }
        setTimeout(attach, 2000);
    });

    AudioRecorder.init = init;
    AudioRecorder.start = start;
    AudioRecorder.stop = stop;
    AudioRecorder.upload = upload;
    AudioRecorder.download = download;
})();