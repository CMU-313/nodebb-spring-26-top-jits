# Private Posts User Guide

## Overview

Private posts allow any user to create posts that only moderators and administrators can see. This feature helps facilitate internal discussions, sensitive communications, and moderation-specific content without exposing it to regular users.

## Who Can Create Private Posts

Anybody can create a private post, though only moderators or admins will be able to see them.

## Creating a Private Post

### When Creating a New Topic

1. Start composing your topic by clicking "New Topic"
2. In the composer toolbar (located near the top of the composer, next to the "Question" toggle), you will see a "Private" button with a lock icon
3. Click the "Private" button to enable private mode (the lock icon will fill in)
4. Write your post content as normal
5. Click "Post" or "Submit" to publish your private topic

### When Replying to a Topic

1. If the main post of the topic is private, the "Private" option will be automatically enabled for your reply
2. If the main post is not private, you can choose to make your reply private by clicking the "Private" button in the toolbar
3. Write your reply content
4. Click "Post" to submit

### When Editing a Post

1. Click the edit icon on the post you wish to modify
2. In the composer, click the "Private" button to toggle the post between private and public
3. Make your changes to the content
4. Click "Post" to save the updated post with the new privacy setting

Note: You can only edit posts you have created.

## Understanding the Private Indicator

When you view a private post, you will see:
- A lock icon
- A yellow badge with the word "Private"
- A tooltip message: "This post is private and only visible to moderators"

## Viewing Private Posts

As a moderator or administrator:
- Private posts appear normally in topics you have access to
- You can read, reply to, and edit private posts just like any other post
- The privacy badge helps you identify which posts are private at a glance

As a regular user:
- Private posts are hidden from your view
- If a topic contains only private posts, you will see a message: "This topic contains only private posts. If this is unexpected behavior, please contact system administrator"
- You will not be able to see any private content within that topic

# Anonymous Posts User Guide

## Overview

Anonymous posts allow logged in users to create posts where their identity is hidden from other regular users. When marked as anonymous, other users will see just a "Anonymous" label and a generic icon instead of the author's real name and avatar. Only the post author as well as moderators and administrators can still see the real poster

## Permissions

Any logged-in user can create an anonymous post. There are no special permissions required. The following are the possible user states:
- **The post author**: can always see their own identity on anonymous posts
- **Moderators and administrators**: can always see the real author of anonymous posts
- **Other regular users**: see "Anonymous" and generic icon in place of the author's name / avatar

## Creation

### When creating a post/response/etc
1. At the bottom of the composer, you will see a checkbox labeled "Post anonymously"
2. Check the "Post anonymously" checkbox to enable anonymous mode
3. Write your topic title and content as normal
5. Click "Post" / "Submit" to publish it anonymously

## What is shown
When viewing an anonymous post as a regular user (who is not the author), you will see:
- A circular gray icon with a agent silhouette in place of the author's avatar
- The name `Anonymous` displayed in place of the author's username
- Author's profile link, group badges, and custom profile info are all hidden/disabled/regular text

When viewing an anonymous post as the author or as a moderator/administrator, you will see:
- The real author's avatar and username displayed as normal
- The post otherwise functions like any other post

## For topic listings / other pages showing personal info
Anonymous posts are also reflected in topic list previews:
- For **topic listings** (e.g., on a category page), if the topic's main post is anonymous, the author's avatar is replaced with the anonymous secret-agent icon
- In **topic teasers** (the last reply preview shown beside a topic), if the latest reply is anonymous, the teaser shows the anonymous icon instead of the replier's avatar
- For the **category "last post" previews**, anonymous posts display the anonymous icon in place of the poster's avatar

# Automated Tests

## Private (Mod-Only) Posts Tests

Tests for private posts are located in **`test/posts.js`** under two `describe` blocks:

### `describe('mod-only posts')` (around line 1409)

These tests cover the core backend behavior of the `modOnly` flag:

| Test | What is verified |
|------|-----------------|
| `modOnly` flag persists as `1` when set on topic creation | The flag is stored correctly in the database |
| `modOnly` defaults to `0` when omitted | Non-private posts are not accidentally marked private |
| `modOnly` reply creation stores the flag | Replies (not just main posts) can be private |
| Admin can read a `modOnly` post via API | Admins have unrestricted access |
| Global moderator can read a `modOnly` post via API | Moderators have unrestricted access |
| Regular user **cannot** read a `modOnly` post via API (returns `null`) | Access control is enforced for non-privileged users |
| Guest **cannot** read a `modOnly` post via API | Unauthenticated users are also blocked |
| Regular user **cannot** get raw content of a `modOnly` post | Raw-content endpoint also enforces privilege |
| Admin can get raw content | Privileged raw-content access is unaffected |
| Filtering removes `modOnly` posts from regular user views and keeps them for admins/global mods | The `privileges.posts.filter` path works correctly for all three roles |
| Admin and global moderator can toggle `modOnly` via edit | Privileged users can change post visibility after creation |
| Regular user **cannot** set `modOnly` via edit (throws `[[error:no-privileges]]`) | Privilege enforcement during edits |
| Correct `read`, `topics:read`, `isModOnly`, `isAdminOrMod` privilege flags returned per role | All flags consumed by the frontend are accurate |
| `modifyPostByPrivilege` replaces content with `[[topic:post-is-mod-only]]` for non-privileged users | The in-memory content scrubbing path works |
| `modifyPostByPrivilege` **does not** change content for privileged users | Privileged rendering is unaffected |
| Guest **cannot** access via `getSummary`; admin **can** | Summary API respects the same access rules |
| Post owner (regular user) can see their own `modOnly` post | Authors are not locked out of their own private posts |

### `describe('Private Posts - Frontend Backend Integration')` (around line 1668)

These tests cover the data structures and filtering logic the frontend depends on:

| Test group | What is verified |
|------------|-----------------|
| **Frontend post data structure** | `modOnly` field appears in `get` and `getSummary` API responses; `isModOnly` privilege flag is set/unset correctly |
| **Frontend filtering logic** | `privileges.posts.filter` removes private replies from regular user views, keeps them for admins, and handles mixed public/private post chains |
| **Frontend API response structure** | `isAdminOrMod` is `true` for admins and global mods, `false` for regular users; post owners can view their own private posts and replies; cross-user access is blocked; `modifyPostByPrivilege` hides/shows content based on `selfPost` and `isAdminOrMod`; admin access via socket-style API calls is verified |

**Why these tests are sufficient:** They cover every role (guest, regular user, post owner, global moderator, admin) across every access path (direct API `get`, `getRaw`, `getSummary`, `filter`, `modifyPostByPrivilege`, and edit). Both creation-time defaults and post-edit toggling are exercised, ensuring the privilege system cannot be bypassed through any of the exposed endpoints.

---

## Anonymous Posts Tests

Tests for anonymous posts are split across two files.

### `test/anonymous-posts.js` (entire file)

This file tests the frontend-facing behavior of the `anonymous` flag end-to-end via the HTTP API and topic/post data layer:

| Test group | What is verified |
|------------|-----------------|
| **HTTP API accepts `anonymous` flag in topic creation** | Sending `anonymous: true` and `anonymous: false` in a `POST /api/v3/topics` request both return `status.code: 'ok'` — the API does not reject the field |
| **HTTP API accepts `anonymous` flag in replies** | Same acceptance check for `POST /api/v3/topics/:tid` |
| **Author identity is always preserved** | The real `uid` is stored regardless of the `anonymous` flag; `posts.isOwner` correctly identifies the real author and returns `false` for non-authors |
| **`isAdminOrMod` privilege flag** | Admin users receive `isAdminOrMod: true` in topic page privileges; regular users receive `false` — the frontend uses this flag to decide whether to reveal the real author |
| **Anonymous field roundtrip through API** | `anonymous: true` submitted at creation time is returned as `true` in both topic-creation and reply-creation responses |
| **Anonymous defaults to `false`** | When `anonymous` is omitted, the stored and returned value is falsy for both topics and replies |
| **Topic page API includes `anonymous` field** | Fetching `/api/topic/:slug` returns `anonymous: true` on the main post; `selfPost` is `false` for an admin viewing another user's post, `true` for the author; anonymous replies also carry the field |

### `test/posts.js` -- `describe('anonymous flag')` (around line 803)

These tests exercise the data-layer storage and summary pipeline:

| Test | What is verified |
|------|-----------------|
| `anonymous: true` persists for replies and appears in API responses | The flag is stored in the database and surfaced through `posts.getPostField` and the post summary |
| `anonymous: false` is the default for replies | Non-anonymous posts are not accidentally marked anonymous |

**Why these tests are sufficient:** Together, the two test files verify every layer involved in the anonymous feature (HTTP request acceptance, database persistence, author identity preservation, privilege flag accuracy (`isAdminOrMod`, `selfPost`), API response shape (roundtrip), default behavior, and the topic-page response structure the frontend template) reads. The split between `anonymous-posts.js` (HTTP/API layer) and the `posts.js` unit tests (data layer) ensures both the integration path and the lower-level storage path are validated independently.
