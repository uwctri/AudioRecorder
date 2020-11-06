<?php
if (isset($_FILES['file'])) {
    $out = [
        "success" => false,
        "tmp" => $_FILES['file']['tmp_name'],
        "target" => $_POST['destination']
    ];
    $dir = implode( DIRECTORY_SEPARATOR, array_slice(explode( DIRECTORY_SEPARATOR, $_POST['destination']), 0, -1));
    mkdir( $dir, 0777, true);
    if ( move_uploaded_file($_FILES['file']['tmp_name'], $_POST['destination'] ) )
        $out["success"] = true;
    echo json_encode($out);
} else {
    echo json_encode([
        "success" => false,
        "note" => "No file receivied"
    ]);
}
?>