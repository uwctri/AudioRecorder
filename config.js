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
            $modal.find(".sub_start td").css("background-color", "#e6e6e6")

            // No uploads allowed
            if (!module.allowFileRepo && !module.allowDisk) {
                const current = $modal.find("tr[field=descriptive] label").first().text()
                $modal.find("tr[field=descriptive] label").first().html(`${current}<br><b>Your REDCap admin has not enabled uploads to disk or File Repo. If you'd like to upload your recordings please reach out to your local REDCap admin.</b>`)
                // We always allow upload to a file upload field, so don't hide these options
                //$modal.find("tr[field=upload-recording]").hide()
                //$modal.find("tr[field=fallback]").hide()
                //$modal.find("tr[field=upload-method]").hide()
            }

            // XOR the upload methods for repo and web server, disable one of them
            if (!module.allowFileRepo != !module.allowDisk) {
                $modal.find(`tr[field=upload-method] input[value=${module.allowDisk ? 'filerepo' : 'disk'}]`).prop("disabled", true)
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

            // Show/hide destination field based on upload method
            const toggleDestinationField = () => {
                const visibilityMap = {
                    'field': { 'destination-field': true, 'destination': false, 'file-name': false, 'upload-time': false },
                    'filerepo': { 'destination-field': false, 'destination': true, 'file-name': true, 'upload-time': true },
                    'disk': { 'destination-field': false, 'destination': true, 'file-name': true, 'upload-time': true },
                    'default': { 'destination-field': false, 'destination': false, 'file-name': false, 'upload-time': false }
                }

                for (const input of $modal.find('input[name^="upload-method___"]')) {
                    const instanceId = input.name.split('___')[1]
                    const method = $modal.find(`input[name="upload-method___${instanceId}"]:checked`).val()
                    const visibility = visibilityMap[method] || visibilityMap['default']
                    $modal.find(`[name="destination-field___${instanceId}"]`).closest('tr').toggle(visibility['destination-field'])
                    $modal.find(`[name="destination___${instanceId}"]`).closest('tr').toggle(visibility['destination'])
                    $modal.find(`[name="file-name___${instanceId}"]`).closest('tr').toggle(visibility['file-name'])
                    $modal.find(`[name="upload-time___${instanceId}"]`).closest('tr').toggle(visibility['upload-time'])
                }
            }
            toggleDestinationField()
            $modal.find('input[name^="upload-method___"]').on('change', toggleDestinationField)

            // Filter the destination field dropdown to only show file upload fields, run every second in case the user adds instances
            setInterval(() => {
                for (const select of $modal.find('select[name^="destination-field___"]')) {
                    const currentValue = $(select).val()
                    $(select).empty()
                    $(select).append('<option value=""></option>')
                    for (const field of module.fileUploadFields)
                        $(select).append(`<option value="${field}">${field}</option>`)
                    $(select).val(currentValue)
                }
            }, 1000)
        }
    })

    $modal.on('hide.bs.modal', function () {
        // Making sure we are overriding this modules's modal only.
        if ($(this).data('module') !== module.prefix) return

        if (typeof ExternalModules.Settings.prototype.resetConfigInstancesOld !== 'undefined')
            ExternalModules.Settings.prototype.resetConfigInstances = ExternalModules.Settings.prototype.resetConfigInstancesOld
    })
})