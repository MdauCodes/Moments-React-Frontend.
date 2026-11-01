/**
 * Features that are built and deployed but must not be shown to visitors until their other half is
 * confirmed live.
 *
 * WEBSITE_CHAT_ENABLED — the "Chat with us" cards on the contact page. The store accepts website
 * chat messages by default, but the CRM only reads them when Core runs with
 * MOMENTS_CORE_CHAT_ENABLED=true, which is off by default. With that off, a visitor who starts a
 * chat is answered by nobody and their message never shows up as an enquiry, so the entry points
 * stay hidden. Flip this to true only after a test chat from the site has been seen in the CRM's
 * live chats list.
 */
export const WEBSITE_CHAT_ENABLED = false;
