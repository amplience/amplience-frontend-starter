export default defineBackground(() => {
  // Set badge to OFF on install; will be updated to reflect bridge state
  // once the content script handshake is implemented (QL-84).
  chrome.runtime.onInstalled.addListener(() => {
    void chrome.action.setBadgeText({ text: 'OFF' })
    void chrome.action.setBadgeBackgroundColor({ color: '#6b6b6b' })
  })
})
