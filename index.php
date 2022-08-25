<?php

require_once APP_PATH_DOCROOT . 'ProjectGeneral/header.php';

?>

<style>
    button {
        margin: 1em;
        padding: 1em;
    }
</style>

<div class="projhdr"><i class="fas fa-microphone"></i> Audio Recorder</div>

<button id="initBtn">Initialize</button>
<button id="startBtn" disabled>Start Recording</button>
<button id="stopBtn" disabled>Stop Recording</button>
<br>
<input type="checkbox" checked id="audioToggle" />
<label for="audioToggle">Capture Audio from Desktop</label>
<br>
<input type="checkbox" checked id="micAudioToggle" />
<label for="micAudioToggle">Capture Audio from Microphone</label><br>
<a id="download" href="#" style="display: none;">Download</a><br>
<a id="upload" href="#" style="display: none;">Upload to Server</a>

<script>
    $("#audioToggle, #micAudioToggle").on('click', function() {
        $("#initBtn").prop('disabled', !$("#audioToggle, #micAudioToggle").is(":checked"));
        AudioRecorder.settings.recording.desktop = $("#audioToggle").is(":checked");
        AudioRecorder.settings.recording.mic = $("#micAudioToggle").is(":checked");
    });
    $("#initBtn").on('click', function() {
        $("#audioToggle, #micAudioToggle").prop('disabled', true);
        $("#download, #upload").hide();
    });
    $("#stopBtn").on('click', function() {
        $("#audioToggle, #micAudioToggle").prop('disabled', false);
        $("#download, #upload").show();
    });
    $("#upload").on('click', function() {
        $("#upload").hide();
    });
</script>

<?php

require_once APP_PATH_DOCROOT . "ProjectGeneral/footer.php";

?>