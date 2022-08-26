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

    private $module_global = 'AudioRecorder';

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
            $this->initGlobal();
            $settings = [
                'email' => $this->getProjectSetting('email'),
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
            ];
            $this->passArgument('settings', $settings);
            $this->includeJs('recorder.js');
        }

        // Custom Config page
        if ($this->isPage('ExternalModules/manager/project.php') && $project_id != NULL) {
            $this->initGlobal();
            $this->passArgument('helperButtons', $this->getPipingHelperButtons());
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

        // Prep settings
        $this->initGlobal();
        $settings = $this->getProjectSettings();

        // Destination might have piping in it
        $dest = $settings['destination'][$settingIndex];
        $dest = $this->pipeTags($dest, $project_id, $record, $event_id, $repeat_instance);

        // Load rest of the settings into a data strucutre
        $settings = [
            'email' => $settings['email'],
            'destination' => $dest,
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
        $this->passArgument('settings', $settings);
        $this->includeJs('recorder.js');
    }

    /*
    Process a post request from API or router
    */
    public function process()
    {
        $request = RestUtility::processRequest(false);
        $params = $request->getRequestVars();

        if ($params['route'] == "upload") {
            return $this->upload($params);
        }

        if ($params['route'] == "log") {
            return $this->projectLog($params);
        }
    }

    /*
    Uploads an audio recording to the redcap server and moves the file to
    the target destination.
    */
    public function upload($params)
    {
        $fileExtention = ".webm";

        // Check to be sure we got a file
        if (!isset($_FILES['file'])) {
            return json_encode([
                "success" => false,
                "note" => "No file receivied"
            ]);
        }

        // Rebuild destination. Pull, Pipe, Pipe in timestamp
        // Remove illegal charachters from file path, allow : due to windows needing it for drive letter
        $settingIndex = $this->getSettingsIndex($params['instrument']);
        $dest = $this->getProjectSetting('destination', $params['project_id'])[$settingIndex];
        $dest = $this->pipeTags($dest,  $params['project_id'], $params['record'], $params['event_id'], $params['instance']);
        $dest = preg_replace('/\[timestamp\]/', Date("Ymd_Gis"), $dest);
        $dest = preg_replace('/[\/*?"<>|]/', "", $dest) . $fileExtention;

        // Prep the return object
        $result = [
            "success" => false,
            "tmp" => $_FILES['file']['tmp_name'],
            "file" => $dest
        ];

        // Log to PHP what we are doing. If there is an issue an Admin might need to recover the file
        ExternalModules::errorLog("File " . $result["tmp"] . " uploaded by Audio Recorder. Destination " . $result['file']);
        $dir = implode(DIRECTORY_SEPARATOR, array_slice(explode(DIRECTORY_SEPARATOR, $result['file']), 0, -1));
        mkdir($dir, 0777, true);

        // Attempt move, log any error
        if (move_uploaded_file($result["tmp"], $result['file'])) {
            $result["success"] = true;
        } else {
            ExternalModules::errorLog("Error moving " . $result["tmp"]);
            $result["note"] = "Failed to move temporary file to destination";
        }

        return json_encode($result);
    }

    /*
    Writes a log entry to the project log for Init/start/stop/upload/upload error
    */
    public function projectLog($params)
    {
        $sql = NULL;
        $action = 'Audio Recorder';
        $changes =  $_POST['changes'] ?? "No action logged";

        REDCap::logEvent($action, $changes, $sql, $params['record'], $params['event_id'], $params['project_id']);
        return json_encode([
            'text' => 'Action logged'
        ]);
    }

    /*
    Inits the AudioRecorder global with easy-to-gather settings.
    Many of these settings are not used on the config page, but it costs nothing.
    */
    private function initGlobal()
    {
        global $project_contact_email, $from_email;
        $data = json_encode([
            "csrf" => $this->getCSRFToken(),
            "errorEmail" => $this->getSystemSetting('error-email'),
            "sendingEmail" => $from_email ? $from_email : $project_contact_email,
            "modulePrefix" => $this->getPrefix(),
            "router" => $this->getUrl('router.php')
        ]);
        echo "<script>var {$this->module_global} = {$data};</script>";
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
    HTML to pass down a new setting to the module global after init
    */
    private function passArgument($name, $value)
    {
        echo "<script>{$this->module_global}.{$name} = " . json_encode($value) . ";</script>";
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
