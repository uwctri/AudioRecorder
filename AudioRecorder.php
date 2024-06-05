<?php

namespace UWMadison\AudioRecorder;

use ExternalModules\AbstractExternalModule;
use ExternalModules\ExternalModules;

use REDCap;
use Piping;
use RCView;
use RestUtility;

class AudioRecorder extends AbstractExternalModule
{
    private $defaultMaxTime = 120;

    public function redcap_module_system_enable($version)
    {
        // We upgraded and need to maintain the existing settings
        if (count($this->getProjectsWithModuleEnabled())) {
            $this->setSystemSetting('allow-filerepo', $this->getSystemSetting('allow-filerepo') ?? '1');
            $this->setSystemSetting('allow-disk', $this->getSystemSetting('allow-disk') ?? '1');
        }
    }

    /*
    Redcap hook to display the Audio EM page on if enabled in settings.
    Page is useful for debugging, testing, and experimenting.
    */
    public function redcap_module_link_check_display($project_id, $link)
    {
        return $this->getProjectSetting('show-em-link');
    }

    /*
    Redcap hook to load for the Demo page and custom config
    */
    public function redcap_every_page_top($project_id)
    {
        // Audio Reocorder Testing / Demo page
        if ($_GET['prefix'] == $this->getPrefix() && $_GET['page'] == 'index') {
            $this->createJSobject([
                'fallback' => true,
                'noStartError' => false,
                'recording' => [
                    'desktop' => true,
                    'mic' => true
                ],
                'buttons' => [
                    'init'     => "#initBtn",
                    'start'    => "#startBtn",
                    'stop'     => "#stopBtn",
                    'download' => "#download"
                ]
            ]);
            $this->includeJs('recorder.js');
        }

        // Custom Config page
        if ($this->isPage('ExternalModules/manager/project.php') && $project_id != NULL) {
            $this->createJSobject();
            $this->includeJs('config.js');
        }
    }

    /*
    Redcap hook to load the primary audio recording functionality 
    on individual instruments 
    */
    public function redcap_data_entry_form($project_id, $record, $instrument, $event_id, $group_id, $repeat_instance)
    {
        // If no config was found, exit
        $settingIndex = $this->getSettingsIndex($instrument);
        if ($settingIndex == -1)
            return;

        $settings = $this->getProjectSettings();

        // Destination might have piping in it
        $dest = $settings['destination'][$settingIndex];
        $dest = $this->pipeTags($dest, $project_id, $record, $event_id, $repeat_instance);

        // Admin settings
        $adminMaxTime = intval($this->getSystemSetting("admin-max-time") ?? $this->defaultMaxTime);
        $maxTime = intval($settings['max-time'][$settingIndex]) ?? $adminMaxTime;
        $maxTime = ($maxTime > $adminMaxTime) || ($maxTime == 0) ? $adminMaxTime : $maxTime;

        // Load rest of the settings into a data strucutre
        $settings = [
            'destination' => $dest,
            'maxTime' => $maxTime,
            'noStartError' => $settings['suppress-start-error'][$settingIndex] == '1',
            'fallback' => $settings['fallback'][$settingIndex] == '1',
            'uploadTime' => $settings['upload-time'][$settingIndex],
            'fileName' => $settings['file-name'][$settingIndex],
            'recording' => [
                'desktop' => $settings['desktop'][$settingIndex] == '1',
                'mic' => $settings['mic'][$settingIndex] == '1'
            ],
            'buttons' => [
                'init'     => $settings['init-recording'][$settingIndex],
                'start'    => $settings['start-recording'][$settingIndex],
                'stop'     => $settings['stop-recording'][$settingIndex],
                'upload'   => $settings['upload-recording'][$settingIndex],
                'download' => $settings['download-recording'][$settingIndex]
            ]
        ];

        // Pass everything down to JS
        $this->createJSobject($settings);
        $this->includeJs('recorder.js');
    }

    /*
    Process a post request from or router
    */
    public function process()
    {
        $request = RestUtility::processRequest(false);
        $payload = $request->getRequestVars();

        if ($payload['route'] == "upload") {
            return $this->upload($payload['project_id'], $payload['record'], $payload['event_id'], $payload['instrument'], $payload['instance']);
        }

        if ($payload['route'] == "log") {
            return $this->projectLog($payload['project_id'], $payload['record'], $payload['event_id'], $payload['text']);
        }
    }

    /*
    Uploads an audio recording to the redcap server and moves the file to
    the target destination.
    */
    private function upload($project_id, $record, $event_id, $instrument, $instance)
    {
        $fileExtention = ".webm";
        $ts_format = "Ymd_Gis";

        // Check to be sure we got a file
        if (!isset($_FILES['file'])) {
            return json_encode([
                "success" => false,
                "note" => "No file receivied"
            ]);
        }

        // Rebuild destination. Pull, Pipe, Pipe in timestamp
        // Remove illegal charachters from file path, allow : due to windows needing it for drive letter
        $settingIndex = $this->getSettingsIndex($instrument);
        $fileRepo = $this->getProjectSetting('file-repo', $project_id)[$settingIndex];
        $dest = $this->getProjectSetting('destination', $project_id)[$settingIndex];
        $dest = $this->pipeTags($dest,  $project_id,  $record, $event_id, $instance);
        $dest = preg_replace('/\[timestamp\]/', Date($ts_format), $dest);
        $dest = preg_replace('/[\/*?"<>|]/', "", $dest) . $fileExtention;

        // Prep
        $note = "";
        $success = false;
        $tmp = $_FILES['file']['tmp_name'];
        $dir = dirname($dest);

        // Upload to file repo
        if ($fileRepo) {
            return $this->saveToFileRepo($project_id, $record, $event_id, $dest, $tmp);
        }

        // Log to PHP what we are doing. If there is an issue an Admin might need to recover the file
        ExternalModules::errorLog("File " . $tmp . " uploaded by Audio Recorder. Destination " . $dest);
        $dirExists = is_dir($dir);
        $dirExists = $dirExists ? true : mkdir($dir, 0777, true);

        // Attempt move, log any error
        if ($dirExists && move_uploaded_file($tmp, $dest)) {
            $success = true;
            $this->projectLog($project_id, $record, $event_id, "Recording Uploaded:\n" . $dest);
        } else {
            $extaMsg = $dirExists ? "" : " Failed to create directory";
            ExternalModules::errorLog("Error moving " . $tmp . " to new destination " . $dest . $extaMsg);
            $result["note"] = "Failed to move temporary file to destination";
            $this->projectLog($project_id, $record, $event_id, "Error Uploading Audio Recording." . $extaMsg);
        }

        return json_encode([
            "success" => $success,
            "file" => $dest,
            "tmp" => $tmp,
            "note" => $note
        ]);
    }

    /*
    Transfer an uploaded PHP file to the Redcap file repo for a project
    */
    private function saveToFileRepo($project_id, $record, $event_id, $filename, $tmp)
    {
        $file = basename($filename);
        $rename = dirname($tmp) . DIRECTORY_SEPARATOR . $file;
        $result = [
            "file" => $file,
            "tmp" => $tmp,
            "success" => false
        ];

        // Rename the file to what end user wants
        if (!move_uploaded_file($tmp, $rename)) {
            ExternalModules::errorLog("Error moving " . $tmp . " to new destination " . $rename);
            $result["note"] = "Failed to move temporary file to file repo";
            $this->projectLog($project_id, $record, $event_id, "Error Uploading Audio Recording to REDCap file repo");
            return json_encode($result);
        }

        // Try to enter the file into redcap's metadata
        $doc_id = REDCap::storeFile($rename, $project_id);
        if ($doc_id == 0) {
            ExternalModules::errorLog("REDCap::storeFile has failed to add file $rename to the edoc metadata for PID $project_id");
            $result["note"] = "Redcap internal method failed to move file into file repo";
            $this->projectLog($project_id, $record, $event_id, "Error Uploading Audio Recording to REDCap file repo");
            return json_encode($result);
        }
        $result['doc_id'] = $doc_id;

        // Try to add the registered doc to the file repo
        if (!REDCap::addFileToRepository($doc_id, $project_id, "Audio Recorder EM Upload")) {
            ExternalModules::errorLog("REDCap::storeFile has failed to add doc_id $doc_id to the file repo for PID $project_id");
            $result["note"] = "Redcap internal method failed to move file into file repo";
            $this->projectLog($project_id, $record, $event_id, "Error Uploading Audio Recording to REDCap file repo");
            return json_encode($result);
        }
        $result["success"] = true;
        return json_encode($result);
    }

    /*
    Writes a log entry to the project log for Init/start/stop/upload/upload error
    */
    private function projectLog($project_id, $record, $event_id, $text)
    {
        $sql = NULL;
        $action = 'Audio Recorder';
        $changes =  $text ?? "No action logged";

        REDCap::logEvent($action, $changes, $sql, $record, $event_id, $project_id);
        return json_encode([
            'text' => 'Action logged'
        ]);
    }

    /*
    Inits the AudioRecorder global with easy-to-gather settings.
    Many of these settings are not used on the config page, but it costs nothing.
    */
    private function createJSobject($additionalData = [])
    {
        $this->initializeJavascriptModuleObject();
        $data = json_encode(array_merge([
            "csrf" => $this->getCSRFToken(),
            "prefix" => $this->getPrefix(),
            "router" => $this->getUrl('router.php'),
            "helperButtons" => $this->getPipingHelperButtons(),
            "adminMaxTime" => intval($this->getSystemSetting("admin-max-time") ?? $this->defaultMaxTime),
            "allowFileRepo" => $this->getProjectSetting('allow-filerepo') == '1',
            "allowDisk" => $this->getProjectSetting('allow-disk') == '1',
        ], $additionalData));
        echo "<script>Object.assign({$this->getJavascriptModuleObjectName()}, {$data});</script>";
    }

    /*
    Search for the current instrument's config position
    */
    private function getSettingsIndex($instrument, $project_id = NULL)
    {
        $allInstruments = $this->getProjectSetting('instrument', $project_id);
        $settingIndex = -1;
        foreach ($allInstruments as $index => $instrumentList) {
            if (in_array($instrument,  $instrumentList)) {
                $settingIndex = $index;
            }
        }
        return $settingIndex;
    }

    /*
    Pipe in redcap standard tags
    */
    private function pipeTags($str, $project_id, $record, $event_id, $repeat_instance)
    {
        if (Piping::containsSpecialTags($str)) {
            $str = Piping::pipeSpecialTags($str, $project_id, $record, $event_id, $repeat_instance);
        }
        return $str;
    }

    /*
    HTML to include local JS file
    */
    private function includeJs($path)
    {
        echo "<script src={$this->getUrl($path)}></script>";
    }

    /*
    Util function. Loads the Piping helper/explination buttons seen in redcap
    */
    private function getPipingHelperButtons()
    {
        global $lang;
        $buttons = array(
            'green' => array(
                'callback' => 'smartVariableExplainPopup',
                'contents' => '[<i class="fas fa-bolt fa-xs"></i>] ' . $lang['global_146'],
            ),
            'purple' => array(
                'callback' => 'pipingExplanation',
                'contents' => RCView::img(array('src' => APP_PATH_IMAGES . 'pipe.png')) . $lang['info_41'],
            ),
        );
        $output = '';
        foreach ($buttons as $color => $btn) {
            $output .= RCView::button(array('class' => 'btn btn-xs btn-rc' . $color . ' btn-rc' . $color . '-light', 'onclick' => $btn['callback'] . '(); return false;'), $btn['contents']);
        }
        return RCView::br() . RCView::span(array('class' => 'ctri-piping-helper'), $output);
    }
}
