<?php

namespace UWMadison\AudioRecorder;
use ExternalModules\AbstractExternalModule;
use ExternalModules\ExternalModules;

use REDCap;
use Piping;
use RCView;

function printToScreen($string) {
    ?><script>console.log(<?=json_encode($string); ?>);</script><?php
}

class AudioRecorder extends AbstractExternalModule {
    
    private $module_prefix = 'audio_recorder';
    private $module_global = 'AudioRecorder';
    private $module_name = 'AudioRecorder';
    
    private $notifyJS = 'https://cdnjs.cloudflare.com/ajax/libs/notify/0.4.2/notify.min.js';
    
    public function __construct() {
        parent::__construct();
    }
    
    public function redcap_module_link_check_display($project_id, $link) {
        if ( $this->getProjectSetting('show-em-link') )
            return true;
        return false;
    }
    
    public function redcap_every_page_top($project_id) {
        
        // Demo Page
        if ( $_GET['prefix'] == $this->module_prefix && $_GET['page'] == 'index') {
            $this->initGlobal();
            $settings = [
                'email' => $this->getProjectSetting('email'),
                'destination' => 'c:\testUploads\[timestamp]',
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
                    'upload'   => "#upload",
                    'download' => "#download"
                ]
            ];
            $this->passArgument('settings',$settings);
            $this->includeNotifyJS();
            $this->includeJs('recorder.js');
        }
        
        // Custom Config page
        if (strpos(PAGE, 'ExternalModules/manager/project.php') !== false && $project_id != NULL) {
            $this->initGlobal();
            $this->passArgument('helperButtons', $this->getPipingHelperButtons());
            $this->includeJs('config.js');
        }
    }
    
    public function redcap_data_entry_form($project_id, $record, $instrument, $event_id, $group_id, $repeat_instance) {
        
        $allInstruments = $this->getProjectSetting('instrument');
        $settingIndex = -1;
        foreach ( $allInstruments as $index => $instrumentList ) {
            if ( in_array($instrument,  $instrumentList) )
                $settingIndex = $index;
        }
        
        if ( $settingIndex == -1 )
            return;
        
        $this->initGlobal();
        $settings = $this->getProjectSettings();
        $dest = $settings['destination'][$settingIndex];
        if ( Piping::containsSpecialTags( $dest ) ) {
            $dest = Piping::pipeSpecialTags($dest, $project_id, $record, $event_id, $repeat_instance);
        }
        $settings = [
            'email' => $settings['email'],
            'destination' => $dest,
            'fallback' => $settings['suppress-start-error'][$settingIndex] == '1',
            'noStartError' => $settings['fallback'][$settingIndex] == '1',
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
        $this->passArgument('settings',$settings);
        $this->includeNotifyJS();
        $this->includeJs('recorder.js');
    }
    
    private function initGlobal() {
        global $project_contact_email;
        global $from_email;
        $data = array(
            "errorEmail" => $this->getSystemSetting('error-email'),
            "sendingEmail" => $from_email ? $from_email : $project_contact_email,
            "modulePrefix" => $this->module_prefix,
            "uploadPOST" => $this->getUrl('upload.php')
        );
        echo "<script>var ".$this->module_global." = ".json_encode($data).";</script>";
    }
    
    private function passArgument($name, $value) {
        echo "<script>".$this->module_global.".".$name." = ".json_encode($value).";</script>";
    }
    
    private function includeJs($path) {
        echo '<script src="' . $this->getUrl($path) . '"></script>';
    }
    
    private function includeNotifyJS() {
        echo '<script src="' . $this->notifyJS . '"></script>';
    }
    
    private function getPipingHelperButtons() {
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

?>
