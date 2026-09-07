const lectureSelect =
    document.getElementById("lectureSelect");

const lofiSelect =
    document.getElementById("lofiSelect");

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


function shortenTitle(title, maxLength = 55) {

    if (!title) {
        return "Untitled YouTube tab";
    }

    if (title.length <= maxLength) {
        return title;
    }

    return title.substring(0, maxLength) + "...";
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
                url.hostname === "youtube.com"
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

    lofiSelect.innerHTML = "";


    const lectureDefault =
        document.createElement("option");

    lectureDefault.value = "";

    lectureDefault.textContent =
        "Select lecture tab";


    const lofiDefault =
        document.createElement("option");

    lofiDefault.value = "";

    lofiDefault.textContent =
        "Select lo-fi tab";


    lectureSelect.appendChild(
        lectureDefault
    );

    lofiSelect.appendChild(
        lofiDefault
    );


    for (const tab of youtubeTabs) {

        lectureSelect.appendChild(
            createOption(tab)
        );

        lofiSelect.appendChild(
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
        pair.lectureTabId &&
        pair.lofiTabId
    ) {

        lectureSelect.value =
            String(pair.lectureTabId);

        lofiSelect.value =
            String(pair.lofiTabId);


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

        const lectureTabId =
            Number(lectureSelect.value);

        const lofiTabId =
            Number(lofiSelect.value);


        if (!lectureTabId) {

            setStatus(
                "Choose a lecture tab.",
                "error"
            );

            return;
        }


        if (!lofiTabId) {

            setStatus(
                "Choose a lo-fi tab.",
                "error"
            );

            return;
        }


        if (lectureTabId === lofiTabId) {

            setStatus(
                "Lecture and lo-fi cannot be the same tab.",
                "error"
            );

            return;
        }


        try {

            const result =
                await chrome.runtime.sendMessage({
                    type: "SET_PAIR",
                    lectureTabId,
                    lofiTabId
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
                "Paired! Lecture now controls your lo-fi.",
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
2. Open your YouTube lo-fi video in another tab.
3. CTRL + F5 both tabs.
4. Open Kim's Syncer.
5. Select the lecture tab under "lecture".
6. Select the lo-fi tab under "lo-fi".
7. Click [ PAIR ].`
    );
});