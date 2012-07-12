<?php
foreach ($_FILES["tracks"]["error"] as $key => $error) {
    if($error == UPLOAD_ERR_OK){
        $name = $_FILES["tracks"]["name"][$key];
		file_put_contents("./$name", file_get_contents($_FILES["tracks"]["tmp_name"][$key]));
		echo "saved $name";
    }
}
?>