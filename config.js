$(document).ready(() => {
    console.log("Loaded Audio Recorder config")
    const $modal = $('#external-modules-configure-modal');
    const module = ExternalModules.UWMadison.AudioRecorder;
    $modal.on('show.bs.modal', function () {
        // Making sure we are overriding this modules's modal only.
        if ($(this).data('module') !== module.prefix) return;

        if (typeof ExternalModules.Settings.prototype.resetConfigInstancesOld === 'undefined')
            ExternalModules.Settings.prototype.resetConfigInstancesOld = ExternalModules.Settings.prototype.resetConfigInstances;

        ExternalModules.Settings.prototype.resetConfigInstances = function () {
            ExternalModules.Settings.prototype.resetConfigInstancesOld();
            if ($modal.data('module') !== module.prefix) return;
            $modal.find('thead').remove();

            // Make URL wide
            $modal.find("tr[field=destination]").each(function () {
                if ($(this).find('td').length == 3) {
                    $(this).find('td').first().remove();
                    let a = $(this).find('input').prop('name').split('____')[1];
                    $(this).find('td').first().attr('colspan', '2').prepend(
                        `<b>Destination File Path:</b><br>`
                    ).append(`<br><span>Location on the Redcap server to save the recording to, should include the file name. If not uploading then a file name should be given for the downloaded recording. Do not include a file extention, all files are saved as webm.
                    </span>${module.helperButtons}<br><span>You may also pipe a [timestamp] into the destination</span>`);
                    $(this).find('input').addClass("mt-1");
                }
            });

            // Hide poorly formatted stuff
            $("tr[field=fallback], tr[field=suppress-start-error], tr[field=upload-time], tr[field=file-name]").find('.external-modules-instance-label').text('');
        };
    });

    $modal.on('hide.bs.modal', function () {
        // Making sure we are overriding this modules's modal only.
        if ($(this).data('module') !== module.prefix) return;

        if (typeof ExternalModules.Settings.prototype.resetConfigInstancesOld !== 'undefined')
            ExternalModules.Settings.prototype.resetConfigInstances = ExternalModules.Settings.prototype.resetConfigInstancesOld;
    });
});