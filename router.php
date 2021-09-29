<?php
if ( $_POST['route'] == "upload" ) {
    $module->upload();
} elseif ( $_POST['route'] == "log" ) {
    $module->projectLog();
}
?>