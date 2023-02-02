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
                    ).append(`<br><span>Location on the Redcap server to save the recording to, including the file name. If downloading or saving to the file repo then specify a filename only. Do not include a file extention, all files are saved as webm.
                    </span>${module.helperButtons}<br><span>You may also pipe a [timestamp] into the destination</span>`);
                    $(this).find('input').addClass("mt-1");
                }
            });

            // Hide poorly formatted stuff
            $modal.find('tr').not('.sub_parent').find('.external-modules-instance-label').text('')
        };
    });

    $modal.on('hide.bs.modal', function () {
        // Making sure we are overriding this modules's modal only.
        if ($(this).data('module') !== module.prefix) return;

        if (typeof ExternalModules.Settings.prototype.resetConfigInstancesOld !== 'undefined')
            ExternalModules.Settings.prototype.resetConfigInstances = ExternalModules.Settings.prototype.resetConfigInstancesOld;
    });
});