<?php
if (isset($_FILES['file'])) {
    sleep(5);
    $out = [
        "success" => false,
        "tmp" => $_FILES['file']['tmp_name'],
        "target" => $_POST['destination']
    ];
    error_log("File ".$_FILES['file']['tmp_name']." uploaded by Audio Recorder. Destination ".$_POST['destination'], 0);
    $dir = implode( DIRECTORY_SEPARATOR, array_slice(explode( DIRECTORY_SEPARATOR, $_POST['destination']), 0, -1));
    mkdir( $dir, 0777, true);
    if ( move_uploaded_file($_FILES['file']['tmp_name'], $_POST['destination'] ) )
        $out["success"] = true;
    else
        error_log("Error moving ".$_FILES['file']['tmp_name'], 0);
    echo json_encode($out);
} else {
    echo json_encode([
        "success" => false,
        "note" => "No file receivied"
    ]);
}
?>