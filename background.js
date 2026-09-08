const STORAGE_KEY = "youtubemusicPair";

async function getPair() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const pair = result[STORAGE_KEY] || {
    lectureTabIds: [],
    musicTabId: null,
    enabled: false
  };

  if (!Array.isArray(pair.lectureTabIds)) {
    pair.lectureTabIds = pair.lectureTabId ? [pair.lectureTabId] : [];
  }

  return pair;
}

async function savePair(pair) {
  await chrome.storage.local.set({
    [STORAGE_KEY]: pair
  });
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"]
    });

    console.log(
      `[YouTube Music Sync] Content script injected into tab ${tabId}`
    );

    return true;
  } catch (error) {
    console.error(
      `[YouTube Music Sync] Failed to inject into tab ${tabId}:`,
      error
    );

    return false;
  }
}

async function sendControl(tabId, action) {
  if (tabId == null) return;

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "CONTROL_VIDEO",
      action: action
    });
  } catch (error) {
    console.log(
      `[YouTube Music Sync] Content script missing in tab ${tabId}. Injecting...`
    );

    const injected = await injectContentScript(tabId);

    if (!injected) return;

    setTimeout(async () => {
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: "CONTROL_VIDEO",
          action: action
        });
      } catch (retryError) {
        console.error(
          "[YouTube Music Sync] Could not send control after injection:",
          retryError
        );
      }
    }, 200);
  }
}

async function syncWithLecture() {
  const pair = await getPair();
  const lectureTabIds = pair.lectureTabIds;

  if (
    !pair.enabled ||
    lectureTabIds.length === 0 ||
    pair.musicTabId == null
  ) {
    return;
  }

  let lectureIsPlaying = false;

  for (const lectureTabId of lectureTabIds) {
    try {
      const response = await chrome.tabs.sendMessage(lectureTabId, {
        type: "GET_VIDEO_STATE"
      });

      if (response?.found && !response.paused && !response.ended) {
        lectureIsPlaying = true;
        break;
      }
    } catch (error) {
      console.log(
        `[YouTube Music Sync] Could not read lecture state in tab ${lectureTabId}. Injecting content script...`
      );

      await injectContentScript(lectureTabId);
    }
  }

  await sendControl(pair.musicTabId, lectureIsPlaying ? "PAUSE" : "PLAY");
}

chrome.runtime.onMessage.addListener(
  async (message, sender, sendResponse) => {

     
    if (message.type === "LECTURE_STATE_CHANGED") {

      const pair = await getPair();

      if (
        !pair.enabled ||
        !pair.lectureTabIds.includes(sender.tab?.id)
      ) {
        return;
      }

      console.log(
        `[YouTube Music Sync] Lecture state: ${message.state}`
      );

      if (message.state === "PLAYING") {
        await sendControl(pair.musicTabId, "PAUSE");

        await Promise.all(
          pair.lectureTabIds
            .filter((tabId) => tabId !== sender.tab.id)
            .map((tabId) => sendControl(tabId, "PAUSE"))
        );
      }

      if (message.state === "PAUSED") {
        await syncWithLecture();
      }

      return;
    }

    if (message.type === "SET_PAIR") {

      const pair = {
        lectureTabIds: message.lectureTabIds,
        musicTabId: message.musicTabId,
        enabled: true
      };

      await savePair(pair);

      console.log("[YouTube Music Sync] Pair created:", pair);

      await Promise.all(
        pair.lectureTabIds.map((tabId) => injectContentScript(tabId))
      );
      await injectContentScript(pair.musicTabId);

      await syncWithLecture();

      sendResponse({
        success: true
      });

      return;
    }

    if (message.type === "UNPAIR") {

      await savePair({
        lectureTabIds: [],
        musicTabId: null,
        enabled: false
      });

      console.log("[YouTube Music Sync] Pair removed.");

      sendResponse({
        success: true
      });

      return;
    }

    if (message.type === "GET_PAIR") {

      const pair = await getPair();

      sendResponse(pair);

      return;
    }

    if (message.type === "SYNC_NOW") {

      await syncWithLecture();

      sendResponse({
        success: true
      });

      return;
    }
  }
);

chrome.tabs.onRemoved.addListener(async (tabId) => {

  const pair = await getPair();
  const lectureTabIds = pair.lectureTabIds.filter(
    (lectureTabId) => lectureTabId !== tabId
  );

  if (tabId === pair.musicTabId) {

    await savePair({
      lectureTabIds: [],
      musicTabId: null,
      enabled: false
    });

    console.log(
      "[YouTube Music Sync] A paired tab was closed. Pair disabled."
    );
  } else if (lectureTabIds.length !== pair.lectureTabIds.length) {
    await savePair({
      ...pair,
      lectureTabIds
    });

    if (lectureTabIds.length === 0) {
      await savePair({
        lectureTabIds: [],
        musicTabId: pair.musicTabId,
        enabled: false
      });
    }
  }
});