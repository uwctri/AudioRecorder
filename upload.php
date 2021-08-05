<?php
if (isset($_FILES['file'])) {
    $out = [
        "success" => false,
        "tmp" => $_FILES['file']['tmp_name'],
        "target" => $_POST['destination']
    ];
    
    error_log("File ".$out["tmp"]." uploaded by Audio Recorder. Destination ".$out['target'], 0);
    $dir = implode( DIRECTORY_SEPARATOR, array_slice( explode( DIRECTORY_SEPARATOR, $out['target'] ), 0, -1 ) );
    mkdir( $dir, 0777, true);
    
    if ( move_uploaded_file( $out["tmp"], $out['target'] ) ) {
        $out["success"] = true;
    }
    else {
        error_log("Error moving ".$out["tmp"], 0);
    }
    
    echo json_encode($out);
    
} else {
    echo json_encode([
        "success" => false,
        "note" => "No file receivied"
    ]);
}
?>