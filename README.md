# AudioRecorder - Redcap External Module

## What does it do?

AudioRecorder allows for audio capture of the PC's microphone and audio-out, users can upload the recording to the Redcap web server or download it to their local machine. This EM was originally created to easily capture VOIP calls for later review as apart of a clinical study.

## Installing

This EM isn't yet available to install via redcap's EM database so you'll need to install to your modules folder (i.e. `redcap/modules/audio_recorder_v1.0.0`) manually.

## Configuration

Configuration is straight forward and requires specifying an instrument to use and css selectors refrencing buttons or "a" elements in a descriptive field for various functions of the recorder. A typical two-button configuration would involve an "Initialize" button and a "Start / Stop & Upload" button. A descriptive field for a two-button setup is below. Remove all line breaks before using. The seletors used here would be ".initRecording" and ".recordingBtn".

```html
<div class="text-center">Begin Recording Now<br />
    <button href="#" class="btn btn-success initRecording" type="button">Initialize Recording</button >
    <button  href="#" class="btn btn-success recordingBtn" type="button">Start/Stop Recording</button >
</div>
```

A three button, less customized layout may look like the below. Here we have used ids for css selectors so the selectors used would be "#initBtn", "#startBtn", and "#stopBtn".

```html
<button id="initBtn">Initialize</button>
<button id="startBtn">Start Recording</button>
<button id="stopBtn">Stop Recording</button>
```

You may also want to set a "Upload Time" or "Saved File Name" field which will allow you to easily creat reports for files that have been uploaded.
![Config Example](https://i.imgur.com/MUAVtIG.png)

## Call Outs

* Feature Request - Show audio levels in the Toast pop-up. This would be a good indicator that the user's mic is working as expected and that they are capturing both audio streams as they expect.

* Due to limitations in the js implementation of `mediaDevices.getDisplayMedia` in some browsers only chrome and chrome-derivatives are supported. Errors exist to inform end-users of this.

* You will only be able to upload recordings to locations that the php user has write access to. If you wish to write to a network drive you may want to write to the local server and then sync the files via a cron job rather than give the php user write access.
