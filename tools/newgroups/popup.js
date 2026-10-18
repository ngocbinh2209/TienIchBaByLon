const limitInput = document.getElementById("limit");
const delayInput = document.getElementById("delay");
const statusEl = document.getElementById("status");
const startButton = document.getElementById("start");
const cleanupButton = document.getElementById("cleanup");
const stopButton = document.getElementById("stop");

function setStatus(text) {
  statusEl.textContent = text;
}

function toNumber(input, fallback, min, max) {
  const value = Number(input.value);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.floor(value), min), max);
}

async function getActiveFacebookTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab || !tab.id) {
    throw new Error("Không tìm thấy tab đang mở.");
  }

  const isFacebookUrl =
    tab.url &&
    (tab.url.startsWith("https://facebook.com/") ||
      tab.url.startsWith("https://www.facebook.com/"));

  if (!isFacebookUrl) {
    throw new Error("Hãy mở trang Facebook trước khi chạy.");
  }

  return tab;
}

async function sendToActiveTab(message) {
  const tab = await getActiveFacebookTab();

  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    const missingReceiver =
      error.message &&
      error.message.includes("Receiving end does not exist");

    if (!missingReceiver) {
      throw error;
    }

    await chrome.scripting.executeScript({
      target: {
        tabId: tab.id
      },
      files: ["tools/newgroups/content.js"]
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
    return chrome.tabs.sendMessage(tab.id, message);
  }
}

startButton.addEventListener("click", async () => {
  const limit = toNumber(limitInput, 20, 1, 500);
  const delay = toNumber(delayInput, 700, 200, 5000);

  limitInput.value = String(limit);
  delayInput.value = String(delay);
  setStatus("Đang gửi lệnh lọc và tick...");

  try {
    const response = await sendToActiveTab({
      action: "START_AUTO_CHECK",
      limit,
      delay
    });

    setStatus(response?.message || "Đã bắt đầu lọc và tick.");
  } catch (error) {
    setStatus(error.message || "Không gửi được lệnh. Hãy tải lại trang Facebook rồi thử lại.");
  }
});

cleanupButton.addEventListener("click", async () => {
  setStatus("Đang lọc người lỗi đang được chọn...");

  try {
    const response = await sendToActiveTab({
      action: "CLEANUP_INVALID_SELECTED"
    });

    setStatus(response?.message || "Đã lọc xong.");
  } catch (error) {
    setStatus(error.message || "Không lọc được. Hãy mở cửa sổ mời trên Facebook rồi thử lại.");
  }
});

stopButton.addEventListener("click", async () => {
  setStatus("Đang gửi lệnh dừng...");

  try {
    const response = await sendToActiveTab({
      action: "STOP_AUTO_CHECK"
    });

    setStatus(response?.message || "Đã dừng.");
  } catch (error) {
    setStatus(error.message || "Không gửi được lệnh dừng.");
  }
});
