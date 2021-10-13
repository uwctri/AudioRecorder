$(document).ready(function() {
    console.log("Loaded Audio Recorder config")
    var $modal = $('#external-modules-configure-modal');
    $modal.on('show.bs.modal', function() {
        // Making sure we are overriding this modules's modal only.
        if ($(this).data('module') !== AudioRecorder.modulePrefix)
            return;
        
        if (typeof ExternalModules.Settings.prototype.resetConfigInstancesOld === 'undefined')
            ExternalModules.Settings.prototype.resetConfigInstancesOld = ExternalModules.Settings.prototype.resetConfigInstances;
        
        ExternalModules.Settings.prototype.resetConfigInstances = function() {
            ExternalModules.Settings.prototype.resetConfigInstancesOld();
            
            if ($modal.data('module') !== AudioRecorder.modulePrefix)
                return;
            
            $modal.addClass('AudioRecorderConfig');
            $modal.find('thead').remove();
            
            // Make URL wide
            $modal.find("tr[field=destination]").each( function() {
                if ( $(this).find('td').length == 3 ) {
                    $(this).find('td').first().remove();
                    let a = $(this).find('input').prop('name').split('____')[1];
                    $(this).find('td').first().attr('colspan','2').prepend(
                        `<b>Destination File Path:</b><br>`
                    ).append(`<br><span>Location on the Redcap server to save the recording to, should include the file name. If not uploading then a file name should be given for the downloaded recording. Do not include a file extention, all files are saved as webm.
                    </span>${AudioRecorder.helperButtons}<br><span>You may also pipe a [timestamp] into the destination</span>`);
                    $(this).find('input').addClass("mt-1");
                }
            });
            
            // Hide poorly formatted #
            $("tr[field=fallback], tr[field=suppress-start-error], tr[field=outcome]").find('.external-modules-instance-label').text('');
        };
    });

    $modal.on('hide.bs.modal', function() {
        // Making sure we are overriding this modules's modal only.
        if ($(this).data('module') !== AudioRecorder.modulePrefix)
            return;
        
        if (typeof ExternalModules.Settings.prototype.resetConfigInstancesOld !== 'undefined')
            ExternalModules.Settings.prototype.resetConfigInstances = ExternalModules.Settings.prototype.resetConfigInstancesOld;

        $modal.removeClass('AudioRecorderConfig');
    });
});