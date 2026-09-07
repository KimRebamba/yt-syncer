console.log("[YouTube Lo-Fi Sync] Content script loaded.");

let currentVideo = null;

let savedVolume = 1;

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
    console.log("[YouTube Lo-Fi Sync] Video playing.");
    notifyState("PLAYING");
}

function handlePause() {
    console.log("[YouTube Lo-Fi Sync] Video paused.");
    notifyState("PAUSED");
}

function attachToVideo(video) {

    if (currentVideo === video) {
        return;
    }

    if (currentVideo) {
        currentVideo.removeEventListener("play", handlePlay);
        currentVideo.removeEventListener("pause", handlePause);
    }

    currentVideo = video;

    if (!currentVideo) {
        return;
    }

    currentVideo.addEventListener("play", handlePlay);
    currentVideo.addEventListener("pause", handlePause);

    console.log(
        "[YouTube Lo-Fi Sync] Connected to YouTube player."
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
}

function fadeTo(targetVolume, callback) {

    if (!currentVideo) {
        return;
    }

    stopFade();

    const startVolume = currentVideo.volume;
    const difference = targetVolume - startVolume;

    if (Math.abs(difference) < 0.01) {

        currentVideo.volume = targetVolume;

        if (callback) {
            callback();
        }

        return;
    }

    const steps = FADE_DURATION / FADE_INTERVAL;
    const volumeStep = difference / steps;

    fadeTimer = setInterval(() => {

        if (!currentVideo) {
            stopFade();
            return;
        }

        let newVolume = currentVideo.volume + volumeStep;

        // Fade up
        if (difference > 0 && newVolume >= targetVolume) {
            newVolume = targetVolume;
        }

        // Fade down
        if (difference < 0 && newVolume <= targetVolume) {
            newVolume = targetVolume;
        }

        currentVideo.volume = Math.max(
            0,
            Math.min(1, newVolume)
        );

        if (currentVideo.volume === targetVolume) {

            stopFade();

            if (callback) {
                callback();
            }
        }

    }, FADE_INTERVAL);
}


function playWithFade() {

    if (!currentVideo) {
        return false;
    }

    stopFade();

    currentVideo.volume = 0;

    currentVideo.play()
        .then(() => {

            console.log(
                "[YouTube Lo-Fi Sync] Lo-fi started. Fading in..."
            );

            fadeTo(savedVolume);

        })
        .catch((error) => {

            console.warn(
                "[YouTube Lo-Fi Sync] Play failed:",
                error
            );

        });

    return true;
}

function pauseWithFade() {

    if (!currentVideo) {
        return false;
    }

    stopFade();

    savedVolume = currentVideo.volume;

    console.log(
        "[YouTube Lo-Fi Sync] Fading out..."
    );

    fadeTo(0, () => {

        if (currentVideo) {
            currentVideo.pause();
            currentVideo.volume = savedVolume;
        }

        console.log(
            "[YouTube Lo-Fi Sync] Lo-fi paused."
        );
    });

    return true;
}


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