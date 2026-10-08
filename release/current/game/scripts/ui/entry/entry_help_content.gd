class_name EntryHelpContent
extends RefCounted
## Answers describe the implemented account/content flow; no additional story canon.
const FAQ: Array[Array] = [
	["Why do I need Google sign-in?", "Your game account and saved progress are linked to your Google account. Use the same Google account when you return."],
	["How do I sign in?", "Select Sign In to open Google's account chooser. Returning players sign in automatically with their authorized Google account. An internet connection is required."],
	["How can I use a different account?", "Select Logout at the bottom of Entry and confirm. Then sign in with the account you want to use. Logout is unavailable while an account or update operation is running."],
	["Can I play without an internet connection?", "A connection is required to sign in, check game content and synchronize progress. If Entry reports that you are offline, reconnect and select Retry."],
	["Why is an update required?", "After you tap the destiny prompt, the game checks its content. If an update is available, a popup shows its size and remaining download. Select Download to accept. Downloaded files are verified before they are installed."],
	["What if a download is interrupted?", "Reopen the game and select Retry. Completed download parts are kept for the next attempt. Wait for verification and installation to finish."],
	["Why does the game restart after an update?", "After a content update is installed, the game restarts automatically, signs in again and completes its checks. An app-version update instead opens the store."],
	["When can I enter the game?", "After signing in, tap the blinking destiny prompt. The game checks content and loads your saved progress, then opens the game automatically. New players begin the opening; returning players continue from their saved progress."],
	["Which frame rate should I choose?", "Start with 60 FPS in Settings. Try 30 FPS to reduce battery use and heat. Actual frame rate also depends on your device and display. The 120 FPS mode will be enabled in a future release."],
	["How do I adjust sound or report a problem?", "Settings has separate Music, Voices and Effects volume controls, Large Text and Reduced Motion. For a problem you cannot resolve, use Contact Us below and describe what happened."],
]
