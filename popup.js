const lectureSelect =
    document.getElementById("lectureSelect");

const musicSelect =
    document.getElementById("musicSelect");

const pairButton =
    document.getElementById("pairButton");

const unpairButton =
    document.getElementById("unpairButton");

const syncButton =
    document.getElementById("syncButton");

const status =
    document.getElementById("status");


function setStatus(message, type = "") {
    status.textContent = message;

    status.className = "status";

    if (type) {
        status.classList.add(type);
    }
}


function shortenTitle(title, maxLength = 35) {

    if (!title) {
        return "Untitled YouTube tab";
    }

    if (title.length <= maxLength) {
        return title;
    }

    return `${(title.substring(0, maxLength)).trim()}...`;
}


function createOption(tab) {

    const option =
        document.createElement("option");

    option.value = String(tab.id);

    option.textContent =
        shortenTitle(tab.title);

    return option;
}


async function getYoutubeTabs() {

    const tabs =
        await chrome.tabs.query({});

    return tabs.filter((tab) => {

        if (!tab.url) {
            return false;
        }

        try {

            const url =
                new URL(tab.url);

            return (
                url.hostname === "www.youtube.com" ||
                url.hostname === "youtube.com" ||
                url.hostname === "music.youtube.com"
            );

        } catch {
            return false;
        }
    });
}


async function loadTabs() {

    const youtubeTabs =
        await getYoutubeTabs();


    lectureSelect.innerHTML = "";

    musicSelect.innerHTML = "";


    const lectureDefault =
        document.createElement("option");

    lectureDefault.value = "";

    lectureDefault.textContent =
        "Select lecture tab/s below:";


    const musicDefault =
        document.createElement("option");

    musicDefault.value = "";

    musicDefault.textContent =
        "Select Music tab";


    lectureSelect.appendChild(
        lectureDefault
    );

    musicSelect.appendChild(
        musicDefault
    );


    for (const tab of youtubeTabs) {

        lectureSelect.appendChild(
            createOption(tab)
        );

        musicSelect.appendChild(
            createOption(tab)
        );
    }


    return youtubeTabs;
}


async function loadExistingPair() {

    const pair =
        await chrome.runtime.sendMessage({
            type: "GET_PAIR"
        });


    if (
        pair?.enabled &&
        pair.lectureTabIds?.length > 0 &&
        pair.musicTabId
    ) {

        for (const lectureTabId of pair.lectureTabIds || []) {
            const option =
                lectureSelect.querySelector(`option[value="${lectureTabId}"]`);

            if (option) {
                option.selected = true;
            }
        }

        musicSelect.value =
            String(pair.musicTabId);


        setStatus(
            "Paired and active.",
            "success"
        );

    } else {

        setStatus(
            "Not paired."
        );
    }
}


pairButton.addEventListener(
    "click",
    async () => {

        const lectureTabIds =
            Array.from(lectureSelect.selectedOptions)
                .map((option) => Number(option.value))
                .filter(Boolean);

        const musicTabId =
            Number(musicSelect.value);


        if (lectureTabIds.length === 0) {

            setStatus(
                "Choose a lecture tab.",
                "error"
            );

            return;
        }


        if (!musicTabId) {

            setStatus(
                "Choose a Music tab.",
                "error"
            );

            return;
        }


        if (lectureTabIds.includes(musicTabId)) {

            setStatus(
                "Lecture and Music cannot be the same tab.",
                "error"
            );

            return;
        }


        try {

            const result =
                await chrome.runtime.sendMessage({
                    type: "SET_PAIR",
                    lectureTabIds,
                    musicTabId
                });


            if (!result?.success) {

                setStatus(
                    result?.error ||
                    "Pairing failed.",
                    "error"
                );

                return;
            }


            setStatus(
                "Paired! Lecture now controls your Music.",
                "success"
            );

        } catch (error) {

            setStatus(
                error.message,
                "error"
            );
        }
    }
);


unpairButton.addEventListener(
    "click",
    async () => {

        await chrome.runtime.sendMessage({
            type: "UNPAIR"
        });


        setStatus(
            "Unpaired."
        );
    }
);


syncButton.addEventListener(
    "click",
    async () => {

        try {

            await chrome.runtime.sendMessage({
                type: "SYNC_NOW"
            });


            setStatus(
                "Synced with lecture.",
                "success"
            );

        } catch (error) {

            setStatus(
                "Could not sync.",
                "error"
            );
        }
    }
);


async function initialize() {

    try {

        await loadTabs();

        await loadExistingPair();

    } catch (error) {

        console.error(error);

        setStatus(
            "Something went wrong while loading tabs.",
            "error"
        );
    }
}


initialize();

const howToUseButton = document.getElementById("howToUse");

howToUseButton.addEventListener("click", () => {
    alert(
`INSTRUCTIONS:

1. Open your YouTube lecture.
2. Open your YouTube Music video in another tab.
3. CTRL + F5 both tabs.
4. Open Kim's Syncer.
5. Select all lecture tabs under "lectures" (Ctrl-click or Shift-click).
6. Select the Music tab under "Music".
7. Click [ PAIR ].`
    );
});