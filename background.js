const STORAGE_KEY = "youtubeLofiPair";

async function getPair() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || {
    lectureTabId: null,
    lofiTabId: null,
    enabled: false
  };
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
      `[YouTube Lo-Fi Sync] Content script injected into tab ${tabId}`
    );

    return true;
  } catch (error) {
    console.error(
      `[YouTube Lo-Fi Sync] Failed to inject into tab ${tabId}:`,
      error
    );

    return false;
  }
}

async function sendControl(tabId, action) {
  if (!tabId) return;

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "CONTROL_VIDEO",
      action: action
    });
  } catch (error) {
    console.log(
      `[YouTube Lo-Fi Sync] Content script missing in tab ${tabId}. Injecting...`
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
          "[YouTube Lo-Fi Sync] Could not send control after injection:",
          retryError
        );
      }
    }, 200);
  }
}

async function syncWithLecture() {
  const pair = await getPair();

  if (
    !pair.enabled ||
    !pair.lectureTabId ||
    !pair.lofiTabId
  ) {
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(
      pair.lectureTabId,
      {
        type: "GET_VIDEO_STATE"
      }
    );

    if (!response) return;

    if (response.found) {

    if (response.paused || response.ended) {
        await sendControl(pair.lofiTabId, "PLAY");
    } else {
        await sendControl(pair.lofiTabId, "PAUSE");
    }

}

    
  } catch (error) {
    console.log(
      "[YouTube Lo-Fi Sync] Could not read lecture state. Injecting content script..."
    );

    const injected = await injectContentScript(pair.lectureTabId);

    if (injected) {
      setTimeout(syncWithLecture, 300);
    }
  }
}

chrome.runtime.onMessage.addListener(
  async (message, sender, sendResponse) => {

    // Lecture video changed state
    if (message.type === "LECTURE_STATE_CHANGED") {

      const pair = await getPair();

      if (
        !pair.enabled ||
        sender.tab?.id !== pair.lectureTabId
      ) {
        return;
      }

      console.log(
        `[YouTube Lo-Fi Sync] Lecture state: ${message.state}`
      );

      if (message.state === "PLAYING") {
        await sendControl(pair.lofiTabId, "PAUSE");
      }

      if (message.state === "PAUSED") {
        await sendControl(pair.lofiTabId, "PLAY");
      }

      return;
    }

    if (message.type === "SET_PAIR") {

      const pair = {
        lectureTabId: message.lectureTabId,
        lofiTabId: message.lofiTabId,
        enabled: true
      };

      await savePair(pair);

      console.log("[YouTube Lo-Fi Sync] Pair created:", pair);

      await injectContentScript(pair.lectureTabId);
      await injectContentScript(pair.lofiTabId);

      await syncWithLecture();

      sendResponse({
        success: true
      });

      return;
    }

    if (message.type === "UNPAIR") {

      await savePair({
        lectureTabId: null,
        lofiTabId: null,
        enabled: false
      });

      console.log("[YouTube Lo-Fi Sync] Pair removed.");

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

  if (
    tabId === pair.lectureTabId ||
    tabId === pair.lofiTabId
  ) {

    await savePair({
      lectureTabId: null,
      lofiTabId: null,
      enabled: false
    });

    console.log(
      "[YouTube Lo-Fi Sync] A paired tab was closed. Pair disabled."
    );
  }
});