export const DOM_SELECTORS = {
  composer: [
    '[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'textarea[placeholder*="message" i]',
    'textarea'
  ],
  sendButton: [
    'button[aria-label*="send" i]',
    'button[type="submit"]',
    'button[data-testid*="send" i]'
  ],
  messageItem: ['[data-message-id]', '[data-testid*="message" i]', '[role="listitem"]'],
  messageText: ['[data-testid*="message-text" i]', '.message-text', '[dir="auto"]']
};

export function queryFirst(selectors, root = document) {
  for (const selector of selectors) {
    const node = root.querySelector(selector);
    if (node instanceof HTMLElement) return node;
  }
  return null;
}
