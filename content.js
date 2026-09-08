console.log("[YouTube Music Sync] Content script loaded.");

let currentVideo = null;

let savedVolume = 1;

let fadeOperation = 0;

let isFading = false;

const VOLUME_STORAGE_KEY = "youtubemusicVolume";

let volumeLoaded = false;

let volumeReady;

const FADE_DURATION = 2000;    
const FADE_INTERVAL = 50;      

let fadeTimer = null;

function notifyState(state) {
    try {
        chrome.runtime.sendMessage({
            type: "LECTURE_STATE_CHANGED",
            state: state
        }).catch(() => {
          
        });
    } catch (error) {
        
    }
}

function handlePlay() {
    console.log("[YouTube Music Sync] Video playing.");
    notifyState("PLAYING");
}

function handlePause() {
    console.log("[YouTube Music Sync] Video paused.");
    notifyState("PAUSED");
}

function attachToVideo(video) {

    if (currentVideo === video) {
        return;
    }

    if (currentVideo) {
        currentVideo.removeEventListener("play", handlePlay);
        currentVideo.removeEventListener("pause", handlePause);
        currentVideo.removeEventListener("volumechange", handleVolumeChange);
    }

    currentVideo = video;

    if (!currentVideo) {
        return;
    }

    currentVideo.addEventListener("play", handlePlay);
    currentVideo.addEventListener("pause", handlePause);
    currentVideo.addEventListener("volumechange", handleVolumeChange);

    if (!volumeLoaded && !isFading && currentVideo.volume > 0) {
        savedVolume = currentVideo.volume;
    }

    console.log(
        "[YouTube Music Sync] Connected to YouTube player."
    );
}

function findVideo() {

    const video = document.querySelector("video");

    if (video) {
        attachToVideo(video);
    }
}

const observer = new MutationObserver(() => {
    findVideo();
});

if (document.documentElement) {
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
}

setInterval(findVideo, 2000);

findVideo();


function stopFade() {

    if (fadeTimer !== null) {
        clearInterval(fadeTimer);
        fadeTimer = null;
    }

    isFading = false;
}

function fadeTo(targetVolume, callback) {

    if (!currentVideo) {
        return;
    }

    stopFade();

    isFading = true;

    const startVolume = currentVideo.volume;
    const difference = targetVolume - startVolume;

    if (Math.abs(difference) < 0.01) {

        currentVideo.volume = targetVolume;
        isFading = false;

        if (callback) {
            callback();
        }

        return;
    }

    const steps = FADE_DURATION / FADE_INTERVAL;
    const volumeStep = difference / steps;

    let fadeVolume = startVolume;

    fadeTimer = setInterval(() => {

        if (!currentVideo) {
            stopFade();
            return;
        }

        fadeVolume += volumeStep;

        if (difference > 0 && fadeVolume >= targetVolume) {
            fadeVolume = targetVolume;
        }

        if (difference < 0 && fadeVolume <= targetVolume) {
            fadeVolume = targetVolume;
        }

        fadeVolume = Math.max(
            0,
            Math.min(1, fadeVolume)
        );

        currentVideo.volume = fadeVolume;

        if (Math.abs(fadeVolume - targetVolume) < 0.001) {

            currentVideo.volume = targetVolume;

            stopFade();

            if (callback) {
                callback();
            }
        }

    }, FADE_INTERVAL);
}

function saveVolume(volume) {
    chrome.storage.local.set({
        [VOLUME_STORAGE_KEY]: volume
    }).catch(() => {});
}

function handleVolumeChange() {

    if (!currentVideo) {
        return;
    }

     
    if (isFading) {
        return;
    }

     
    if (currentVideo.muted) {
        return;
    }

    if (currentVideo.volume > 0.01) {

        savedVolume = currentVideo.volume;

        saveVolume(savedVolume);

        console.log(
            "[YouTube Music Sync] Saved volume:",
            savedVolume
        );
    }
}

async function loadSavedVolume() {
    try {
        const result = await chrome.storage.local.get(VOLUME_STORAGE_KEY);
        const volume = result[VOLUME_STORAGE_KEY];

        if (typeof volume === "number" && volume > 0 && volume <= 1) {
            savedVolume = volume;
        }

        volumeLoaded = true;
    } catch {
        volumeLoaded = true;
    }
}


function playWithFade() {

    if (!currentVideo) {
        return false;
    }

    const operation = ++fadeOperation;

    stopFade();

    volumeReady.then(() => {

        if (!currentVideo || operation !== fadeOperation) {
            return;
        }

         
        const targetVolume = Math.max(
            0.01,
            Math.min(1, savedVolume)
        );

         
        currentVideo.volume = 0;

        return currentVideo.play().then(() => {

            if (!currentVideo || operation !== fadeOperation) {
                return;
            }

            console.log(
                "[YouTube Music Sync] Music started. Fading in to:",
                targetVolume
            );

            fadeTo(targetVolume);

        });

    }).catch((error) => {

        console.warn(
            "[YouTube Music Sync] Play failed:",
            error
        );

    });

    return true;
}

function pauseWithFade() {

    if (!currentVideo) {
        return false;
    }

     
    if (!isFading && currentVideo.volume > 0.01) {
        savedVolume = currentVideo.volume;
        saveVolume(savedVolume);
    }

    const operation = ++fadeOperation;

    stopFade();

    console.log(
        "[YouTube Music Sync] Fading out from:",
        currentVideo.volume,
        "to 0"
    );

    fadeTo(0, () => {

        if (
            currentVideo &&
            operation === fadeOperation
        ) {

            currentVideo.pause();

             
             
            currentVideo.volume = savedVolume;

        }

        console.log(
            "[YouTube Music Sync] Music paused."
        );
    });

    return true;
}

volumeReady = loadSavedVolume();


chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        if (message.type === "GET_VIDEO_STATE") {

            findVideo();

            if (!currentVideo) {

                sendResponse({
                    found: false
                });

                return;
            }

            sendResponse({
                found: true,
                paused: currentVideo.paused,
                ended: currentVideo.ended,
                currentTime: currentVideo.currentTime
            });

            return;
        }


        if (message.type === "CONTROL_VIDEO") {

            findVideo();

            if (!currentVideo) {

                sendResponse({
                    success: false,
                    error: "No YouTube video found."
                });

                return;
            }

            if (message.action === "PAUSE") {

                pauseWithFade();

                sendResponse({
                    success: true
                });

                return;
            }

            if (message.action === "PLAY") {

                if (!currentVideo.paused) {

                    sendResponse({
                        success: true
                    });

                    return;
                }

                playWithFade();

                sendResponse({
                    success: true
                });

                return;
            }
        }
    }
);