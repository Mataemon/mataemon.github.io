/************************************************
 __      __        _       _     _
 \ \    / /       (_)     | |   | |
  \ \  / /_ _ _ __ _  __ _| |__ | | ___  ___
   \ \/ / _` | '__| |/ _` | '_ \| |/ _ \/ __|
    \  / (_| | |  | | (_| | |_) | |  __/\__ \
     \/ \__,_|_|  |_|\__,_|_.__/|_|\___||___/
 ************************************************/

const ELT_VIDEO = document.querySelector("video");
const ELT_CNV_FACE = document.querySelector("#face");
const ELT_CNV_FRAME = document.querySelector("#frame");

const URLQueryString = new URLSearchParams(window.location.search);
let DEBUG = true;
let SELECTED_TYPE = null;
let NUMBER_OF_FACE = 2;
let BACK_DATA = null;

// let FPS = 30;
// let FRAMERATE = Math.floor(1000 / FPS);
const VIBRATION_DURATION = 300;

let VIDEO_READY = false;
let VIDEO_TO_RECORD_LIST = {};
let UPLOAD_COUNT = {"total" : [], "done": 0, "number_of_video_to_record": 0, "number_of_video_uploading": [], "average_upload_time" : 0 };
let VIDEO_TIMESTAMP = {};

/* Populate with random before getting data from server */
let STORY_TIMESTAMP = [];


let STARTING_FACEMODE = "user";
let CAMERA = null;

let DEVICE_SETTINGS = [];

let BUTTON_FORCE_NEXT_CHALLENGE_DISPLAYED = false;


const CONSTRAINTS_1080P = DEBUG ? null : {
    audio: false,
    video: {
        height: {ideal: 1080, min: 1080},
        width: {ideal: 1920, min: 1920}
    }
};

Object.defineProperty(HTMLMediaElement.prototype, 'playing', {
    get: function(){
        return !!(this.currentTime > 0 && !this.paused && !this.ended && this.readyState > 2);
    }
});


/* We call our Model asap to load them into client cache
 * Perform model warmup : https://www.tensorflow.org/js/guide/platform_environment#shader_compilation_texture_uploads
 */
let FACE_MODEL = null;
(async function(){
    tf.wasm.setWasmPaths({
        'tfjs-backend-wasm.wasm' : '/static/js/vendor/tensorflow/tf-backend-wasm/tfjs-backend-wasm.wasm',
        'tfjs-backend-wasm-simd.wasm' : '/static/js/vendor/tensorflow/tf-backend-wasm/tfjs-backend-wasm-simd.wasm',
        'tfjs-backend-wasm-threaded-simd.wasm' : '/static/js/vendor/tensorflow/tf-backend-wasm/tfjs-backend-wasm-threaded-simd.wasm',
    });
    await tf.setBackend('wasm').then((success) => { }, (error) => { console.log(error); });
    const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
    const detectorConfig = {
        runtime: 'tfjs',
    };
    FACE_MODEL = await faceDetection.createDetector(model, detectorConfig);
    const warmupResult = FACE_MODEL.estimateFaces(ELT_CNV_FACE);
})();

// This is a tiny MP3 file that is silent and extremely short - https://stackoverflow.com/questions/31776548/why-cant-javascript-play-audio-files-on-iphone-safari
const blank_sound = "data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
// Can be found into static/assets/success.mp3 but set as data to gain one downloaded file while opening process
const success_sound_data = 'data:audio/mpeg;base64,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VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVf/7EMT8AkkhFQdCmFaAagBgpAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVV//sQxNYDwAAB/gAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==';
const SUCCESS_SOUND = new Audio();
SUCCESS_SOUND.autoplay = true;

const SUCCESS_ICON_DURATION = 500;

/**************************************
  _    _ _   _ _ _ _   _
 | |  | | | (_) (_) | (_)
 | |  | | |_ _| |_| |_ _  ___  ___
 | |  | | __| | | | __| |/ _ \/ __|
 | |__| | |_| | | | |_| |  __/\__ \
  \____/ \__|_|_|_|\__|_|\___||___/
***************************************/

let REDIRECT = function(url, message = ""){
    console.error(message + " redirection vers : " + url);

    if (url) {
        document.location = url;
    }
}

let SCROLL_TO = function(selector, duration, padding){
    /* Move page to a specific selector : when you change step and want to go back to top for example */
    if(!selector || !document.querySelectorAll(selector).length) return false;
    duration = duration || 300;
    padding = padding || 0;
    let elementY = window.pageYOffset + document.querySelector(selector).getBoundingClientRect().top - padding;
    let startingY = window.pageYOffset;
    let diff = elementY - startingY;
    let start;

    window.requestAnimationFrame(function step(timestamp) {
        if (!start) start = timestamp;
        let time = timestamp - start;
        let percent = Math.min(time / duration, 1);

        window.scrollTo(0, startingY + diff * percent);

        if (time < duration) window.requestAnimationFrame(step);
    })
};

let SHOW_RECORDER = function(name){
    /* Display recorder modal and set name of the current action and duration */
    document.querySelector("#recorder").classList.add('visible');
    document.querySelector("body").style.overflow = "hidden";

    if(name !== "none") window.recording = name;
};

const SHOW_SECTION = function(id){
    document.querySelectorAll('main section').forEach(function(node) {
        node.style.display = (node.getAttribute('id') === id) ? "block" : "none";
    });

    const section = document.querySelector("#" + id);


    if(section.querySelector(".stick_to_bottom")){
        /* We calculate total height to check if its bigger than window minus stick to bottom */
        let total_height = 0;
        document.querySelectorAll("body > header, body > main, body > footer").forEach(elt => { total_height += parseInt(elt.offsetHeight); });
        if((parseInt(window.innerHeight) - parseInt(section.querySelector(".stick_to_bottom").offsetHeight)) < total_height){
            document.querySelector("body").style.marginBottom = section.querySelector(".stick_to_bottom").offsetHeight + "px";
        } else {
            document.querySelector("body").style.marginBottom = 0;
        }
    } else {
        document.querySelector("body").style.marginBottom = 0;
    }
}
/* Init */
SHOW_SECTION("legal_consent");

const UPDATE_RECORDER_TEXT = function(action, custom_data){
    const title = document.querySelector("#recorder-container footer h3");
    const title_text = custom_data ? window.lang["kyc_challenge_hint_" + action].replaceAll('[[DATA]]', custom_data) : window.lang["kyc_challenge_hint_" + action];
    title.innerHTML = title_text === "&nbsp;" ? "" :  title_text;
}

let _RESET_DISPLAY_RECORDER = function(){

    RECORDING_NOTIFICATION_SHOW(false);
    REMOVE_MASK_ID_CARD_SUCCESS();
    document.querySelector("#recorder-container .face_position").classList.add("hidden");

    /* Hide all specific visible canvas */
    ELT_CNV_IDMASK.style.display = "none";
    ELT_CNV_FACE.style.display = "none";
    document.querySelector("#recorder-container .face").classList.add("hidden");
    document.querySelector("#actionSuccess").style.opacity = 0;

    /* Hide loading screen to display generic error message if there's an issue with the next step capturing camera stream */
    document.querySelector('#loading_screen').style.opacity = 0;
}

let COVER_VIDEO = function(){
    /* Set video element to max width and height depending on stream dimension and screen dimension */
    let wWidth = document.documentElement.clientWidth;
    let wHeight = document.documentElement.clientHeight;

    let ratioWidth, ratioHeight, newWidth, newHeight;
    if(wWidth > ELT_VIDEO.videoWidth){
        if(wHeight > ELT_VIDEO.videoHeight){ /* window is larger and taller */
            newWidth = ELT_VIDEO.videoWidth;
            newHeight = ELT_VIDEO.videoHeight;
            ELT_VIDEO.setAttribute("ratio", 1);
        } else { /* window is larger and smaller */
            ratioHeight = wHeight/ELT_VIDEO.videoHeight;
            newWidth = ELT_VIDEO.videoWidth * ratioHeight
            newHeight = wHeight;
            ELT_VIDEO.setAttribute("ratio", ratioHeight);
        }
    } else {
        if(wHeight > ELT_VIDEO.videoHeight){ /* windows is thiner and taller */
            ratioWidth = wWidth/ELT_VIDEO.videoWidth;
            newWidth = wWidth;
            newHeight = ELT_VIDEO.videoHeight * ratioWidth;
            ELT_VIDEO.setAttribute("ratio", ratioWidth);
        } else { /* windows is thiner and smaller */
            ratioWidth = wWidth/ELT_VIDEO.videoWidth;
            ratioHeight = wHeight/ELT_VIDEO.videoHeight;
            let usedRatio = Math.min(ratioWidth, ratioHeight);
            newWidth = ELT_VIDEO.videoWidth * usedRatio;
            newHeight = ELT_VIDEO.videoHeight * usedRatio;
            ELT_VIDEO.setAttribute("ratio", usedRatio);
        }
    }
    utils.updateRatio([ELT_VIDEO, ELT_CNV_FRAME, document.querySelector("#recorder-container")], newWidth, newHeight);
};

let LAST_PERFORMED_ACTION = null;
let PERFORM_ACTION = function(action, name){
    /* Avoid multiple call for same action */
    if(LAST_PERFORMED_ACTION === action + name) return false;
    LAST_PERFORMED_ACTION = action + name;

    if(action === "start"){
        RECORDING_NOTIFICATION_SHOW(true);
        // We've got a stream, we can hide error message about getting device camera access
        document.querySelector('#loading_screen').style.opacity = 1;
        if(name !== "back"){ /* At the beginning we had 3 videos : front, back, face. An update merged the front and back video together, we dont have to start at the begin of the back video but we must keep all other mechanisms (getting timestamps ...) */
            utils.record(name, null, {"video_dimension" : [ELT_VIDEO.videoWidth, ELT_VIDEO.videoHeight]}, UPLOAD_CALLBACK);
        }
        VIDEO_TIMESTAMP[name] = {"start" : Date.now()};
        STORY_TIMESTAMP.push({[name + "_start"] : Date.now()});
        if(name !== "face"){
            STORY_TIMESTAMP.push({[name + "_start_show"] : Date.now()});
        } else {
            STORY_TIMESTAMP.push({[name + "_start_face_centered"] : Date.now()});
        }
    } else {
        RECORDING_NOTIFICATION_SHOW(false);
        VIDEO_TIMESTAMP[name]["stop"] = Date.now();
        STORY_TIMESTAMP.push({[name + "_stop"] : Date.now()});
        if(name !== "front" || NUMBER_OF_FACE !== 2){ /* At the beginning we had 3 videos : front, back, face. An update merged the front and back video together, we dont have to stop at the end of front but we must keep all other mechanisms (getting timestamps ...) */
            if(name === "back") window.recording = "front"; /* Hack to send front data at the end of back recording because all video data is set into front array since the merge of the 2 videos */
            utils.stop(function(type, count){
                SEND_VIDEO_DATA(type, {
                    "type": type,
                    "total_chunk": count
                });
                UPLOAD_COUNT.number_of_video_uploading.push(type);
            });
        }
        window.recording = false;
    }

    switch (name){
        case 'front':
            if(action === "start"){ actionToPerformFrontRecording(); } else { actionToPerformFrontStop(); }
            break;
        default :
            console.log("Invalid name : " + name + "(" + action + ")");
    }

    if(DEVICE_SETTINGS[utils.facingMode] && action === "stop") SEND_VIDEO_DATA("", {"device_settings" : JSON.stringify(DEVICE_SETTINGS[utils.facingMode])});
};

const INITIALIZE_ID_CENTER = function(document_face){
    DRAW_MASK_POSITION_ID_CARD("center-center", "id", document_face === "front");
    const countdown_elt = document.querySelector("#recorder-container .countdown");
    countdown_elt.classList.remove("hidden");
    const countdown_animation = setInterval(function() {
        const nbr = countdown_elt.dataset.count - 1;

        if (nbr === 0) {
            clearInterval(countdown_animation);
            countdown_elt.classList.add("hidden");
            countdown_elt.setAttribute("data-count", 3);
            countdown_elt.innerHTML = "3";
            PERFORM_ACTION("start", document_face)
        } else {
            countdown_elt.innerHTML = nbr;
            countdown_elt.setAttribute("data-count", nbr);
        }

    }, 1000);
}

let INIT_WEBCAM = function(facemode, callback, streamConstraint) {
    VIDEO_READY = false;

    facemode = facemode || "user";
    streamConstraint = streamConstraint || null;
    utils.getStream(facemode, streamConstraint).then(function (stream) {

        if (!stream || FORCE_SMARTPHONE_DEVICE()) {
            if(window.deviceAccess){
                return REDIRECT(null, "INIT_WEBCAM resolution requirements not met");
            }
            return REDIRECT(null, "INIT_WEBCAM no stream found");
        }

        utils.detectMimeType();

        DEVICE_SETTINGS[utils.facingMode] = {
            'settings' : stream.getVideoTracks()[0].getSettings(),
            'videotrack' : {
                "contentHint" : stream.getVideoTracks()[0].contentHint,
                "enabled" : stream.getVideoTracks()[0].enabled,
                "id" : stream.getVideoTracks()[0].id,
                "kind" : stream.getVideoTracks()[0].kind,
                "label" : stream.getVideoTracks()[0].label,
                "muted" : stream.getVideoTracks()[0].muted,
                "readyState" : stream.getVideoTracks()[0].readyState
            }
        };
        if(typeof stream.getVideoTracks()[0].getCapabilities === "function") DEVICE_SETTINGS[utils.facingMode].capabilities = stream.getVideoTracks()[0].getCapabilities();

        utils.setup(ELT_VIDEO, ELT_CNV_FRAME);
        utils.updateRatio([ELT_VIDEO, ELT_CNV_FRAME, document.querySelector("#recorder-container")]);
        ELT_VIDEO.srcObject = stream;

        document.querySelector("#recorder").classList.remove("user", "environment");
        document.querySelector("#recorder").classList.add(utils.facingMode);

        if(callback) callback();
    });
}

let FORCE_SMARTPHONE_DEVICE = function(){
    return !is.ios() && !is.android();
}

let CHECK_DEVICE_ORIENTATION = function(e){
    let beta = e.beta; /* Front to back, min : -180 max : 180 */
    let gamma = e.gamma; /* Left to right, min : -90 max : 90 */

    if(!is.ios() && !is.android()) return false;

    /* If more than 15% of max value, phone is not horizontal and we should trigger an error */
    if(Math.abs(beta) > 27 || Math.abs(gamma) > 14){
        document.querySelector('.rotation_hint').classList.add('visible');
    } else {
        document.querySelector('.rotation_hint').classList.remove('visible');
    }
};

let START_CHECK_DEVICE_ORIENTATION = function(){
    window.addEventListener("deviceorientation", CHECK_DEVICE_ORIENTATION);
};

let STOP_CHECK_DEVICE_ORIENTATION = function(){
    window.removeEventListener("deviceorientation", CHECK_DEVICE_ORIENTATION);
    document.querySelector('.rotation_hint').classList.remove('visible');
};

const actionRetry = function(e) {
    const url = new URL(window.location.href.split('#')[0]);
    url.searchParams.append('user_retry', true);
    REDIRECT(url.href);
}

document.querySelector("#recorderpopup .actionRetry").addEventListener("click", actionRetry);
document.querySelector("#error_recorder .actionRetry").addEventListener("click", actionRetry);

const SHOW_POPUP = function(step, dataScenarioIndex, custom_data){

    // Popup visible, we dont perform face check
    window.checkFace = false;

    const popup = document.querySelector("#recorderpopup");
    const header = popup.querySelector("header h3");
    const text = popup.querySelector("p");
    const btn = popup.querySelector("a.btn.actionVideo");
    const btnRetry = popup.querySelector("a.btn.actionRetry");

    /* Force user to look at the complete animation before clicking */
    btn.classList.add("disabled");
    setTimeout(() => {
        btn.classList.remove("disabled");
    }, 4000);

    const header_text = custom_data ? window.lang["kyc_challenge_title_" + step].replaceAll('[[DATA]]', custom_data) : window.lang["kyc_challenge_title_" + step];
    const description_text = custom_data ? window.lang["kyc_challenge_description_" + step].replaceAll('[[DATA]]', custom_data) : window.lang["kyc_challenge_description_" + step];


    header.innerHTML = header_text === "&nbsp;" ? "" : header_text;
    text.innerHTML = description_text === "&nbsp;" ? "" : description_text;
    const doc_type = step.startsWith('face') ? "" : (SELECTED_TYPE === "passport" ? "passport_" : "id_");
    btn.dataset.action = step;
    if(dataScenarioIndex) {
        btn.setAttribute("data-scenario-index", dataScenarioIndex);
    } else {
        btn.removeAttribute("data-scenario-index");
    }

    RECORDING_NOTIFICATION_SHOW(false);

    _RESET_DISPLAY_RECORDER();
    document.querySelector('body').classList.add('overpopup_visible');
    popup.classList.add("visible");
    try {
        let stepName;
        switch (step) {
            case "front":
                stepName = "Face avant";
                btnRetry.classList.add("hidden");
                break;
            case "front_zone":
                btn.classList.add("hidden");
                btnRetry.classList.remove("hidden");
                stepName = "Cadrer photo (1)";
                break;
        }

        if (stepName) {
            hj('event', "Etape : " + stepName);
        }
    } catch(e) {}
}

document.querySelectorAll(".showPopup").forEach(elt => elt.addEventListener("click", function(e){
    e.preventDefault();
    SHOW_POPUP(elt.dataset.action_popup);
}));

document.querySelectorAll(".showRecorder").forEach(elt => elt.addEventListener("click", function(e){
    e.preventDefault();
    SHOW_RECORDER("none");

    if(!BACK_DATA || elt.classList.contains("disabled")) return; /* Don't perform any action until we've got back data */
    switch (elt.getAttribute("data-type")){
        case 'front' :
            PERFORM_ACTION("start", "front");
            break;
        default:
            return;
    }

}));

const RECORDING_NOTIFICATION_SHOW = function(is_visible){
    const label = document.querySelector(".recordingNotification");
    if(is_visible){
        label.classList.remove("hidden");
    } else {
        label.classList.add("hidden");
    }
}

let SEND_VIDEO_DATA = function(action, custom_post_data, retry = 0){
    /* Send data to server for a specific video such as TS */
    let formData = new FormData();
    if(!BACK_DATA || !BACK_DATA.id){
        /* We don't have data from backend ? We wait until we have it */
        setTimeout(() => {
            SEND_VIDEO_DATA(action, custom_post_data, retry);
        }, 5000);
        return false;
    }
    formData.append("id", BACK_DATA.id);
    formData.append("scenario_e", BACK_DATA.scenario_e);
    formData.append("type", action);
    if(retry) { formData.append("call_is_a_retry", retry); }

    if(custom_post_data) {
        const keys = Object.keys(custom_post_data);
        keys.forEach((key, index) => {
            formData.append(key, custom_post_data[key]);
        });
    }

    let httpRequest = new XMLHttpRequest();
    httpRequest.onreadystatechange = function() {
        if (httpRequest.readyState === 4) {
            if (httpRequest.status === 200) {
                let responseText = false;
                try { responseText = JSON.parse(httpRequest.responseText); } catch(e) {}
                if(responseText && responseText.status && responseText.status === "success"){
                    // Correctly performed, nothing to do front side
                } else {
                    if(responseText.message === "expired"){
                         REDIRECT(CUSTOM_URL("recap"), "SEND_VIDEO_DATA responseText message : expired");
                    }
                    if(retry < 3 ){
                        setTimeout(function(){ SEND_VIDEO_DATA(action, custom_post_data, retry + 1); }, 1000 * (retry + 1) );
                    } else {
                        let options = "";
                        if(responseText.status === "error" && responseText.message){
                            options = "&error=" + encodeURIComponent(responseText.message);
                        }
                        REDIRECT(NETWORK_ERROR_URL() + "&from=upload_error" + options, "SEND_VIDEO_DATA Wrong responseText");
                    }
                }
            } else {
                if(retry < 3 ){
                    setTimeout(function(){ SEND_VIDEO_DATA(action, custom_post_data, retry + 1); }, 1000 * (retry + 1) );
                } else { REDIRECT(NETWORK_ERROR_URL() + "&from=upload_error", "SEND_VIDEO_DATA httpRequest status !== 200"); }
            }
        }
    };

    httpRequest.onerror = function(err) {
        // There was a connection error of some sort
        if(retry < 3) {
            setTimeout(function(){ SEND_VIDEO_DATA(action, custom_post_data, retry + 1); }, 1000 * (retry + 1) );
        } else { REDIRECT(NETWORK_ERROR_URL() + "&from=upload_error", "SEND_VIDEO_DATA httpRequest error"); }
    };

    /* Technical data for stat */
    formData.append("orientation", screen.orientation ? screen.orientation.angle : window.orientation);
    formData.append('dimension', document.documentElement.clientWidth + "x" + document.documentElement.clientHeight);

    httpRequest.open("POST", CUSTOM_URL("kyc_upload_video"));
    httpRequest.send(formData);
}

let DRAW_MASK_POSITION_ID_CARD = function(position, type, send_coordinates){
    document.querySelector("#recorder-container .face").classList.add("hidden");

    type = type === "id" ? "id" : "face";

    const pos = {
        "top-left" : { "x" : "20%", "y" : "33.3%"},
        "top-center" : { "x" : "50%", "y" : "33.3%"},
        "top-right" : { "x" : "80%", "y" : "33.3%"},
        "center-left" : { "x" : "20%", "y" : "50%"},
        "center-center" : { "x" : "50%", "y" : "50%"},
        "center-right" : { "x" : "80%", "y" : "50%"},
        "bottom-left" : { "x" : "20%", "y" : "66.6%"},
        "bottom-center" : { "x" : "50%", "y" : "66.6%"},
        "bottom-right" : { "x" : "80%", "y" : "66.6%"},
    };
    let maskSpan = document.querySelector("#recorder-container span.face_position");

    maskSpan.classList.remove("hidden");
    maskSpan.style.left = pos[position].x;
    maskSpan.style.top = pos[position].y;
    if(type === "face"){
        maskSpan.style.width = "calc(40% - 16px)";
        maskSpan.style.height = (maskSpan.offsetWidth * 45 / 35) + "px";
        maskSpan.style.backgroundImage = "url(/static/images/pages/arv-kyc/large_user_icon.svg)";
    } else {
        let width = 125; /* https://en.wikipedia.org/wiki/Passport#Designs_and_format */
        let height = 88; /* https://en.wikipedia.org/wiki/Passport#Designs_and_format */

        maskSpan.style.width = "calc(100% - 16px)";
        maskSpan.style.height = Math.floor((maskSpan.offsetWidth - 16) * height / width) + "px";
        maskSpan.style.backgroundImage = "none";
    }
    maskSpan.style.transform = "translate(calc(-50% - 8px), calc(-50% - 8px))";
    maskSpan.style.opacity = "1";
    maskSpan.style.zIndex = "60";

    if(send_coordinates){
        const coordRect = maskSpan.getBoundingClientRect();
        const coordVideo = ELT_VIDEO.getBoundingClientRect();
        SEND_VIDEO_DATA("front", {
            "mask-top" : Math.abs(coordVideo.top - coordRect.top) * 100 / coordVideo.height,
            "mask-left" : Math.abs(coordVideo.left - coordRect.left) * 100 / coordVideo.width,
            "mask-right" : Math.abs(coordVideo.right - coordRect.right) * 100 / coordVideo.width,
            "mask-bottom" : Math.abs(coordVideo.bottom - coordRect.bottom) * 100 / coordVideo.height
        });
    }
}

const SET_MASK_ID_CARD_SUCCESS = function(duration_ms){
    const mask = document.querySelector("#recorder-container span.face_position");
    const style = document.querySelector("#js_style");
    const base_ms = Math.floor(duration_ms / 4);
    style.innerHTML = `
        #recorder-container .mask.face_position.success:before {
            transition: width ${base_ms}ms linear 0ms, height ${base_ms}ms linear ${base_ms}ms, border-right-width 0ms linear ${base_ms}ms;
        }
        #recorder-container .mask.face_position.success:after {
            transition: border-color 0s linear ${base_ms * 2}ms, width ${base_ms}ms linear ${base_ms * 2}ms, height ${base_ms}ms linear ${base_ms * 3}ms;
        }
    `;
    mask.classList.add("success");
}

const REMOVE_MASK_ID_CARD_SUCCESS = function(){
    const mask = document.querySelector("#recorder-container span.face_position");
    const style = document.querySelector("#js_style");
    style.innerHTML = ``;
    mask.classList.remove("success");
}

let FORMAT_FACE_COORDINATES = function(face_object){
    const idx_format = {"rightEye" : "right_eye", "leftEye" : "left_eye", "noseTip" : "nose", "mouthCenter" : "mouth", "rightEarTragion" : "right_ear", "leftEarTragion" : "left_ear"};
    const container_w = ELT_VIDEO.offsetWidth;
    const container_h = ELT_VIDEO.offsetHeight;

    let res = {};
    face_object.forEach(coordinate => {
        res[idx_format[coordinate.name]] = [coordinate.x/container_w, coordinate.y/container_h];
    });

    return res;
}

let GLOBAL_LOOP = async function() {
    /* Function which will be call on every frame until we finish the recording. Will call render_prediction below */
    if(FACE_MODEL){/* Models are ready, we can start recording */
        RENDER_PREDICTION();
    } else if(utils && utils.recorder && utils.recorder.state && utils.recorder.state === "recording") {
        if(window.recording === "face"){
            FACE_LOOP();
        } else if(window.checkFace === true) {
            ID_POSITION_LOOP();
        }
    }
    CAMERA = requestAnimationFrame(GLOBAL_LOOP);
};

const RENDER_PREDICTION = async function(){
    /* Analyze for each frame depending on current action required : face, MRZ ... */

    if(window.checkFace === true && utils.recorder.state && utils.recorder.state === "recording"){
        /* ID position into 2 random place checking for the recipient face */
        if(window.recording === "front"){
            if(!FACE_MODEL){
                /* Still apply empty loop to trigger skip button and other mechanisms */
                ID_POSITION_LOOP();
            } else {
                let flipHorizontal = !(is.android() || is.ios()); /* we don't have to perform flip on smartphone because it's already performed by OS */
                const facePredictions = await FACE_MODEL.estimateFaces(
                    ELT_VIDEO, {flipHorizontal: flipHorizontal});
                if (!BUTTON_FORCE_NEXT_CHALLENGE_DISPLAYED && (facePredictions.length > 0)) {
                    let coord = FORMAT_FACE_COORDINATES(facePredictions[0]["keypoints"]);
                    ID_POSITION_LOOP(coord);
                } else {
                    /* Still apply empty loop to trigger skip button and other mechanisms */
                    ID_POSITION_LOOP();
                }
            }
        }
    }
};

/**********************************************
 _      _     _
 | |    (_)   | |
 | |     _ ___| |_ ___ _ __   ___ _ __ ___
 | |    | / __| __/ _ \ '_ \ / _ \ '__/ __|
 | |____| \__ \ ||  __/ | | |  __/ |  \__ \
 |______|_|___/\__\___|_| |_|\___|_|  |___/
 **********************************************/

/* If user leaves the page, stop all streams to avoid lock */
window.addEventListener("beforeunload", e =>{
    utils._stopStream();
});

// If available, lock screen to prevent rotating device while recording
try { screen.orientation.lock('portrait-primary').catch(function(e){}); } catch (e) {}
try { ScreenOrientation.lock('portrait-primary').catch(function(e){}); } catch (e) {}

/* Check on device resize and when initializing the process */
if(is.ios() || is.android()){
    const orientationDetection = function(){
        let orientation = window.matchMedia("(orientation: portrait)").matches ? "portrait" : (window.matchMedia("(orientation: landscape)").matches ? "landscape" : "unknown");
        if(orientation === "portrait"){
            document.querySelector(".turn-modal").style.display = "none";
            document.querySelector("body").style.overflow = "visible";
        } else {
            document.querySelector(".turn-modal").style.display = "block";
            document.querySelector("body").style.overflow = "hidden";
        }
    }
    window.addEventListener('resize', () => {
        orientationDetection();
    });
    orientationDetection();
}

/* Check on video loaded (stream is ready) to update recorder with correct stream dimension (also when changing faceMode) */
ELT_VIDEO.addEventListener('loadeddata', function(){
    COVER_VIDEO();
    utils.updateRatio(ELT_CNV_FRAME, ELT_VIDEO.videoWidth, ELT_VIDEO.videoHeight);

    /* Log when video has available frame to perform detection into loop */
    VIDEO_READY = Date.now();
});

ELT_VIDEO.addEventListener("playing", (event) => {
    ELT_VIDEO.style.zIndex = '15';
});

document.querySelectorAll(".overpopup .close").forEach(elt => {
   elt.addEventListener("click", function(e){
       e.preventDefault();
       elt.closest(".overpopup").classList.remove("visible");
       document.querySelector('body').classList.remove('overpopup_visible');
   });
});

/* Display specific error if user is on iOS but not on safari or in webview */
if(is.webview()){
    /* Not reliable atm, need to check if it's still needed
    document.querySelector('.notice.webview').style.display = "block";
     */
}

/* We can't record, we have to redirect, navigator is incompatible */
if(typeof MediaRecorder === 'undefined' || typeof navigator.mediaDevices === 'undefined'){
    REDIRECT(null, "MediaRecorder not available");
}

/* On mobile phone, we adapt camera facing mode and illusration */
if(is.ios() || is.android()) {
        /* Only set camera to environment if we need to record ID */
        STARTING_FACEMODE = "environment";

        /* We update explanation illustration with correct pictures */

    /* Specific css rules applies */
    document.querySelector('body').classList.add('mobile');
    document.querySelector("#recorder").classList.add('mobile');
}

document.querySelector('.btn.accept-legal').addEventListener('click', e =>{
    e.preventDefault();

    /* First click on the page, we play a "blank" sound to init SUCCESS_SOUND audio
       Mandatory on Apple device : https://stackoverflow.com/questions/31776548/why-cant-javascript-play-audio-files-on-iphone-safari
       https://stackoverflow.com/questions/54047606/allow-audio-play-on-safari-for-chat-app
       Once we've done that with a user interaction, we can perform SUCCESS_SOUND.src = success_sound_data; to play our sound without user interaction
     */
    SUCCESS_SOUND.src = blank_sound;

    if(window.pageYOffset > document.querySelector("#header").getBoundingClientRect().top) {
        SCROLL_TO("#header", 0, 16);
    }

    /* test camera access and resolution */
    INIT_WEBCAM(STARTING_FACEMODE, function(){
        GLOBAL_LOOP();
        SHOW_SECTION("id-instructions");
        let step = "front";
    }, CONSTRAINTS_1080P);
});

/* Disable multiple click on button that requires only one click */
document.querySelectorAll("*[data-loading]").forEach(elt =>{
    elt.addEventListener("click", function(e){
        this.innerHTML = e.target.getAttribute('data-loading');
        this.classList.remove('btn-primary');
        this.classList.add('btn-ghost', 'grey');
        this.style.pointerEvents = "none";
        this.blur();
    });
});

/* When user has read video recording instruction for face action, display correct data to recorder modal block */
document.querySelector('.btn.actionVideo').addEventListener('click', function(e){
    e.preventDefault();

    /* HIDE POPUP */
    document.querySelector("#recorderpopup").classList.remove("visible");
    document.querySelector('body').classList.remove('overpopup_visible');

    document.querySelector('#recorder-container .recorder-main').style.opacity = 1;
    let action = this.getAttribute('data-action');
    let scenario_index = this.getAttribute('data-scenario-index');
    document.querySelector('.btn.actionVideo').classList.add("disabled");

    /* SET CORRECT TEXT TO RECORDER */
    UPDATE_RECORDER_TEXT(action);

    if(scenario_index){
        BACK_DATA.scenario.face[scenario_index].done = false;
        BACK_DATA.scenario.face[scenario_index].active = true;
    }

    switch(action){
        case 'front' :
            if(checkAndForcePlay())
            {
                INITIALIZE_ID_CENTER("front");
            }
            break;
        default:
            return;
    }
});

const manualPlay = function(errorCallback){
    let startPlayPromise = ELT_VIDEO.play();
    if (startPlayPromise !== undefined) {
        startPlayPromise
            .then(() => {
                INITIALIZE_ID_CENTER("front");
            })
            .catch((error) => {
                if(errorCallback){
                    errorCallback(error);
                }
            });
    }
}
const logError = function(message) {
    console.log(message);
}
const checkAndForcePlay = function() {
    if(!FORCE_VIDEO_PLAYBACK) return true;
    if(!ELT_VIDEO.playing) {
        resizeErrorMessage();
        logError('1) video is not playing, we force it');
        manualPlay((error) => {
            logError(`2) manual play error : ${error}`);
            return REDIRECT(null, "checkAndForcePlay manual play error");
        });
        return false;
    }
    return true;
}
const resizeErrorMessage = function(){
    const errorMessageDiv = document.querySelector("#error_recorder");
    const width = 125; /* https://en.wikipedia.org/wiki/Passport#Designs_and_format */
    const height = 88; /* https://en.wikipedia.org/wiki/Passport#Designs_and_format */

    errorMessageDiv.style.height = Math.floor((errorMessageDiv.offsetWidth - 16) * height / width) + "px";
}

/*********************************************************
   _____ _           _ _
  / ____| |         | | |
 | |    | |__   __ _| | | ___ _ __   __ _  ___  ___
 | |    | '_ \ / _` | | |/ _ \ '_ \ / _` |/ _ \/ __|
 | |____| | | | (_| | | |  __/ | | | (_| |  __/\__ \
  \_____|_| |_|\__,_|_|_|\___|_| |_|\__, |\___||___/
                                    __/ |
                                   |___/
 **********************************************************/

/* FRONT START AND STOP RECORDING FUNCTIONS */
let actionToPerformFrontRecording = function(){
    const timeout_s = 7;
    SHOW_RECORDER("front");
    SET_MASK_ID_CARD_SUCCESS(timeout_s * 1000);
    START_CHECK_DEVICE_ORIENTATION();
    // GET_CHALLENGE(); /* Getting face challenge */
    setTimeout(function(){
        if(window.recording === "front"){
            document.querySelector('#actionSuccess').style.opacity = 1;
            SUCCESS_SOUND.src = success_sound_data;
            if(window.navigator.vibrate) window.navigator.vibrate(VIBRATION_DURATION);
            STOP_CHECK_DEVICE_ORIENTATION();

            setTimeout(() => {
                SHOW_POPUP("front_zone");
                _RESET_DISPLAY_RECORDER();
                STORY_TIMESTAMP.push({"front_success_show" : Date.now()});
            }, SUCCESS_ICON_DURATION);
        }
    }, timeout_s * 1000);
};

let actionToPerformFrontStop = function(){
};
/* FRONT START AND STOP RECORDING FUNCTIONS */

if (navigator.userAgent.match(/samsung/i)) {
    document.querySelector("span.mask.face_position").style.border = "1px solid white";
}
