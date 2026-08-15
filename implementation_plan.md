# Unread Chat Messages Tracking

Track unread chat messages for mentors and students, with visual notification badges.

## Proposed Changes

### Backend

#### [MODIFY] `backend/src/bootstrap/index.ts`
- Add `CREATE TABLE IF NOT EXISTS team_chat_reads` to track the `last_read_at` timestamp for each user and team.
- Add socket logic: `socket.on('authenticate', (userId) => socket.join('user_' + userId))` to allow sending targeted notifications to specific users.

#### [NEW/MODIFY] `backend/src/feats/chat/chat.service.ts`
- Add `getUnreadCounts(userId, role)`: Fetches teams for the user and joins with `team_chat_messages` and `team_chat_reads` to count messages newer than their `last_read_at`.
- Add `markAsRead(userId, teamId)`: Upserts the `last_read_at` timestamp to `CURRENT_TIMESTAMP`.
- Modify `sendMessage()`: After saving a new message, query all users associated with the team (members + mentor) and use `io.to('user_' + id).emit('unreadMessageUpdate', { team_id })` to notify their global clients (except the sender).

#### [MODIFY] `backend/src/feats/chat/chat.controller.ts`
- Add `getUnreadCounts` and `markAsRead` handlers.

#### [MODIFY] `backend/src/feats/chat/chat.routes.ts`
- Add `GET /unread` and `POST /read/:teamId` routes.

### Frontend

#### [MODIFY] `frontend/src/contexts/AuthContext.jsx`
- Add `unreadCounts` state: `{ total: 0, teams: {} }`.
- Fetch `GET /api/v1/chat/unread` when the user logs in.
- Emit `socket.emit('authenticate', currentUser.id)` on load.
- Listen to `socket.on('unreadMessageUpdate', ({ team_id }))` to increment the specific team count and total count in real-time.
- Expose `markTeamAsRead(teamId)` function which calls `POST /api/v1/chat/read/:teamId` and sets the local count for that team to 0.

#### [MODIFY] `frontend/src/pages/ChatPage.jsx`
- Use the `unreadCounts.teams` from `AuthContext` to display a notification badge next to each team in the sidebar (for mentors).
- Call `markTeamAsRead(selectedTeam.id)` whenever a new team is selected, OR whenever a `newChatMessage` is received in the currently active chat.

#### [MODIFY] `frontend/src/pages/DashboardPage.jsx` & `frontend/src/pages/MentorDashboardPage.jsx`
- Access `unreadCounts.total` from `AuthContext`.
- Display a red notification badge (e.g. `bg-red-500 text-white`) next to the "Team Chat" navigation item if `total > 0`.

## Verification Plan

### Manual Verification
- Send a message from a student.
- Ensure the mentor sees the unread badge globally, and next to the team in the chat sidebar.
- Click on the team chat; ensure the badge disappears and the counter resets.
- Ensure sending a message while the chat is already open does not increment the unread badge.
