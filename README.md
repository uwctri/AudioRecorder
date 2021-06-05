# AudioRecorder - Redcap External Module

## What does it do?

AudioRecorder allows for audio capture of the PC's microphone and audio-out. It was originally created to easily capture VOIP calls for later review as apart of a redcap study.

## Installing

This EM isn't yet available to install via redcap's EM database so you'll need to install to your modules folder (i.e. `redcap/modules/\audio_recorder_v1.0.0`) manually.

## Configuration

Configuration is straight forward and requires specifying an instrument to use the module on and css selectors for various functions of the recorder. A typical two-button configuration would involve an "Initialize" button and a "Start / Stop & Upload" button. The destination location supports all expected smart variables. 

## Call Outs

* Due to limitations in the js implementation of `mediaDevices.getDisplayMedia` in some browsers only chrome and chrome-derivatives are supported. Errors exist to inform end-users of this.

* You will only be able to upload recordings to locations that the php user has write access to. If you wish to write to a network drive you may want to write to the local server and then sync the files via a cron job rather than give the php user write access.
