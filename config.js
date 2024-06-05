$(document).ready(() => {
    console.log("Loaded Audio Recorder config")
    const $modal = $('#external-modules-configure-modal')
    const module = ExternalModules.UWMadison.AudioRecorder
    $modal.on('show.bs.modal', function () {
        // Making sure we are overriding this modules's modal only.
        if ($(this).data('module') !== module.prefix) return

        if (typeof ExternalModules.Settings.prototype.resetConfigInstancesOld === 'undefined')
            ExternalModules.Settings.prototype.resetConfigInstancesOld = ExternalModules.Settings.prototype.resetConfigInstances

        ExternalModules.Settings.prototype.resetConfigInstances = function () {
            ExternalModules.Settings.prototype.resetConfigInstancesOld()
            if ($modal.data('module') !== module.prefix) return
            $modal.find('thead').remove()

            // No uploads allowed
            if (!module.allowFileRepo && !module.allowDisk) {
                const current = $modal.find("tr[field=descriptive] label").first().text()
                $modal.find("tr[field=descriptive] label").first().html(`${current}<br><b>Your REDCap admin has not enabled uploads to disk or File Repo. If you'd like to upload your recordings please reach out to your local REDCap admin.</b>`)
                $modal.find("tr[field=upload-recording]").hide()
                $modal.find("tr[field=fallback]").hide()
                $modal.find("tr[field=upload-method]").hide()
            }

            if (!module.allowFileRepo || !module.allowDisk) {
                $modal.find("tr[field=upload-method]").hide()
            }

            // Pretty up the URL/Filename field
            $modal.find("tr[field=destination]").each(function () {
                if ($(this).find('td').length == 3) {
                    $(this).find('td').first().remove()
                    $(this).find('input').addClass("mt-1")
                    $(this).find('td').first().attr('colspan', '2').prepend(
                        `<b>Destination File Path or Name:</b><br>`
                    ).append(`<br><span>Full disk path on the REDCap server to save the recording to if uploading to disk. If downloading or saving to the file repo then specify a filename only. Do not include a file extention, all files are saved as webm.
                    </span>${module.helperButtons}<br><span>You may also pipe a [timestamp] into the destination</span>`)
                }
            })

            // Set max time
            $(".audio-em-max-time").text(module.adminMaxTime)

            // Hide poorly formatted stuff
            $modal.find('tr').not('.sub_parent').find('.external-modules-instance-label').text('')
        }
    })

    $modal.on('hide.bs.modal', function () {
        // Making sure we are overriding this modules's modal only.
        if ($(this).data('module') !== module.prefix) return

        if (typeof ExternalModules.Settings.prototype.resetConfigInstancesOld !== 'undefined')
            ExternalModules.Settings.prototype.resetConfigInstances = ExternalModules.Settings.prototype.resetConfigInstancesOld
    })
})